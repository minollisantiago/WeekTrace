import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { readJson } from './io.ts'
import { DEFAULT_TIMEZONE, resolveWeek } from './time.ts'
import { CalendarError, boundary } from './errors.ts'

export const configSchema = z.object({
  timezone: z.string().optional(), projects: z.array(z.string()).optional(),
  outputDir: z.string().optional(), api: z.url().optional(),
  excludeSessions: z.array(z.string()).optional(),
  theme: z.enum(['Pink', 'Lavender', 'Blue', 'Green', 'Peach']).optional(),
}).strict()
export interface Options {
  week?: string; previousWeek?: boolean; timezone?: string; project?: string[];
  dataDir?: string; outputDir?: string; api?: string; excludeSession?: string[];
  summary?: string; theme?: string
}
export async function resolveConfig({ options, cwd }: { options: Options; cwd: string }) {
  const dataDir = path.resolve(cwd, options.dataDir ?? path.join(os.homedir(), '.calendar'))
  const config = await readJson({ file: path.join(dataDir, 'config.json'), schema: configSchema, optional: true })
  if (config instanceof Error) return config
  const timezone = options.timezone ?? config?.timezone ?? DEFAULT_TIMEZONE
  const resolved = resolveWeek({ week: options.week, previousWeek: options.previousWeek, timezone })
  if (resolved instanceof Error) return resolved
  const api = options.api ?? config?.api ?? null
  if (api) {
    const url = boundary(() => new URL(api), 'Invalid --api URL. Use http://127.0.0.1:PORT.')
    if (url instanceof Error) return url
    if (!['http:', 'https:'].includes(url.protocol)) return new CalendarError({ reason: 'Use an HTTP(S) --api URL.' })
  }
  return { ...resolved, dataDir, outputDir: path.resolve(cwd, options.outputDir ?? config?.outputDir ?? path.join(dataDir, 'weeks')),
    projects: (options.project ?? config?.projects ?? []).map(p => path.resolve(cwd, p)), api,
    excludeSessions: options.excludeSession ?? config?.excludeSessions ?? [],
    summary: options.summary ? path.resolve(cwd, options.summary) : path.join(dataDir, 'evidence', `${resolved.week}-summary.json`),
    theme: options.theme ?? config?.theme ?? 'Pink' }
}
export type Config = Exclude<Awaited<ReturnType<typeof resolveConfig>>, Error>
