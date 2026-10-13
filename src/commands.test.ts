import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from 'vitest'
import { cli } from './commands.ts'
import { run } from './run.ts'
import { fixture } from './fixtures.ts'
import { resolveConfig } from './config.ts'

test('CLI keeps repeatable source and reporting-session selections', async () => {
  const parsed = await cli.clone().parse(['node', 'weektrace', 'report', '--week', '2026-10-05',
    '--project', '/one', '--project', '/two', '--exclude-session', 'ses_one', '--exclude-session', 'ses_two'], { run: false })
  expect(parsed.options).toMatchObject({ week: '2026-10-05', project: ['/one', '/two'], excludeSession: ['ses_one', 'ses_two'] })
})
test('render validates config, curated summaries, filtering and output independently of source cwd', async () => {
  const root = path.resolve('weeks/.verification')
  await fs.mkdir(root, { recursive: true })
  const dataDir = await fs.mkdtemp(path.join(root, 'cli-'))
  await fs.mkdir(path.join(dataDir, 'evidence'))
  const evidence = fixture()
  await fs.writeFile(path.join(dataDir, 'evidence', `${evidence.week}.json`), JSON.stringify(evidence))
  const result = await run({ mode: 'render', cwd: '/', options: { dataDir, week: evidence.week,
    project: ['/synthetic/app'], excludeSession: ['ses_isolated'] } })
  expect(result).not.toBeInstanceOf(Error)
  if (result instanceof Error) throw result
  expect(result.sessions).toBe(2)
  expect(result.html).toContain(dataDir)
  const html = await fs.readFile(result.html!, 'utf8')
  expect(html).not.toContain('ses_two')
  expect(html).not.toContain('ses_isolated')
  await fs.writeFile(path.join(dataDir, 'config.json'), JSON.stringify({ timezone: 'UTC', theme: 'Green', projects: ['/synthetic/app'] }))
  const config = await resolveConfig({ cwd: '/', options: { dataDir, week: evidence.week, timezone: evidence.timezone, theme: 'Blue' } })
  expect(config).toMatchObject({ timezone: evidence.timezone, theme: 'Blue', projects: ['/synthetic/app'] })
  const invalid = await run({ mode: 'render', cwd: '/', options: { dataDir, week: evidence.week } })
  expect(invalid).toBeInstanceOf(Error)
  const summary = path.join(dataDir, 'evidence', 'curated.json')
  await fs.writeFile(summary, JSON.stringify({ lines: ['One', 'Two', 'Three'], followups: [{ id: 'ses_one', text: 'Explicit synthetic follow-up' }] }))
  expect(await run({ mode: 'render', cwd: '/', options: { dataDir, week: evidence.week, timezone: evidence.timezone, summary } })).not.toBeInstanceOf(Error)
  await fs.writeFile(summary, JSON.stringify({ lines: ['Only one'], followups: [] }))
  expect(await run({ mode: 'render', cwd: '/', options: { dataDir, week: evidence.week, timezone: evidence.timezone, summary } })).toBeInstanceOf(Error)
})
