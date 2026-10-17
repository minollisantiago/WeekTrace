import { z } from 'zod'
import { usageRecordSchema } from './usage.ts'

export const projectSchema = z.object({
  directory: z.string(), folder_name: z.string(), is_local: z.boolean(),
  guild_id: z.string().default(''), gitAvailable: z.boolean().optional(),
  worktrees: z.array(z.string()).optional(), repository: z.string().optional(),
})
export const sessionSchema = z.object({
  id: z.string(), title: z.string(), directory: z.string(), project: z.string(),
  projectDirectory: z.string().optional(), guild: z.string().default(''),
  thread: z.string().nullable().default(null), models: z.array(z.string()),
  prompt: z.string(), events: z.array(z.number().finite()), finals: z.array(z.string()),
  recordedHashes: z.array(z.string()), statusNow: z.string(),
  parent: z.string().nullable().optional(), branchHints: z.array(z.string()).default([]),
  commitBranches: z.array(z.object({ branch: z.string(), hash: z.string() })).default([]),
  critiqueLinks: z.array(z.object({ url: z.string().regex(/^https:\/\/critique\.work\/v\/[A-Za-z0-9_-]+$/), time: z.number().finite() })).optional(),
})
export const commitSchema = z.object({
  repository: z.string(), hash: z.string(), time: z.number(), subject: z.string(),
  files: z.array(z.string()), linked: z.array(z.object({ id: z.string(), basis: z.string() })),
  possible: z.array(z.string()),
  stats: z.object({ added: z.number().int().nonnegative(), deleted: z.number().int().nonnegative(), binary: z.number().int().nonnegative() }).optional(),
})
export const evidenceSchema = z.object({
  schemaVersion: z.literal(1).optional(), week: z.string(), timezone: z.string(),
  usage: z.array(usageRecordSchema).optional(),
  start: z.number().finite(), end: z.number().finite(), projects: z.array(projectSchema),
  sessions: z.array(sessionSchema), commits: z.array(commitSchema), gaps: z.array(z.string()),
  inventory: z.array(z.object({ project: z.string(), sessions: z.number(),
    kimakiListed: z.number(), excludedSubagents: z.number().default(0) })), method: z.string(),
})
export const summarySchema = z.object({
  lines: z.array(z.string().min(1).max(1800).refine(s => !/[\r\n]/.test(s), 'Use three single lines')).length(3),
  followups: z.array(z.object({ id: z.string(), text: z.string().min(1).max(900) })),
})
export type Project = z.infer<typeof projectSchema>
export type Session = z.infer<typeof sessionSchema>
export type Commit = z.infer<typeof commitSchema>
export type Evidence = z.infer<typeof evidenceSchema>
export type Summary = z.infer<typeof summarySchema>
