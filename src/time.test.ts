import { describe, expect, test } from 'vitest'
import { hours, intervals, merge, midnight, resolveWeek, resolveRange, dayBoundaries, splitDays, DEFAULT_TIMEZONE } from './time.ts'
import { safeJson } from './render.ts'

describe('Timing baseline cases', () => {
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

describe('bounded custom and rolling ranges', () => {
  test.each([['2026-10-07', '2026-10-13', 7], ['2026-10-13', '2026-10-13', 1],
    ['2026-12-29', '2027-01-04', 7]])('inclusive range %s to %s contains %i days', (from, to, days) => {
    const result = resolveRange({ from, to, timezone: DEFAULT_TIMEZONE })
    if (result instanceof Error) throw result
    expect(result.start).toBe(midnight(from, DEFAULT_TIMEZONE))
    expect(dayBoundaries(result)).toHaveLength(days + 1)
    expect(result.end - result.start).toBe(days * 86_400_000)
  })
  test.each([['2026-03-08', 23], ['2026-11-01', 25]])('one local DST day %s has %i hours', (date, elapsed) => {
    const result = resolveRange({ from: date, to: date, timezone: 'America/New_York' })
    if (result instanceof Error) throw result
    expect((result.end - result.start) / 3_600_000).toBe(elapsed)
    expect(dayBoundaries(result)).toHaveLength(2)
  })
  test('rolling dates include today in the requested timezone', () => {
    const now = Date.parse('2026-10-13T01:00:00Z')
    expect(resolveRange({ lastDays: 7, timezone: DEFAULT_TIMEZONE, now })).toMatchObject({ week: '2026-10-06',
      end: midnight('2026-10-13', DEFAULT_TIMEZONE) })
    expect(resolveRange({ lastDays: 1, timezone: 'Pacific/Kiritimati', now })).toMatchObject({ week: '2026-10-13' })
  })
  test('rejects oversized, reversed, malformed, incomplete and conflicting selections', () => {
    for (const options of [{ from: '2026-10-07', to: '2026-10-14' }, { from: '2026-10-13', to: '2026-10-07' },
      { from: '2026-02-30', to: '2026-03-01' }, { from: '2026-10-07' }, { to: '2026-10-13' },
      { from: '2026-10-07T00:00', to: '2026-10-13' }, { lastDays: 0 }, { lastDays: 8 }, { lastDays: 1.5 },
      { lastDays: NaN }, { lastDays: 7, previousWeek: true }, { lastDays: 7, week: '2026-10-05' },
      { lastDays: 7, from: '2026-10-07', to: '2026-10-13' }, {}]) {
      expect(resolveRange({ timezone: DEFAULT_TIMEZONE, ...options })).toBeInstanceOf(Error)
    }
  })
})
