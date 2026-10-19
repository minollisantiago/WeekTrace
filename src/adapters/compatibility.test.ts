import { writeSync } from 'node:fs'
import path from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { registrationSchema, parseJsonOutput, registeredProjects, recentSessions } from './kimaki.ts'
import { normalizeV2Messages, readPages, v2Inventory } from './opencode-v2.ts'
import { normalizeSession } from '../collect.ts'
import { command } from './process.ts'

vi.mock('./process.ts', () => ({ command: vi.fn() }))
afterEach(() => vi.resetAllMocks())

test('project registrations accept legacy and current Kimaki without inventing missing guilds', () => {
  const registrations = registrationSchema.parse([
    { directory: '/legacy', is_local: false, guild_id: 'old' },
    { directory: '/current', channelId: 'channel', guildId: null },
  ])
  expect(registrations[0]?.is_local).toBe(false)
  expect(registrations[1]).toMatchObject({ directory: '/current', is_local: true, folder_name: 'current' })
  expect(registrations[1]?.guild_id).toBeUndefined()
  expect(parseJsonOutput({ output: '[{"directory":"/wrong"}]', schema: registrationSchema })).toBeInstanceOf(Error)
})

test('current Kimaki metadata preserves nested thread IDs and local project filtering', async () => {
  vi.mocked(command).mockResolvedValueOnce({ stdout: JSON.stringify([
    { directory: '/current', channelId: 'channel', guildId: null },
  ]), stderr: '' } as never)
  expect(await registeredProjects(['/current'])).toEqual([{ directory: path.resolve('/current'), folder_name: 'current', is_local: true, guild_id: '' }])
  vi.mocked(command).mockResolvedValueOnce({ stdout: JSON.stringify([
    { id: 'ses_current', status: 'idle', metadata: { kimaki: { threadId: '123' } } },
  ]), stderr: '' } as never)
  expect(await recentSessions('/current')).toMatchObject({ sessions: [{ id: 'ses_current', threadId: '123' }], api: null })
})

test('V2 pagination exhausts cursors and never combines a cursor with order', async () => {
  const routes: string[] = []
  const result = await readPages('/api/session?project=project', async route => {
    routes.push(route)
    return routes.length === 1 ? { data: ['first'], cursor: { next: 'opaque+cursor' } }
      : { data: ['last'], cursor: { next: null } }
  })
  expect(result).toEqual(['first', 'last'])
  expect(new URL(routes[0]!, 'http://local').searchParams.get('order')).toBe('asc')
  const second = new URL(routes[1]!, 'http://local').searchParams
  expect(second.get('project')).toBe('project')
  expect(second.get('cursor')).toBe('opaque+cursor')
  expect(second.has('order')).toBe(false)
})

test('malformed pages, repeated cursors and failed later pages cannot appear complete', async () => {
  expect(await readPages('/api/session', async () => ({ data: [] }))).toBeInstanceOf(Error)
  expect(await readPages('/api/session', async () => ({ data: [], cursor: { next: 'same' } }))).toBeInstanceOf(Error)
  let calls = 0
  expect(await readPages('/api/session', async () => ++calls === 1 ? { data: ['partial'], cursor: { next: 'next' } } : new Error('unavailable'))).toBeInstanceOf(Error)
})

test('V2 mapping preserves actual tool timing, final text, model and shell attribution', () => {
  const messages = normalizeV2Messages([
    { id: 'user', type: 'user', time: { created: 1000 }, text: 'Actual request' },
    { id: 'meta', type: 'synthetic', time: { created: 1001 }, text: '[current git branch is feature]\n<discord-user thread-id="123" />' },
    { id: 'tool', type: 'assistant', time: { created: 1010, completed: 1060 }, model: { id: 'model' }, content: [
      { type: 'tool', name: 'shell', time: { created: 1020, ran: 1030, completed: 1050 },
        state: { status: 'completed', input: { command: 'git commit -m test' }, content: [{ type: 'text', text: '[feature abcdef1] test' }] } },
    ] },
    { id: 'stream', type: 'assistant', time: { created: 1061 }, content: [
      { type: 'tool', name: 'shell', time: { created: 1062 }, state: { status: 'streaming', input: '{"command":' } },
    ] },
    { id: 'final', type: 'assistant', time: { created: 1070, completed: 1080 }, finish: 'stop', content: [
      { type: 'text', text: 'Completed work', state: { provider: 'opaque' } },
    ] },
    { id: 'compact', type: 'compaction', time: { created: 1090 }, summary: 'Not a final response' },
  ])
  if (messages instanceof Error) throw messages
  const session = normalizeSession({ source: { id: 'ses_one', title: 'Test', directory: '/current', time: { created: 1, updated: 1090 } },
    messages, project: { directory: '/current', folder_name: 'current', is_local: true, guild_id: 'guild' }, start: 1000, end: 2000 })
  expect(session).toMatchObject({ prompt: 'Actual request', thread: '123', models: ['model'], finals: ['Completed work'],
    recordedHashes: ['abcdef1'], branchHints: ['feature'], commitBranches: [{ branch: 'feature', hash: 'abcdef1' }] })
  expect(session?.events).toContain(1030)
  expect(session?.events).toContain(1050)
})

