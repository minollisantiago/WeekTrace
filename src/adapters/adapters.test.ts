import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import childProcess from 'node:child_process'
import util from 'node:util'
import { expect, test } from 'vitest'
import { z } from 'zod'
import { discoverApi } from './kimaki.ts'
import { documentedApi, getJson } from './opencode.ts'
import { normalizeSession } from '../collect.ts'
import { collectGit } from './git.ts'
import { fixture } from '../fixtures.ts'

test('server discovery selects OpenCode port rather than database port', () => {
  expect(discoverApi('Opening database via http://127.0.0.1:29988\nDiscovered existing OpenCode server on port 43981 via hrana lock port 29988'))
    .toBe('http://127.0.0.1:43981')
})
test('old sessions use actual events and first real prompts, not session lifespan', () => {
  const evidence = fixture(), start = evidence.start
  const result = normalizeSession({ source: { id: 'ses_old', title: 'Old session', directory: '/synthetic/app', time: { created: start - 86400000, updated: start + 600000 } },
    project: evidence.projects[0]!, start, end: evidence.end, messages: [
      { info: { role: 'user', time: { created: start - 86400000 } }, parts: [{ type: 'text', text: 'First actual request' }] },
      { info: { role: 'user', time: { created: start } }, parts: [{ type: 'text', text: '<discord-user thread-id="123" />', synthetic: true },
        { type: 'text', text: '[current git branch is feature] Continue' }] },
      { info: { role: 'assistant', time: { created: start + 600000 }, modelID: 'model', finish: 'stop' }, parts: [
        { type: 'text', text: 'Finished' }, { type: 'tool', tool: 'bash', state: { status: 'completed', time: { start, end: start + 600000 },
          input: { command: 'git commit -m feature' }, output: '[feature 1234567] feature' } },
      ] },
    ] })
  expect(result).toMatchObject({ prompt: 'First actual request', events: [start, start + 600000], thread: '123',
    branchHints: ['feature'], recordedHashes: ['1234567'], finals: ['Finished'] })
})
test('documented routes and truncation headers constrain API collection', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/doc') {
      res.end(JSON.stringify({ paths: { '/session': { get: { parameters: [
        { name: 'directory', in: 'query' }, { name: 'limit', in: 'query', schema: { maximum: 50 } }, { name: 'scope', in: 'query' },
      ] } }, '/session/{sessionID}/message': { get: { parameters: [], description: 'Retrieve all messages in a session.' } } } }))
      return
    }
    res.setHeader('Link', '</session?before=old>; rel="next"')
    res.end('[]')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test server')
  const base = `http://127.0.0.1:${address.port}`
  const doc = await documentedApi(base)
  const response = await getJson({ base, route: '/session', schema: z.array(z.string()) })
  await new Promise<void>(resolve => server.close(() => resolve()))
  expect(doc).toEqual({ scope: true, limit: 50, allMessages: true })
  expect(response).toEqual({ data: [], truncated: true })
})
test('Git collection uses commit tree diffs and deduplicable common worktree identity', async () => {
  const parent = path.resolve('weeks/.verification')
  await fs.mkdir(parent, { recursive: true })
  const repo = await fs.mkdtemp(path.join(parent, 'git-'))
  const exec = util.promisify(childProcess.execFile)
  await exec('git', ['init', '-b', 'feature', repo])
  await fs.writeFile(path.join(repo, 'feature.txt'), 'committed\n')
  await exec('git', ['-C', repo, 'add', 'feature.txt'])
  const evidence = fixture()
  await exec('git', ['-C', repo, '-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.invalid', '-c', 'commit.gpgsign=false',
    'commit', '-m', 'Synthetic\n\nSession: ses_one'], { env: { ...process.env, GIT_AUTHOR_DATE: '2026-10-05T12:00:00Z', GIT_COMMITTER_DATE: '2026-10-05T12:00:00Z' } })
  await fs.writeFile(path.join(repo, 'uncommitted.txt'), 'not evidence\n')
  const result = await collectGit({ project: { ...evidence.projects[0]!, directory: repo }, sessions: [{ ...evidence.sessions[0]!, recordedHashes: [] }], start: evidence.start, end: evidence.end })
  expect(result).not.toBeInstanceOf(Error)
  if (result instanceof Error) return
  expect(result.repository).toBe(repo)
  expect(result.commits[0]?.files).toEqual(['feature.txt'])
  expect(result.commits[0]?.stats).toEqual({ added: 1, deleted: 0, binary: 0 })
  expect(result.commits[0]?.linked).toEqual([{ id: 'ses_one', basis: 'Session trailer' }])
  await fs.writeFile(path.join(repo, 'feature.txt'), 'replacement\nsecond\n')
  await fs.writeFile(path.join(repo, 'tab\tname.txt'), 'one\ntwo\n')
  await fs.writeFile(path.join(repo, 'binary.bin'), Buffer.from([0, 1, 2, 0]))
  await exec('git', ['-C', repo, 'add', 'feature.txt', 'tab\tname.txt', 'binary.bin'])
  await exec('git', ['-C', repo, '-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.invalid', '-c', 'commit.gpgsign=false',
    'commit', '-m', 'Stats'], { env: { ...process.env, GIT_AUTHOR_DATE: '2026-10-05T13:00:00Z', GIT_COMMITTER_DATE: '2026-10-05T13:00:00Z' } })
  const changed = await collectGit({ project: { ...evidence.projects[0]!, directory: repo }, sessions: [], start: evidence.start, end: evidence.end })
  if (changed instanceof Error) throw changed
  expect(changed.commits.find(c => c.subject === 'Stats')?.stats).toEqual({ added: 4, deleted: 1, binary: 1 })
})
test('Critique evidence retains only in-range assistant previews and successful shell output, without inferring commit links', () => {
  const evidence = fixture(), start = evidence.start, url = 'https://critique.work/v/synthetic-diff'
  const result = normalizeSession({ source: { id: 'ses_diff', title: 'Diff', directory: '/synthetic/app', time: { created: start, updated: start } },
    project: evidence.projects[0]!, start, end: evidence.end, messages: [
      { info: { role: 'user', time: { created: start } }, parts: [{ type: 'text', text: 'https://critique.work/v/user-link' }] },
      { info: { role: 'assistant', time: { created: start - 1 } }, parts: [{ type: 'text', text: 'https://critique.work/v/old' }] },
      { info: { role: 'assistant', time: { created: start } }, parts: [
        { type: 'text', text: `[diff](${url}) https://critique.work.evil/v/wrong https://critique.work/v/path/annotations` },
        { type: 'tool', tool: 'shell', state: { status: 'completed', input: { command: 'bunx critique --web Test' }, output: url } },
        { type: 'tool', tool: 'shell', state: { status: 'error', output: 'https://critique.work/v/failed' } },
      ] },
      { info: { role: 'assistant', time: { created: evidence.end } }, parts: [{ type: 'text', text: 'https://critique.work/v/future' }] },
    ] })
  expect(result?.critiqueLinks).toEqual([{ url, time: start }])
  expect(result?.recordedHashes).toEqual([])
})
