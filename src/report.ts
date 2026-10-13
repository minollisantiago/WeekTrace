import { Temporal } from '@js-temporal/polyfill'
import { belongsTo, branchTotals, clean } from './evidence.ts'
import { CalendarError } from './errors.ts'
import type { Evidence, Summary } from './schema.ts'
import { dayBoundaries, hours, intervals, localDate, midnight, splitDays, type Range } from './time.ts'

export interface Block {
  session: string; day: number; start: number; end: number; minute: number; duration: number; lane: number; lanes: number
}
export function buildReport({ evidence: d, colors = {}, summary = null, theme = 'Pink' }: {
  evidence: Evidence; colors?: Record<string, string>; summary?: Summary | null; theme?: string
}) {
  const palette = ['#b9a9f4', '#9edcc6', '#a4ccf5', '#f5cc9a', '#eeb8d0', '#9ed9df']
  const boundaries = dayBoundaries(d)
  const dayCount = boundaries.length - 1
  const period = dayCount === 7 && Temporal.PlainDate.from(d.week).dayOfWeek === 1 ? 'week' : 'range'
  if (dayCount < 1 || dayCount > 7 || boundaries[0] !== d.start || boundaries.at(-1) !== d.end) return new CalendarError({
    reason: 'Evidence must cover 1 to 7 whole local calendar days. Recollect with --last-days 7 or a valid --from/--to range.',
  })
  const projectColors = { ...colors }
  const blocks: Block[] = []
  const allRanges: Range[] = []
  const seen = new Set<string>()
  const sourceSessions = d.sessions.filter(s => !seen.has(s.id) && Boolean(seen.add(s.id)))
  const sessions = [] as Array<Omit<Evidence['sessions'][number], 'events' | 'recordedHashes' | 'finals' | 'commitBranches'> & {
    color: string; outcome: string; status: string; commits: Evidence['commits']; possible: Evidence['commits']; estimatedHours: number
  }>
  const uniqueCommits = [...new Map(d.commits.map(c => [JSON.stringify([c.repository, c.hash]), c])).values()]
  const projects = d.projects.filter(p => p.is_local).map(p => {
    projectColors[p.directory] ??= palette[Object.keys(projectColors).length % palette.length]!
    const color = projectColors[p.directory]!
    const ranges: Range[] = []
    const projectSessions = sourceSessions.filter(session => belongsTo({ session, directory: p.directory, name: p.folder_name }))
    for (const s of projectSessions) {
      const linked = uniqueCommits.filter(c => c.linked.some(l => l.id === s.id))
      const possible = uniqueCommits.filter(c => c.possible.includes(s.id) && !c.linked.length)
      const rs = intervals({ events: s.events, start: d.start, end: d.end })
      ranges.push(...rs)
      const outcome = s.finals.at(-1) ?? `No final response recorded in the reporting ${period}; outcome unknown.`
      const status = !p.gitAvailable ? 'Git evidence unavailable' : linked.length ? `${linked.length} linked commits`
        : s.statusNow === 'busy' ? 'Active now · no linked commits'
          : !s.finals.length ? 'No final recorded · no linked commits' : 'No linked commits'
      const { events: _events, recordedHashes: _hashes, finals: _finals, commitBranches: _branches, ...entry } = s
      sessions.push({ ...entry, title: clean(entry.title, 900), prompt: clean(entry.prompt, 900), color,
        outcome: clean(outcome, 1800), status, commits: linked, possible, estimatedHours: hours(rs) })
      for (const range of rs) {
        for (const [x, y] of splitDays({ range, timezone: d.timezone })) {
          const date = localDate(x, d.timezone)
          const day = Temporal.PlainDate.from(d.week).until(date).days
          if (day < 0 || day >= dayCount) continue
          // Use wall-clock position on the 24-hour grid; elapsed duration remains actual time.
          const zoned = Temporal.Instant.fromEpochMilliseconds(Math.trunc(x)).toZonedDateTimeISO(d.timezone)
          blocks.push({ session: s.id, day, start: x, end: y,
            minute: zoned.hour * 60 + zoned.minute + zoned.second / 60 + zoned.millisecond / 60_000,
            duration: (y - x) / 60_000, lane: 0, lanes: 1 })
        }
      }
    }
    allRanges.push(...ranges)
    return { name: p.folder_name, directory: p.directory, color, hours: hours(ranges),
      gitAvailable: p.gitAvailable ?? false, sessions: projectSessions.length }
  })
  for (let day = 0; day < dayCount; day++) {
    const groups: Array<{ end: number; blocks: Block[] }> = []
    for (const block of blocks.filter(b => b.day === day).sort((a, b) => a.minute - b.minute)) {
      const end = block.minute + Math.max(28, block.duration)
      const last = groups.at(-1)
      if (!last || block.minute >= last.end) groups.push({ end, blocks: [block] })
      else { last.blocks.push(block); last.end = Math.max(last.end, end) }
    }
    for (const group of groups) {
      const ends: number[] = []
      for (const block of group.blocks) {
        const available = ends.findIndex(end => end <= block.minute)
        const lane = available === -1 ? ends.length : available
        ends[lane] = block.minute + Math.max(28, block.duration)
        block.lane = lane
      }
      for (const block of group.blocks) block.lanes = ends.length
    }
  }
  const daily = Array.from({ length: dayCount }, (_, i) => hours(allRanges.map(([a, b]) =>
    [Math.max(a, boundaries[i]!), Math.min(b, boundaries[i + 1]!)])))
  const notes = [...d.gaps]
  const missing = sessions.filter(s => !s.thread).length
  if (missing) notes.push(`${missing} of ${sessions.length} sessions have no original Discord thread ID in available metadata/prompts.`)
  notes.push(`Only locally retained OpenCode activity in the ${projects.length} selected registered projects is covered; deleted logs, other machines and other agent harnesses are outside this report.`,
    'Subagent sessions represented by parents are excluded; independent Kimaki review threads remain included. Delegated runtime without parent timestamp events can be undercounted.',
    `Latest response excerpts are self-reported outcomes as of the ${period} cutoff, not an independent shipping audit. Current idle status does not establish task completion. Historical prompts may be missing after compaction.`,
    'Repository/time-only commit matches are possible, not proven. Git commit dates use committer timestamps; unreachable/pruned commits cannot be recovered by --all.')
  const mostActive = [...projects].sort((a, b) => b.hours - a.hours)[0]
  const factual: Summary = summary ?? { lines: [
    `${sessions.length} sessions with recorded activity; inspect details for evidenced outcomes.`,
    `Most estimated session activity: ${sessions.length ? mostActive?.name ?? 'none' : 'none'}.`,
    'No follow-ups inferred automatically from commit absence.',
  ], followups: [] }
  if (factual.followups.some(f => !sessions.some(s => s.id === f.id))) return new CalendarError({
    reason: 'Summary follow-ups reference sessions outside this report. Correct --summary for the selected week/projects.',
  })
  const branches = branchTotals({ ...d, commits: uniqueCommits })
  const data = { week: d.week, timezone: d.timezone, theme, projects, sessions, blocks, daily,
    hours: hours(allRanges), commits: uniqueCommits.filter(c => c.linked.length).length,
    possibleCommits: uniqueCommits.filter(c => !c.linked.length).length, notes, method: d.method,
    inventory: d.inventory, summary: { lines: factual.lines.map(s => clean(s, 1800)),
      followups: factual.followups.map(f => ({ ...f, text: clean(f.text, 900) })) },
    branches: branches.rows, unattributedBranchCommits: branches.unknown,
    dates: boundaries.slice(0, dayCount).map(ms => ms + (midnight(localDate(ms, d.timezone).add({ days: 1 }).toString(), d.timezone) - ms) / 2) }
  return { data, colors: projectColors }
}
export type Report = Exclude<ReturnType<typeof buildReport>, Error>['data']