test('V2 standalone shell messages keep commit evidence but failed shells do not', () => {
  const messages = normalizeV2Messages([{ id: 'shell', type: 'shell', time: { created: 10, completed: 20 },
    command: 'git commit -m test', status: 'exited', exit: 0, output: { output: '[main abcdef1] test', truncated: false } }])
  if (messages instanceof Error) throw messages
  expect(messages[0]?.parts[0]).toMatchObject({ tool: 'shell', state: { status: 'completed', output: '[main abcdef1] test' } })
  expect(normalizeV2Messages([{ type: 'assistant' }])).toBeInstanceOf(Error)
})

test('V2 inventory uses authenticated file output and Git worktrees, not shared project IDs', async () => {
  const routes: string[] = []
  vi.mocked(command).mockImplementation(async ({ executable, args, stdoutFile }) => {
    if (executable === 'git') return { stdout: 'worktree /current\n\nworktree /worktree\n', stderr: '' } as never
    expect(executable).toBe('opencode')
    expect(args.slice(0, 2)).toEqual(['api', 'get'])
    expect(stdoutFile).toEqual(expect.any(Number))
    const route = args[2]!
    routes.push(route)
    const session = (id: string, directory: string) => ({ id, title: id, projectID: 'project', location: { directory }, time: { created: 1, updated: 2 } })
    const get = (names: string[]) => ({ get: { parameters: names.map(name => ({ name, in: 'query' })) } })
    const data = route === '/openapi.json' ? { paths: { '/api/session': get(['directory', 'project', 'limit', 'cursor', 'order']), '/api/session/{sessionID}/message': get(['limit', 'cursor', 'order']) } }
      : { data: route.includes('worktree') ? [session('child', '/worktree'), session('unrelated', '/unrelated')] : [session('root', '/current')], cursor: { next: null } }
    writeSync(stdoutFile!, JSON.stringify(data))
    return { stdout: '', stderr: '' } as never
  })
  const inventory = await v2Inventory('/current')
  expect(inventory).toMatchObject({ scope: true, allMessages: true, sessions: [{ id: 'root', directory: '/current' }, { id: 'child', directory: '/worktree' }] })
  expect(routes.some(route => new URL(route, 'http://local').searchParams.get('directory') === path.resolve('/worktree'))).toBe(true)
  expect(routes.some(route => route.includes('project='))).toBe(false)
})

test('project discovery includes every local registration and applies only requested filters', async () => {
  const registrations = [
    { directory: '/one', is_local: true },
    { directory: '/two', is_local: true },
    { directory: '/remote', is_local: false },
  ]
  vi.mocked(command).mockResolvedValue({ stdout: JSON.stringify(registrations), stderr: '' } as never)
  const all = await registeredProjects([])
  if (all instanceof Error) throw all
  expect(all.map(project => project.directory)).toEqual([path.resolve('/one'), path.resolve('/two')])
  const filtered = await registeredProjects([path.resolve('/two')])
  if (filtered instanceof Error) throw filtered
  expect(filtered.map(project => project.directory)).toEqual([path.resolve('/two')])
  expect(await registeredProjects([path.resolve('/missing')])).toBeInstanceOf(Error)
  expect(command).toHaveBeenCalledWith({ executable: 'kimaki', args: ['project', 'list', '--json'] })
})
