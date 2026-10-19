import { z } from 'zod'
import { command } from './process.ts'
import { apiSessionSchema, messagesSchema } from './opencode.ts'
import { CalendarError } from '../errors.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathKey } from '../paths.ts'
import os from 'node:os'
import { tokensSchema } from '../usage.ts'

// The CLI owns managed-service discovery and authentication. Never copy service secrets.
export const localV2 = 'opencode:local'
const pageSchema = z.object({ data: z.array(z.unknown()), cursor: z.object({ next: z.string().nullish() }) })
const sessionSchema = z.object({ id: z.string(), title: z.string().optional(), parentID: z.string().optional(),
  projectID: z.string(), location: z.object({ directory: z.string() }),
  time: z.object({ created: z.number(), updated: z.number() }),
})
const contentSchema = z.object({ type: z.string(), text: z.string().optional(), name: z.string().optional(),
  time: z.object({ created: z.number(), ran: z.number().optional(), completed: z.number().optional() }).optional(),
  state: z.object({ status: z.string().optional(), input: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  }).optional(),
})
const messageSchema = z.object({ id: z.string(), type: z.string(),
  time: z.object({ created: z.number(), completed: z.number().optional() }),
  text: z.string().optional(), finish: z.string().optional(),
  tokens: tokensSchema.optional(),
  model: z.object({ id: z.string() }).optional(), content: z.array(contentSchema).optional(),
  command: z.string().optional(), status: z.string().optional(), exit: z.union([z.number(), z.string()]).optional(),
  output: z.object({ output: z.string(), truncated: z.boolean() }).optional(),
})
const docSchema = z.object({ paths: z.record(z.string(), z.object({
  get: z.object({ parameters: z.array(z.object({ name: z.string(), in: z.string() })).default([]) }).optional(),
}).passthrough()) })

async function request(route: string) {
  // Some CLI versions exit before a large piped stdout drains. A regular file
  // preserves the complete JSON; route/path remain positional, never shell code.
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weektrace-api-'))
  const file = path.join(root, 'response.json')
  try {
    const result = await command({ executable: 'sh', args: ['-c', 'opencode api get "$1" > "$2"', 'weektrace', route, file] })
    if (result instanceof Error) return result
    return JSON.parse(await fs.readFile(file, 'utf8')) as unknown
  } catch { return new CalendarError({ reason: 'OpenCode V2 returned invalid JSON. Check opencode api get /api/info.' }) }
  finally { await fs.rm(root, { recursive: true, force: true }) }
}

export async function readPages(route: string, read: (route: string) => Promise<unknown> = request) {
  const data: unknown[] = [], cursors = new Set<string>()
  let cursor: string | undefined
  for (;;) {
    const url = new URL(route, 'http://local')
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)
    else url.searchParams.set('order', 'asc')
    const raw = await read(url.pathname + url.search)
    if (raw instanceof Error) return raw
    const parsed = pageSchema.safeParse(raw)
    if (!parsed.success) return new CalendarError({ reason: 'Unsupported OpenCode V2 page. Check /openapi.json.' })
    data.push(...parsed.data.data)
    const next = parsed.data.cursor.next
    if (!next) return data
    if (cursors.has(next)) return new CalendarError({ reason: 'OpenCode V2 repeated a pagination cursor; coverage cannot be established.' })
    cursors.add(next); cursor = next
  }
}

