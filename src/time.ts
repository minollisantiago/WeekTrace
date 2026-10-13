import { Temporal } from '@js-temporal/polyfill'
import { boundary, CalendarError } from './errors.ts'

export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires'
export const GAP = 30 * 60_000
export type Range = [number, number]

export function midnight(date: string, timezone: string) {
  return Temporal.PlainDate.from(date).toZonedDateTime(timezone).epochMilliseconds
}
export function localDate(timestamp: number, timezone: string) {
  return Temporal.Instant.fromEpochMilliseconds(Math.trunc(timestamp)).toZonedDateTimeISO(timezone).toPlainDate()
}
export function resolveWeek({ week, previousWeek, timezone, now = Date.now() }: {
  week?: string; previousWeek?: boolean; timezone: string; now?: number
}) {
  if (Boolean(week) === Boolean(previousWeek)) return new CalendarError({
    reason: 'Choose exactly one: --week YYYY-MM-DD (Monday) or --previous-week.',
  })
  return boundary(() => {
    const today = localDate(now, timezone)
    const date = week ? Temporal.PlainDate.from(week) : today.subtract({ days: today.dayOfWeek - 1 + 7 })
    if (date.dayOfWeek !== 1 || (week && date.toString() !== week)) return new CalendarError({
      reason: 'The week must be a Monday in YYYY-MM-DD format. Rerun with --previous-week or a reporting Monday.',
    })
    const monday = date.toString()
    return { week: monday, timezone, start: midnight(monday, timezone),
      end: midnight(date.add({ days: 7 }).toString(), timezone) }
  }, 'Invalid date or timezone. Use --week YYYY-MM-DD and an IANA --timezone such as Europe/London.')
}
export function intervals({ events, start, end }: { events: number[]; start: number; end: number }): Range[] {
  const groups: number[][] = []
  for (const event of [...new Set(events)].sort((a, b) => a - b)) {
    const last = groups.at(-1)
    if (!last || event - last.at(-1)! > GAP) groups.push([event])
    else last.push(event)
  }
  return groups.filter(g => g.at(-1)! >= start && g[0]! < end)
    .map(g => [Math.max(g[0]!, start), Math.min(g.at(-1)!, end)] as Range)
    .filter(([a, b]) => b >= a)
}
export function merge(ranges: Range[]): Range[] {
  const result: Range[] = []
  for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0] || x[1] - y[1])) {
    if (b <= a) continue
    const last = result.at(-1)
    if (last && a <= last[1]) last[1] = Math.max(b, last[1])
    else result.push([a, b])
  }
  return result
}
export const hours = (ranges: Range[]) => merge(ranges).reduce((sum, [a, b]) => sum + b - a, 0) / 3_600_000
export function splitDays({ range: [a, b], timezone }: { range: Range; timezone: string }): Range[] {
  if (a === b) return [[a, b]]
  const pieces: Range[] = []
  for (let cursor = a; cursor < b;) {
    const next = midnight(localDate(cursor, timezone).add({ days: 1 }).toString(), timezone)
    const stop = Math.min(b, next)
    pieces.push([cursor, stop])
    cursor = stop
  }
  return pieces
}
export function resolveRange({ week, previousWeek, from, to, lastDays, timezone, now = Date.now() }: {
  week?: string; previousWeek?: boolean; from?: string; to?: string; lastDays?: number; timezone: string; now?: number
}) {
  const custom = from !== undefined || to !== undefined
  const modes = Number(week !== undefined) + Number(Boolean(previousWeek)) + Number(custom) + Number(lastDays !== undefined)
  if (modes !== 1) return new CalendarError({ reason: 'Choose exactly one: --week YYYY-MM-DD, --previous-week, --from YYYY-MM-DD --to YYYY-MM-DD, or --last-days 1..7.' })
  if (!custom && lastDays === undefined) return resolveWeek({ week, previousWeek, timezone, now })
  if (custom && (from === undefined || to === undefined)) return new CalendarError({ reason: 'Supply both --from YYYY-MM-DD and --to YYYY-MM-DD (inclusive).' })
  if (lastDays !== undefined && (!Number.isInteger(lastDays) || lastDays < 1 || lastDays > 7)) return new CalendarError({ reason: 'Use --last-days with an integer from 1 to 7, including today.' })
  return boundary(() => {
    const last = custom ? Temporal.PlainDate.from(to!) : localDate(now, timezone)
    const first = custom ? Temporal.PlainDate.from(from!) : last.subtract({ days: lastDays! - 1 })
    if (custom && (first.toString() !== from || last.toString() !== to)) return new CalendarError({ reason: 'Use --from and --to dates in exact YYYY-MM-DD format.' })
    const days = first.until(last).days + 1
    if (days < 1 || days > 7) return new CalendarError({ reason: 'Report ranges must contain 1 to 7 inclusive calendar days. Set --to on or within six days after --from.' })
    return { week: first.toString(), timezone, start: midnight(first.toString(), timezone),
      end: midnight(last.add({ days: 1 }).toString(), timezone) }
  }, 'Invalid range or timezone. Use --from YYYY-MM-DD --to YYYY-MM-DD and an IANA --timezone.')
}
export function dayBoundaries({ week, timezone, end }: { week: string; timezone: string; end?: number }) {
  const date = Temporal.PlainDate.from(week)
  const days = end === undefined ? 7 : date.until(localDate(end, timezone)).days
  return Array.from({ length: days + 1 }, (_, i) => midnight(date.add({ days: i }).toString(), timezone))
}
