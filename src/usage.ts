import { z } from 'zod'

const count = z.number().finite().nonnegative()
export const tokensSchema = z.object({
  input: count, output: count, reasoning: count,
  cache: z.object({ read: count, write: count }),
})
export const usageRecordSchema = z.object({
  session: z.string(), source: z.string(), id: z.string(), time: z.number().finite(),
  tokens: tokensSchema.optional(),
})
export type UsageRecord = z.infer<typeof usageRecordSchema>

// Reasoning is a provider-reported breakdown, not an extra additive category.
export function summarizeUsage(records: UsageRecord[]) {
  const unique = [...new Map(records.map(r => [JSON.stringify([r.source, r.id]), r])).values()]
  const result = { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 },
    total: 0, recorded: 0, missing: 0, delegated: 0 }
  for (const r of unique) {
    if (!r.tokens) { result.missing++; continue }
    result.recorded++
    if (r.source !== r.session) result.delegated++
    result.input += r.tokens.input; result.output += r.tokens.output; result.reasoning += r.tokens.reasoning
    result.cache.read += r.tokens.cache.read; result.cache.write += r.tokens.cache.write
  }
  result.total = result.input + result.output + result.cache.read + result.cache.write
  return result
}
export type Usage = ReturnType<typeof summarizeUsage>
