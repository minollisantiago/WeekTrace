import fs from 'node:fs/promises'
import { expect, test } from 'vitest'
import { tokensSchema, summarizeUsage, type UsageRecord } from './usage.ts'
import { collectUsage, usageOwner } from './collect.ts'
import { normalizeV2Messages } from './adapters/opencode-v2.ts'
import { messagesSchema } from './adapters/opencode.ts'
import { fixture } from './fixtures.ts'
import { buildReport } from './report.ts'
import { renderHtml } from './render.ts'

const tokens = { input: 100, output: 20, reasoning: 7, cache: { read: 50, write: 10 } }
test('usage survives V2 and legacy normalization, including compaction and missing usage', () => {
  const messages = normalizeV2Messages([
    { id: 'one', type: 'assistant', time: { created: 10 }, tokens, content: [] },
    { id: 'two', type: 'compaction', time: { created: 20 }, tokens },
    { id: 'three', type: 'assistant', time: { created: 30 }, content: [] },
  ])
  if (messages instanceof Error) throw messages
  expect(messages[0]!.info.tokens).toEqual(tokens)
  expect(messagesSchema.parse([{ info: { role: 'assistant', time: { created: 10 }, tokens }, parts: [] }])[0]!.info.tokens).toEqual(tokens)
  const usage = collectUsage(messages, 'child', 'parent', 10, 30)
  expect(usage).toHaveLength(2)
  expect(summarizeUsage([...usage, ...usage])).toMatchObject({ total: 360, recorded: 2, missing: 0, delegated: 2, reasoning: 14 })
  expect(summarizeUsage(collectUsage(messages, 'child', 'parent', 30, 40))).toMatchObject({ total: 0, recorded: 0, missing: 1 })
  expect(tokensSchema.safeParse({ ...tokens, input: -1 }).success).toBe(false)
  expect(tokensSchema.safeParse({ ...tokens, output: Infinity }).success).toBe(false)
})
test('nested delegated calls belong to their root and excluded ancestors never leak usage', () => {
  const root = { id: 'root', title: 'Root', directory: '/app', time: { created: 0, updated: 1 } }
  const child = { ...root, id: 'child', parentID: 'root' }, grandchild = { ...root, id: 'grandchild', parentID: 'child' }
  expect(usageOwner(grandchild, [root, child, grandchild], new Set())).toBe('root')
  expect(usageOwner(grandchild, [root, child, grandchild], new Set(['root']))).toBeNull()
  expect(usageOwner(grandchild, [root, child, grandchild], new Set(['child']))).toBeNull()
  expect(usageOwner(child, [{ ...root, parentID: 'child' }, child], new Set())).toBeNull()
})
test('tokens split once at midnight, respect range cutoffs, sum projects/days and preserve frozen timing', async () => {
  const evidence = fixture(), s = evidence.sessions.find(s => s.id === 'ses_midnight')!
  const midnight = evidence.start + 24 * 3_600_000
  evidence.usage = s.events.map((time, i): UsageRecord => ({ session: s.id, source: s.id, id: String(i), time, tokens }))
  evidence.usage.push({ session: s.id, source: 'child', id: 'delegated', time: midnight, tokens },
    { session: s.id, source: s.id, id: 'missing', time: s.events[0]! },
    { session: s.id, source: s.id, id: 'out', time: evidence.end, tokens })
  const report = buildReport({ evidence })
  if (report instanceof Error) throw report
  const { data } = report
  expect(data.usage!.total).toBe((s.events.length + 1) * 180)
  expect(data.usage!.missing).toBe(1)
  expect(data.usage!.delegated).toBe(1)
  expect(data.blocks.reduce((sum, b) => sum + (b.usage?.total ?? 0), 0)).toBe(data.usage!.total)
  expect(data.blocks.filter(b => b.session === s.id).map(b => b.usage!.total)).toEqual([180, 360])
  expect(data.dailyUsage!.reduce((sum, u) => sum + u.total, 0)).toBe(data.usage!.total)
  expect(data.projects.reduce((sum, p) => sum + p.usage!.total, 0)).toBe(data.usage!.total)
  expect(data.hours).toBeCloseTo(0.75 + 1 / 3)
  const html = await renderHtml(data)
  if (html instanceof Error) throw html
  await fs.mkdir('weeks/.verification', { recursive: true })
  await fs.writeFile('weeks/.verification/tokens.html', html)
})
test('separated activity blocks do not repeat session totals or absorb delegated calls in gaps', () => {
  const evidence = fixture(), s = evidence.sessions[0]!, start = evidence.start
  s.events = [start + 600_000, start + 1_200_000, start + 7_200_000, start + 7_800_000]
  evidence.sessions = [s]
  evidence.usage = [600_000, 7_200_000, 3_600_000].map((offset, i) => ({
    session: s.id, source: i === 2 ? 'child' : s.id, id: String(i), time: start + offset, tokens,
  }))
  const report = buildReport({ evidence })
  if (report instanceof Error) throw report
  expect(report.data.blocks.map(b => b.usage!.total)).toEqual([180, 180])
  expect(report.data.sessions[0]!.usage!.total).toBe(540)
  expect(report.data.usage!.total).toBe(540)
})
test('old evidence stays valid and known zero is distinguishable from absent usage', () => {
  expect(summarizeUsage([]).recorded).toBe(0)
  expect(summarizeUsage([{ session: 's', source: 's', id: 'zero', time: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } }])).toMatchObject({ total: 0, recorded: 1, missing: 0 })
  const report = buildReport({ evidence: fixture() })
  if (report instanceof Error) throw report
  expect(report.data.usage).toBeUndefined()
})
test('an interval ending exactly at midnight cannot charge the next-day call to the prior day', () => {
  const evidence = fixture(), s = evidence.sessions[0]!, midnight = evidence.start + 24 * 3_600_000
  s.events = [midnight - 600_000, midnight]
  evidence.sessions = [s]
  evidence.usage = [{ session: s.id, source: s.id, id: 'midnight', time: midnight, tokens }]
  const report = buildReport({ evidence })
  if (report instanceof Error) throw report
  expect(report.data.blocks[0]!.usage!.total).toBe(0)
  expect(report.data.dailyUsage![1]!.total).toBe(180)
  expect(report.data.sessions[0]!.usage!.total).toBe(180)
})
