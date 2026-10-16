import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from 'vitest'
import { fixture } from './fixtures.ts'
import { buildReport } from './report.ts'
import { renderHtml } from './render.ts'
import { midnight, resolveWeek, resolveRange } from './time.ts'
import { baselineReport } from './baseline-report.fixture.ts'

test('normalized report matches the frozen reference on synthetic evidence', async () => {
  const root = path.resolve('weeks/.verification')
  await fs.mkdir(root, { recursive: true })
  const evidence = fixture()
  // Pin the historical colors so the frozen timing/attribution baseline stays intact.
  const report = buildReport({ evidence, colors: Object.fromEntries(baselineReport.projects.map(p => [p.directory, p.color])) })
  expect(report).not.toBeInstanceOf(Error)
  if (report instanceof Error) return
  // Branding/date additions and evolved coverage prose are outside baseline parity.
  const { theme: _theme, dates: _dates, notes: _notes, ...actual } = report.data
  expect(actual).toEqual(baselineReport)
  const html = await renderHtml(report.data)
  expect(html).not.toBeInstanceOf(Error)
  if (html instanceof Error) return
  expect(html).toContain('data:font/woff2;base64,')
  expect(html).toContain('SIL OPEN FONT LICENSE')
  expect(html).not.toContain('__DATA__')
  expect(html).not.toContain('Your agent work, week by week.')
  expect(html).not.toContain('class="identity"')
  expect(html).toContain('id="appearance-toggle"')
  expect(html).toContain('id="theme-picker"')
  await fs.writeFile(path.join(root, 'synthetic.html'), html)
  await fs.writeFile(path.join(root, 'synthetic.json'), JSON.stringify(evidence))
})
test('project colors exhaust the picker palette, stay unique, and persist across reordered reports', async () => {
  const evidence = fixture()
  evidence.projects = Array.from({ length: 9 }, (_, i) => ({ ...evidence.projects[0]!, directory: `/synthetic/project-${i}`, folder_name: `Project ${i}` }))
  evidence.sessions = evidence.projects.map((p, i) => ({ ...evidence.sessions[0]!, id: `ses_color_${i}`, project: p.folder_name,
    directory: p.directory, projectDirectory: p.directory }))
  const result = buildReport({ evidence })
  if (result instanceof Error) throw result
  expect(result.data.projects.slice(0, 5).map(p => p.color)).toEqual(['#F77C9D', '#B1A7F2', '#88C1F2', '#8FD9AF', '#F2BE7E'])
  expect(new Set(result.data.projects.map(p => p.color.toLowerCase())).size).toBe(9)
  expect(result.data.sessions.map(s => s.color)).toEqual(result.data.projects.map(p => p.color))
  const reordered = buildReport({ evidence: { ...evidence, projects: [...evidence.projects].reverse() }, colors: result.colors })
  if (reordered instanceof Error) throw reordered
  expect(reordered.colors).toEqual(result.colors)
  const custom = buildReport({ evidence, colors: { '/synthetic/project-5': '#93E1ED', '/synthetic/project-6': '#93e1ed' } })
  if (custom instanceof Error) throw custom
  expect(custom.data.projects[5]!.color).toBe('#93E1ED')
  expect(new Set(custom.data.projects.map(p => p.color.toLowerCase())).size).toBe(9)
  const html = await renderHtml(result.data)
  if (html instanceof Error) throw html
  await fs.writeFile('weeks/.verification/project-colors.html', html)
})
test('inactive projects are hidden while isolated in-range activity stays visible', () => {
  const evidence = fixture()
  evidence.sessions = [{ ...evidence.sessions[0]!, events: [evidence.start - 3_600_000] },
    { ...evidence.sessions.find(s => s.project === 'Research')!, events: [evidence.start + 600_000] }]
  const result = buildReport({ evidence })
  if (result instanceof Error) throw result
  expect(result.data.projects.map(p => p.name)).toEqual(['Research'])
  expect(result.data.projects[0]!.hours).toBe(0)
  expect(result.data.projects[0]!.color).toBe('#F77C9D')
  expect(result.data.sessions).toHaveLength(1)
  expect(result.data.blocks).toHaveLength(1)
  expect(result.data.branches.some(b => b.project === 'App')).toBe(false)
  expect(result.data.inventory.some(p => p.project === '/synthetic/app')).toBe(false)
  const empty = buildReport({ evidence: { ...evidence, sessions: [] }, colors: result.colors })
  if (empty instanceof Error) throw empty
  expect(empty.data.projects).toEqual([])
  expect(empty.colors).toEqual(result.colors)
})
test('DST daily totals use local midnight, not fixed 24-hour slices', () => {
  const week = resolveWeek({ week: '2026-03-02', timezone: 'America/New_York' })
  if (week instanceof Error) throw week
  const evidence = { ...fixture(), ...week }
  const start = midnight('2026-03-08', week.timezone)
  evidence.sessions = [{ ...evidence.sessions[0]!, events: Array.from({ length: 47 }, (_, i) => start + i * 30 * 60_000) }]
  const result = buildReport({ evidence })
  if (result instanceof Error) throw result
  expect(result.data.daily).toEqual([0, 0, 0, 0, 0, 0, 23])
  expect(result.data.hours).toBe(23)
})
test('isolated/overlapping events affect visuals but never inflate activity', () => {
  const result = buildReport({ evidence: fixture() })
  if (result instanceof Error) throw result
  expect(result.data.hours).toBeCloseTo(0.75 + 1 / 3)
  expect(result.data.blocks.find(b => b.session === 'ses_isolated')?.duration).toBe(0)
  expect(result.data.blocks.filter(b => b.session === 'ses_midnight')).toHaveLength(2)
  expect(result.data.projects.reduce((h, p) => h + p.hours, 0)).toBeGreaterThan(result.data.hours)
})
test('invalid curated follow-ups cannot create broken inspection links', () => {
  expect(buildReport({ evidence: fixture(), summary: { lines: ['One', 'Two', 'Three'], followups: [{ id: 'missing', text: 'Follow up' }] } })).toBeInstanceOf(Error)
})
test('far-eastern timezone date labels refer to local dates, not fixed Buenos Aires offsets', async () => {
  const original = fixture()
  const week = resolveWeek({ week: original.week, timezone: 'Pacific/Kiritimati' })
  if (week instanceof Error) throw week
  const evidence = { ...original, ...week, sessions: original.sessions.map(s => ({ ...s,
    events: s.events.map(t => t + week.start - original.start) })) }
  const result = buildReport({ evidence, theme: 'Peach' })
  if (result instanceof Error) throw result
  expect(result.data.dates.map(t => new Intl.DateTimeFormat('en-US', { timeZone: week.timezone, day: 'numeric' }).format(t)))
    .toEqual(['5', '6', '7', '8', '9', '10', '11'])
  const html = await renderHtml(result.data)
  if (html instanceof Error) throw html
  const root = path.resolve('weeks/.verification')
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(path.join(root, 'timezone.html'), html)
})
test('empty and malicious-text reports stay portable and safely serialized', async () => {
  const evidence = fixture()
  evidence.sessions[0]!.prompt = '</script><img src=x onerror=alert(1)>__FONT__'
  const result = buildReport({ evidence })
  if (result instanceof Error) throw result
  const html = await renderHtml(result.data)
  if (html instanceof Error) throw html
  expect(html).not.toContain('<img src=x')
  expect(html).toContain('\\u003c/script\\u003e')
  expect(html).toContain('__FONT__')
  const empty = buildReport({ evidence: { ...evidence, sessions: [], commits: [], gaps: [] } })
  if (empty instanceof Error) throw empty
  expect(empty.data.hours).toBe(0)
  expect(empty.data.daily).toEqual([0, 0, 0, 0, 0, 0, 0])
})

test.each([1, 3, 7])('custom %i-day report clips totals and generates only selected dates', async days => {
  const range = resolveRange({ from: '2026-10-07', to: `2026-10-${String(6 + days).padStart(2, '0')}`, timezone: 'UTC' })
  if (range instanceof Error) throw range
  const original = fixture()
  const evidence = { ...original, ...range, sessions: [{ ...original.sessions[0]!, events: [
    range.start - 600_000, range.start + 600_000, range.end - 600_000, range.end + 600_000,
  ] }] }
  const result = buildReport({ evidence })
  if (result instanceof Error) throw result
  expect(result.data.daily).toHaveLength(days)
  expect(result.data.dates).toHaveLength(days)
  expect(result.data.hours).toBeCloseTo(1 / 3)
  expect(result.data.blocks.map(b => b.day)).toEqual([0, days - 1])
  const html = await renderHtml(result.data)
  if (html instanceof Error) throw html
  await fs.mkdir('weeks/.verification', { recursive: true })
  await fs.writeFile(`weeks/.verification/range-${days}.html`, html)
})
