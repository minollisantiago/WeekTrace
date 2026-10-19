import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from 'vitest'
import { cli } from './commands.ts'
import { run } from './run.ts'
import { fixture } from './fixtures.ts'
import { resolveConfig } from './config.ts'

test('CLI keeps repeatable source and reporting-session selections', async () => {
  const parsed = await cli.clone().parse(['node', 'weektrace', 'report', '--week', '2026-10-05',
    '--project', '/one', '--project', '/two', '--exclude-session', 'ses_one', '--exclude-session', 'ses_two'], { run: false })
  expect(parsed.options).toMatchObject({ week: '2026-10-05', project: ['/one', '/two'], excludeSession: ['ses_one', 'ses_two'] })
})
test('CLI parses custom and rolling selections for every stage', async () => {
  for (const mode of ['report', 'collect', 'render']) {
    const rolling = await cli.clone().parse(['node', 'weektrace', mode, '--last-days', '7'], { run: false })
    expect(rolling.options.lastDays).toBe(7)
    const range = await cli.clone().parse(['node', 'weektrace', mode, '--from', '2026-10-07', '--to', '2026-10-13'], { run: false })
    expect(range.options).toMatchObject({ from: '2026-10-07', to: '2026-10-13' })
  }
})

test('custom cached ranges use distinct filenames and reject mismatched boundaries', async () => {
  const root = path.resolve('weeks/.verification')
  await fs.mkdir(root, { recursive: true })
  const dataDir = await fs.mkdtemp(path.join(root, 'range-cli-'))
  const options = { dataDir, from: '2026-10-05', to: '2026-10-06' }
  const config = await resolveConfig({ options, cwd: '/' })
  if (config instanceof Error) throw config
  expect(config.reportKey).toBe('2026-10-05_to_2026-10-06')
  expect(config.summary).toContain('2026-10-05_to_2026-10-06-summary.json')
  const source = { ...fixture(), start: config.start, end: config.end }
  await fs.mkdir(path.join(dataDir, 'evidence'))
  const file = path.join(dataDir, 'evidence', `${config.reportKey}.json`)
  await fs.writeFile(file, JSON.stringify(source))
  const result = await run({ mode: 'render', cwd: '/', options })
  if (result instanceof Error) throw result
  if (!('html' in result)) throw new Error('Expected rendered output')
  expect(result.html).toContain(`${config.reportKey}.html`)
  await fs.writeFile(file, JSON.stringify(fixture()))
  expect(await run({ mode: 'render', cwd: '/', options })).toBeInstanceOf(Error)
})
test('render validates config, curated summaries, filtering and output independently of source cwd', async () => {
  const root = path.resolve('weeks/.verification')
  await fs.mkdir(root, { recursive: true })
  const dataDir = await fs.mkdtemp(path.join(root, 'cli-'))
  await fs.mkdir(path.join(dataDir, 'evidence'))
  const evidence = fixture()
  const project = path.resolve('/synthetic/app')
  evidence.projects[0]!.directory = project
  for (const session of evidence.sessions.filter(s => s.project === evidence.projects[0]!.folder_name)) {
    session.directory = project
    if (session.projectDirectory) session.projectDirectory = project
  }
  evidence.inventory[0]!.project = project
  evidence.commits[0]!.repository = project
  await fs.writeFile(path.join(dataDir, 'evidence', `${evidence.week}.json`), JSON.stringify(evidence))
  const result = await run({ mode: 'render', cwd: '/', options: { dataDir, week: evidence.week,
    project: [project], excludeSession: ['ses_isolated'] } })
  expect(result).not.toBeInstanceOf(Error)
  if (result instanceof Error) throw result
  if (!('html' in result)) throw new Error('Expected rendered output')
  expect(result.sessions).toBe(2)
  expect(result.html).toContain(dataDir)
  const html = await fs.readFile(result.html!, 'utf8')
  expect(html).not.toContain('ses_two')
  expect(html).not.toContain('ses_isolated')
  await fs.writeFile(path.join(dataDir, 'config.json'), JSON.stringify({ timezone: 'UTC', theme: 'Green', projects: [project] }))
  const config = await resolveConfig({ cwd: '/', options: { dataDir, week: evidence.week, timezone: evidence.timezone, theme: 'Blue' } })
  expect(config).toMatchObject({ timezone: evidence.timezone, theme: 'Blue', projects: [project] })
  const invalid = await run({ mode: 'render', cwd: '/', options: { dataDir, week: evidence.week } })
  expect(invalid).toBeInstanceOf(Error)
  const summary = path.join(dataDir, 'evidence', 'curated.json')
  await fs.writeFile(summary, JSON.stringify({ lines: ['One', 'Two', 'Three'], followups: [{ id: 'ses_one', text: 'Explicit synthetic follow-up' }] }))
  expect(await run({ mode: 'render', cwd: '/', options: { dataDir, week: evidence.week, timezone: evidence.timezone, summary } })).not.toBeInstanceOf(Error)
  await fs.writeFile(summary, JSON.stringify({ lines: ['Only one'], followups: [] }))
  expect(await run({ mode: 'render', cwd: '/', options: { dataDir, week: evidence.week, timezone: evidence.timezone, summary } })).toBeInstanceOf(Error)
})
