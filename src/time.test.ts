import { describe, expect, test } from 'vitest'
import { hours, intervals, merge, midnight, resolveWeek, splitDays, DEFAULT_TIMEZONE } from './time.ts'
import { safeJson } from './render.ts'

describe('Python timing reference cases', () => {
  test('overlaps and adjacent intervals count once', () => {
    expect(merge([[0, 10], [5, 20], [20, 30], [50, 60]])).toEqual([[0, 30], [50, 60]])
    expect(hours([[0, 3_600_000], [1_800_000, 5_400_000]])).toBe(1.5)
  })
  test('exact 30-minute gap joins; isolated events remain zero-duration', () => {
    expect(intervals({ events: [0, 1_800_000, 3_600_001], start: 0, end: 4_000_000 })).toEqual([[0, 1_800_000], [3_600_001, 3_600_001]])
    expect(hours([[10, 10]])).toBe(0)
  })
  test('inclusive start, exclusive end and boundary clipping', () => {
    expect(intervals({ events: [-100, 100, 900, 1100], start: 0, end: 1000 })).toEqual([[0, 1000]])
    expect(intervals({ events: [1000], start: 0, end: 1000 })).toEqual([])
  })
  test('split at local midnight without adding hours', () => {
    const a = midnight('2026-10-06', DEFAULT_TIMEZONE) - 600_000
    const parts = splitDays({ range: [a, a + 1_200_000], timezone: DEFAULT_TIMEZONE })
    expect(parts.map(([x, y]) => y - x)).toEqual([600_000, 600_000])
    expect(hours(parts)).toBe(1 / 3)
  })
  test('embedded JSON escapes script termination', () => {
    const value = { prompt: '</script><img src=x onerror=alert(1)>&\u2028' }
    expect(safeJson(value)).not.toContain('<')
    expect(JSON.parse(safeJson(value))).toEqual(value)
  })
})

describe('timezone-aware weeks', () => {
  test.each([['2026-03-02', 167], ['2026-10-26', 169]])('DST week %s has %i elapsed hours', (week, elapsed) => {
    const resolved = resolveWeek({ week, timezone: 'America/New_York' })
    expect(resolved).not.toBeInstanceOf(Error)
    if (resolved instanceof Error) return
    expect((resolved.end - resolved.start) / 3_600_000).toBe(elapsed)
  })
  test('previous week resolves in the requested zone at the Monday boundary', () => {
    const now = Date.parse('2026-10-12T00:30:00Z')
    const west = resolveWeek({ previousWeek: true, timezone: DEFAULT_TIMEZONE, now })
    const east = resolveWeek({ previousWeek: true, timezone: 'Pacific/Kiritimati', now })
    expect(west).toMatchObject({ week: '2026-09-28' })
    expect(east).toMatchObject({ week: '2026-10-05' })
  })
  test('invalid/ambiguous week requests fail with actionable errors', () => {
    for (const options of [{}, { week: '2026-10-06' }, { week: '2026-10-05', previousWeek: true }, { week: '../../secret' }]) {
      expect(resolveWeek({ timezone: DEFAULT_TIMEZONE, ...options })).toBeInstanceOf(Error)
    }
    expect(resolveWeek({ week: '2026-10-05', timezone: 'Invalid/Zone' })).toBeInstanceOf(Error)
  })
})
