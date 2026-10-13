import { resolveWeek } from './time.ts'
import type { Evidence, Session } from './schema.ts'

/** Synthetic evidence only. No personal prompts, paths, credentials or Discord IDs. */
export function fixture(): Evidence {
  const week = resolveWeek({ week: '2026-10-05', timezone: 'America/Argentina/Buenos_Aires' })
  if (week instanceof Error) throw week
  const start = week.start
  const session = (overrides: Partial<Session>): Session => ({
    id: 'ses_one', title: 'Implement synthetic feature', directory: '/synthetic/app', project: 'App', guild: '', thread: null,
    models: ['synthetic-model'], prompt: 'Build the fixture feature.', events: [start + 9 * 3_600_000, start + 9.5 * 3_600_000],
    finals: ['Implemented the synthetic feature; tests passed.'], recordedHashes: ['1234567'], statusNow: 'idle', parent: null,
    branchHints: ['feature'], commitBranches: [{ branch: 'feature', hash: '1234567' }], ...overrides,
  })
  return { ...week, projects: [
    { directory: '/synthetic/app', folder_name: 'App', is_local: true, guild_id: '', gitAvailable: true },
    { directory: '/synthetic/research', folder_name: 'Research', is_local: true, guild_id: '', gitAvailable: false },
  ], sessions: [session({}), session({ id: 'ses_two', title: 'Research a synthetic design with a deliberately long title to inspect wrapping and keyboard details',
    directory: '/synthetic/research', project: 'Research', events: [start + 9.25 * 3_600_000, start + 9.75 * 3_600_000],
    finals: [], recordedHashes: [], branchHints: [], commitBranches: [] }),
  session({ id: 'ses_midnight', title: 'Cross midnight', events: [start + 23 * 3_600_000 + 50 * 60_000, start + 24 * 3_600_000 + 10 * 60_000],
    recordedHashes: [], commitBranches: [] }),
  session({ id: 'ses_isolated', title: 'Isolated event', events: [start + 10 * 3_600_000], recordedHashes: [], commitBranches: [] })],
  commits: [{ repository: '/synthetic/app', hash: '1234567abcdef', time: start + 9.5 * 3_600_000,
    subject: 'Implement synthetic feature', files: ['feature.ts'], linked: [{ id: 'ses_one', basis: 'Session trailer' }], possible: [] }],
  gaps: ['/synthetic/research: Git evidence unavailable.'], inventory: [{ project: '/synthetic/app', sessions: 4, kimakiListed: 4, excludedSubagents: 0 }],
  method: 'Synthetic parity fixture using actual event timestamps.' }
}