export function normalizeV2Messages(raw: unknown) {
  const parsed = z.array(messageSchema).safeParse(raw)
  if (!parsed.success) return new CalendarError({ reason: `Unsupported OpenCode V2 message shape at ${parsed.error.issues.map(issue => issue.path.join('.')).join(', ')}. Check /openapi.json.` })
  return messagesSchema.parse(parsed.data.map(m => ({
    info: { id: m.id, role: m.type === 'synthetic' ? 'user' : m.type, time: m.time, modelID: m.model?.id, finish: m.finish, tokens: m.tokens },
    parts: m.type === 'user' || m.type === 'synthetic' ? [{ type: 'text', text: m.text,
      synthetic: m.type === 'synthetic' }] : m.type === 'assistant' ? (m.content ?? []).map(p => ({
      type: p.type, text: p.text, tool: p.name,
      time: p.time ? { start: p.time.ran ?? p.time.created, end: p.time.completed } : undefined,
      state: p.type === 'tool' && p.state?.status ? { status: p.state.status,
        input: { command: typeof p.state.input === 'object' && typeof p.state.input?.command === 'string' ? p.state.input.command : undefined },
        output: p.state.content?.filter(c => c.type === 'text').map(c => c.text ?? '').join('\n'),
        time: p.time ? { start: p.time.ran ?? p.time.created, end: p.time.completed } : undefined,
      } : undefined,
    })) : m.type === 'shell' ? [{ type: 'tool', tool: 'shell', state: {
      status: m.status === 'exited' && m.exit === 0 ? 'completed' : 'error',
      input: { command: m.command }, output: m.output?.output, time: { start: m.time.created, end: m.time.completed },
    } }] : [],
  })))
}

export async function v2Inventory(directory: string) {
  const doc = await request('/openapi.json')
  if (doc instanceof Error) return doc
  const paths = docSchema.safeParse(doc)
  if (!paths.success) return new CalendarError({ reason: 'Unsupported OpenCode V2 /openapi.json.' })
  const sessionsGet = paths.data.paths['/api/session']?.get
  const messagesGet = paths.data.paths['/api/session/{sessionID}/message']?.get
  const supports = (get: typeof sessionsGet, names: string[]) => names.every(name => get?.parameters.some(p => p.in === 'query' && p.name === name))
  if (!supports(sessionsGet, ['directory', 'limit', 'cursor', 'order']) || !supports(messagesGet, ['limit', 'cursor', 'order'])) {
    return new CalendarError({ reason: 'Required OpenCode V2 session APIs are not documented by /openapi.json.' })
  }
  // Migrated project IDs can be shared by unrelated registered directories.
  // Enumerate actual Git worktrees rather than attributing every shared-ID session
  // to whichever project happened to be collected first.
  const worktrees = await command({ executable: 'git', args: ['-C', directory, 'worktree', 'list', '--porcelain'] })
  const directories = new Set([path.resolve(directory)])
  if (!(worktrees instanceof Error)) for (const line of worktrees.stdout.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) directories.add(path.resolve(line.slice(9)))
  }
  const sessions = new Map<string, z.infer<typeof sessionSchema>>()
  for (const root of directories) {
    const raw = await readPages(`/api/session?directory=${encodeURIComponent(root)}`)
    if (raw instanceof Error) return raw
    const parsed = z.array(sessionSchema).safeParse(raw)
    if (!parsed.success) return new CalendarError({ reason: 'Unsupported OpenCode V2 session shape.' })
    for (const s of parsed.data) {
      const location = path.resolve(s.location.directory)
       if ([...directories].some(dir => pathKey(location) === pathKey(dir) || pathKey(location).startsWith(pathKey(dir).replace(/[\\/]+$/, '') + path.sep))) sessions.set(s.id, s)
    }
  }
  return { scope: !(worktrees instanceof Error), limit: Infinity, allMessages: true,
    sessions: [...sessions.values()].map(s => apiSessionSchema.parse({ ...s, title: s.title ?? 'Untitled session', directory: s.location.directory })) }
}

export async function v2Messages(id: string) {
  const raw = await readPages(`/api/session/${encodeURIComponent(id)}/message`)
  if (raw instanceof Error) return raw
  const data = normalizeV2Messages(raw)
  if (data instanceof Error) return data
  const truncated = z.array(messageSchema).parse(raw).some(m => m.type === 'shell' && m.output?.truncated)
  return { data, truncated }
}
