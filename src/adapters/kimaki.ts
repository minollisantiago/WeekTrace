import { z } from 'zod'
import path from 'node:path'
import { command } from './process.ts'
import { boundary, CalendarError } from '../errors.ts'
import { projectSchema, type Project } from '../schema.ts'

const registrationSchema = z.array(z.object({
  directory: z.string().nullable(), folder_name: z.string().optional(),
  channel_name: z.string().optional(), is_local: z.boolean(), guild_id: z.string().optional(),
}))
const recentSchema = z.array(z.object({ id: z.string(), threadId: z.string().nullable().optional(), status: z.string().optional() }))
export type RecentSession = z.infer<typeof recentSchema>[number]
export function parseJsonOutput<T>({ output, schema }: { output: string; schema: z.ZodType<T> }) {
  const json = boundary(() => JSON.parse(output) as object, 'Kimaki returned invalid JSON. Update/check Kimaki and rerun project list --json.')
  if (json instanceof Error) return json
  const result = schema.safeParse(json)
  if (!result.success) return new CalendarError({ reason: 'Kimaki metadata has an unsupported shape. Check kimaki project list --json and update the adapter.' })
  return result.data
}
export async function registeredProjects(allowlist: string[]): Promise<Project[] | CalendarError> {
  const result = await command({ executable: 'kimaki', args: ['project', 'list', '--json'] })
  if (result instanceof Error) return result
  const registrations = parseJsonOutput({ output: result.stdout, schema: registrationSchema })
  if (registrations instanceof Error) return registrations
  const projects = registrations.filter(p => p.is_local && p.directory).map(p => projectSchema.parse({
    ...p, directory: path.resolve(p.directory!), folder_name: p.folder_name ?? p.channel_name ?? path.basename(p.directory!),
  }))
  const selected = projects.filter(p => !allowlist.length || allowlist.includes(p.directory))
  const missing = allowlist.filter(directory => !selected.some(p => p.directory === directory))
  if (missing.length) return new CalendarError({ reason: 'A --project path is not locally registered. Check kimaki project list --json and pass registered absolute directories.' })
  if (!selected.length) return new CalendarError({ reason: 'No local projects registered. Register a source with kimaki project add /absolute/path and rerun.' })
  return [...new Map(selected.map(p => [p.directory, p])).values()]
}
export function discoverApi(output: string): string | null {
  const port = output.match(/OpenCode server (?:on|at) port (\d+)/i)?.[1]
  if (port) return `http://127.0.0.1:${port}`
  const serverLine = output.split('\n').find(line => /opencode/i.test(line) && /https?:\/\//.test(line))
  return serverLine?.match(/https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):\d+/)?.[0] ?? null
}
export async function recentSessions(directory: string) {
  const result = await command({ executable: 'kimaki', args: ['session', 'list', '--project', directory, '--json'] })
  if (result instanceof Error) return result
  const sessions = parseJsonOutput({ output: result.stdout, schema: recentSchema })
  if (sessions instanceof Error) return sessions
  return { sessions, api: discoverApi(result.stderr) }
}
