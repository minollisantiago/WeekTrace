import { z } from 'zod'
import { CalendarError } from '../errors.ts'
import { tokensSchema } from '../usage.ts'

const timingSchema = z.object({ created: z.number().optional(), completed: z.number().optional(),
  start: z.number().optional(), end: z.number().optional() })
export const apiSessionSchema = z.object({ id: z.string(), title: z.string(), directory: z.string(),
  parentID: z.string().optional(), time: z.object({ created: z.number(), updated: z.number() }) })
export type ApiSession = z.infer<typeof apiSessionSchema>
export const messagesSchema = z.array(z.object({
  info: z.object({ id: z.string().optional(), role: z.string(), time: timingSchema,
     tokens: tokensSchema.optional(), modelID: z.string().optional(), model: z.object({ modelID: z.string().optional() }).optional(), finish: z.string().optional() }),
  parts: z.array(z.object({ type: z.string(), time: timingSchema.optional(), text: z.string().optional(),
    synthetic: z.boolean().optional(), tool: z.string().optional(),
    state: z.object({ status: z.string(), time: timingSchema.optional(),
      input: z.object({ command: z.string().optional() }).passthrough().optional(), output: z.string().optional(),
    }).passthrough().optional(),
  }).passthrough()),
}))
export type Messages = z.infer<typeof messagesSchema>
const docSchema = z.object({ paths: z.record(z.string(), z.object({
  get: z.object({ parameters: z.array(z.object({ name: z.string(), in: z.string(),
    schema: z.object({ maximum: z.number().optional() }).passthrough().optional() })).default([]),
    description: z.string().optional(),
  }).optional(),
}).passthrough()) })

export async function getJson<T>({ base, route, query = {}, schema }: {
  base: string; route: string; query?: Record<string, string | number>; schema: z.ZodType<T>
}) {
  const url = new URL(route, base)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value))
  const response = await fetch(url, { signal: AbortSignal.timeout(180_000) })
    .catch(cause => new CalendarError({ reason: 'OpenCode request failed. Start the local server or pass --api http://127.0.0.1:PORT.', cause }))
  if (response instanceof Error) return response
  if (!response.ok) return new CalendarError({ reason: `OpenCode returned HTTP ${response.status}. Check the local server and rerun with --api.` })
  const raw = await (response.json() as Promise<object>).catch(cause => new CalendarError({ reason: 'Invalid OpenCode JSON. Check /doc and update the adapter.', cause }))
  if (raw instanceof Error) return raw
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return new CalendarError({ reason: 'Unsupported OpenCode response shape. Check /doc and update the adapter.' })
  return { data: parsed.data, truncated: /rel="?next/i.test(response.headers.get('link') ?? '') || response.headers.get('x-has-more') === 'true' }
}
export async function documentedApi(base: string) {
  const doc = await getJson({ base, route: '/doc', schema: docSchema })
  if (doc instanceof Error) return doc
  const sessions = doc.data.paths['/session']?.get
  const messagePath = Object.keys(doc.data.paths).find(p => /^\/session\/\{[^}]+\}\/message$/.test(p))
  const messages = messagePath ? doc.data.paths[messagePath]?.get : null
  if (!sessions || !messages) return new CalendarError({ reason: 'Required documented GET APIs are unavailable. Use a compatible OpenCode server with /session and session messages.' })
  const params = new Set(sessions.parameters.filter(p => p.in === 'query').map(p => p.name))
  if (!params.has('directory') || !params.has('limit')) return new CalendarError({ reason: 'OpenCode inventory lacks directory/limit support. Update the adapter for this server before collecting.' })
  const max = sessions.parameters.find(p => p.name === 'limit')?.schema?.maximum ?? 100_000
  return { scope: params.has('scope'), limit: Math.min(100_000, max),
    allMessages: /all messages/i.test(messages.description ?? '') }
}
