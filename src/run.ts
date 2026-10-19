import path from 'node:path'
import { samePath } from './paths.ts'
import { z } from 'zod'
import { collect } from './collect.ts'
import { resolveConfig, type Options } from './config.ts'
import { CalendarError } from './errors.ts'
import { buildReport } from './report.ts'
import { renderHtml } from './render.ts'
import { evidenceSchema, summarySchema, type Evidence } from './schema.ts'
import { readJson, writeFile } from './io.ts'
import { localDate } from './time.ts'

export async function run({ mode, options, cwd }: { mode: 'report' | 'collect' | 'render'; options: Options; cwd: string }) {
  const config = await resolveConfig({ options, cwd })
  if (config instanceof Error) return config
  const dates = { from: config.week, to: localDate(config.end, config.timezone).subtract({ days: 1 }).toString() }
  const evidencePath = path.join(config.dataDir, 'evidence', `${config.reportKey}.json`)
  const source = mode === 'render' ? await readJson({ file: evidencePath, schema: evidenceSchema }) : await collect(config)
  if (source instanceof Error) return source
  if (!source) return new CalendarError({ reason: 'Evidence missing. Run collect --week YYYY-MM-DD before render.' })
  if (source.week !== config.week || source.timezone !== config.timezone || source.start !== config.start || source.end !== config.end) {
    return new CalendarError({ reason: 'Evidence range/timezone boundaries do not match. Rerun collect with the same date selection and --timezone.' })
  }
  if (mode !== 'render') {
    const saved = await writeFile({ file: evidencePath, contents: JSON.stringify(source, null, 2) + '\n' })
    if (saved instanceof Error) return saved
  }
  if (mode === 'collect') return { week: config.week, ...dates, timezone: config.timezone, evidence: evidencePath, sessions: source.sessions.length, commits: source.commits.length, gaps: source.gaps }
  const summary = await readJson({ file: config.summary, schema: summarySchema, optional: !options.summary })
  if (summary instanceof Error) return summary
  const colors = await readJson({ file: path.join(config.dataDir, 'preferences.json'),
    schema: z.record(z.string(), z.string().regex(/^#[0-9a-f]{6}$/i)), optional: true })
  if (colors instanceof Error) return colors
  const excluded = new Set(config.excludeSessions)
  const evidence: Evidence = { ...source,
    sessions: source.sessions.filter(s => !excluded.has(s.id)),
  }
  if (config.projects.length) Object.assign(evidence, {
    projects: source.projects.filter(p => config.projects.some(directory => samePath(directory, p.directory))),
    sessions: evidence.sessions.filter(s => config.projects.some(directory => samePath(directory, s.projectDirectory ?? source.projects.find(p => p.folder_name === s.project)?.directory ?? s.directory))),
    inventory: source.inventory.filter(p => config.projects.some(directory => samePath(directory, p.project))),
  })
  if (!evidence.projects.length) return new CalendarError({ reason: 'No selected projects in cached evidence. Rerun collect with the same --project filters.' })
  if (config.projects.length || excluded.size) {
    const ids = new Set(evidence.sessions.map(s => s.id))
    const repositories = new Set(evidence.projects.map(p => p.repository ?? p.directory))
    evidence.commits = source.commits.filter(c => repositories.has(c.repository)).map(c => ({ ...c,
      linked: c.linked.filter(l => ids.has(l.id)), possible: c.possible.filter(id => ids.has(id)) }))
  }
  // Migrate the former automatic palette while retaining agent-selected custom colors.
  const legacyColors = new Set(['#b9a9f4', '#9edcc6', '#a4ccf5', '#f5cc9a', '#eeb8d0', '#9ed9df'])
  const projectColors = Object.fromEntries(Object.entries(colors ?? {}).filter(([, color]) => !legacyColors.has(color.toLowerCase())))
  const built = buildReport({ evidence, colors: projectColors, summary, theme: config.theme })
  if (built instanceof Error) return built
  const html = await renderHtml(built.data)
  if (html instanceof Error) return html
  const reportPath = path.join(config.outputDir, `${config.reportKey}.html`)
  const summaryPath = path.join(config.outputDir, `${config.reportKey}.md`)
  for (const [file, contents] of [[reportPath, html], [summaryPath, built.data.summary.lines.join('\n') + '\n'],
    [path.join(config.dataDir, 'preferences.json'), JSON.stringify(built.colors, null, 2) + '\n']] as const) {
    const saved = await writeFile({ file, contents })
    if (saved instanceof Error) return saved
  }
  return { week: config.week, ...dates, timezone: config.timezone, html: reportPath, summary: summaryPath,
    sessions: built.data.sessions.length, estimatedHours: built.data.hours, commits: built.data.commits, gaps: evidence.gaps }
}
