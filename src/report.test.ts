import fs from 'node:fs/promises'
import path from 'node:path'
import childProcess from 'node:child_process'
import util from 'node:util'
import { expect, test } from 'vitest'
import { fixture } from './fixtures.ts'
import { buildReport } from './report.ts'
import { renderHtml } from './render.ts'
import { midnight, resolveWeek } from './time.ts'

const execFile = util.promisify(childProcess.execFile)
test('normalized report matches the Python renderer on synthetic evidence', async () => {
  const root = path.resolve('weeks/.verification')
  await fs.mkdir(root, { recursive: true })
  const tmp = await fs.mkdtemp(path.join(root, 'parity-'))
  await fs.mkdir(path.join(tmp, 'evidence'))
  await fs.mkdir(path.join(tmp, 'weeks'))
  await fs.symlink(path.resolve('helpers'), path.join(tmp, 'helpers'))
  await fs.symlink(path.resolve('fonts'), path.join(tmp, 'fonts'))
  const evidence = fixture()
  const file = path.join(tmp, 'input.json')
  await fs.writeFile(file, JSON.stringify(evidence))
  const python = await execFile('python', ['-c',
    'import sys,json,pathlib,contextlib,io;sys.path.insert(0,sys.argv[1]);import generate;generate.ROOT=pathlib.Path(sys.argv[2]);d=json.loads(pathlib.Path(sys.argv[3]).read_text());out=io.StringIO();\nwith contextlib.redirect_stdout(out): result=generate.build(d)\nprint(json.dumps(result))',
    path.resolve('helpers'), tmp, file])
  const reference = JSON.parse(python.stdout) as Record<string, object>
  const report = buildReport({ evidence })
  expect(report).not.toBeInstanceOf(Error)
  if (report instanceof Error) return
  const { theme: _theme, dates: _dates, ...actual } = report.data
  // Coverage wording removes the baseline's hardcoded "two registered projects".
  reference.notes = actual.notes
  expect(actual).toEqual(reference)
  const html = await renderHtml(report.data)
  expect(html).not.toBeInstanceOf(Error)
  if (html instanceof Error) return
  expect(html).toContain('data:font/woff2;base64,')
  expect(html).toContain('SIL OPEN FONT LICENSE')
  expect(html).not.toContain('__DATA__')
  await fs.writeFile(path.join(root, 'synthetic.html'), html)
  await fs.writeFile(path.join(root, 'synthetic.json'), JSON.stringify(evidence))
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
