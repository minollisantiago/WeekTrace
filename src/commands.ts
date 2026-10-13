import { goke } from 'goke'
import { z } from 'zod'
import { run } from './run.ts'

export const cli = goke('weektrace')
for (const mode of ['report', 'collect', 'render'] as const) {
  cli.command(mode, mode === 'report' ? 'Collect evidence and generate an offline 1–7 day report'
    : mode === 'collect' ? 'Collect sanitized local evidence' : 'Render cached evidence with an optional curated summary')
    .option('--week <monday>', z.string().describe('Reporting Monday in YYYY-MM-DD format'))
    .option('--previous-week', 'Previous complete local Monday–Sunday')
    .option('--from <date>', z.string().describe('Inclusive first date in YYYY-MM-DD; requires --to, maximum 7 days'))
    .option('--to <date>', z.string().describe('Inclusive last date in YYYY-MM-DD; requires --from'))
    .option('--last-days <days>', z.number().describe('Last 1–7 calendar days including today in the reporting timezone'))
    .option('--timezone <zone>', z.string().describe('IANA reporting timezone'))
    .option('--project <path>', z.array(z.string()).describe('Registered source directory (repeatable)'))
    .option('--data-dir <path>', z.string().describe('Runtime storage directory'))
    .option('--output-dir <path>', z.string().describe('HTML and Markdown output directory'))
    .option('--api <url>', z.url().describe('Override automatic OpenCode server discovery'))
    .option('--exclude-session <id>', z.array(z.string()).describe('Reporting session ID to exclude (repeatable)'))
    .option('--summary <path>', z.string().describe('Curated three-line summary JSON'))
    .option('--theme <name>', z.enum(['Pink', 'Lavender', 'Blue', 'Green', 'Peach']).describe('Default theme; browser choice takes precedence'))
    .example(`weektrace ${mode} --previous-week`)
    .example(`weektrace ${mode} --last-days 7`)
    .example(`weektrace ${mode} --from 2026-10-07 --to 2026-10-13`)
    .action(async (options, { console, process }) => {
      const result = await run({ mode, options, cwd: process.cwd })
      if (result instanceof Error) { console.error(result.message); process.exit(1); return }
      console.log(JSON.stringify(result, null, 2))
      if (result.gaps.length) console.warn('Report coverage is partial. Inspect gaps in the output before interpreting an empty range.')
    })
}
cli.help()
cli.completions()
