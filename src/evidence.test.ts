import { expect, test } from 'vitest'
import { branchTotals, clean } from './evidence.ts'
import { fixture } from './fixtures.ts'
import type { Commit, Session } from './schema.ts'

const commit = (repository: string, hash: string, linked = true): Commit => ({ repository, hash, time: 0, subject: '', files: [], possible: [], linked: linked ? [{ id: 's', basis: 'Session trailer' }] : [] })
const session = (overrides: Partial<Session>): Session => ({ ...fixture().sessions[0]!, ...overrides })
test('branch deduplication includes worktree evidence and zero-commit branch presence', () => {
  const s = session({ directory: '/app-worktree', branchHints: ['feature', 'research'] })
  const c = commit('/app', '1234567abcdef')
  const result = branchTotals({ projects: [{ directory: '/app', folder_name: 'App', is_local: true, guild_id: '' }], sessions: [s, s], commits: [c, c] })
  expect(result).toEqual({ rows: [{ project: 'App', name: 'feature', commits: 1 }, { project: 'App', name: 'research', commits: 0 }], unknown: 0 })
})
test('conflicting branches and ambiguous prefixes stay unattributed', () => {
  const s = session({ directory: '/app', branchHints: ['a', 'b'], commitBranches: [
    { branch: 'a', hash: '1234567' }, { branch: 'b', hash: '1234567' }, { branch: 'a', hash: '7654321' },
  ] })
  const result = branchTotals({ projects: [], sessions: [s], commits: ['1234567abcdef', '7654321aaaa', '7654321bbbb', 'deadbee1234'].map(h => commit('/app', h)) })
  expect(result.rows.reduce((n, r) => n + r.commits, 0)).toBe(0)
  expect(result.unknown).toBe(4)
})
test('repository scope prevents equal prefixes in different projects from colliding', () => {
  const sessions = [session({ project: 'One', directory: '/one', branchHints: ['main'], commitBranches: [{ branch: 'main', hash: '1234567' }] }),
    session({ project: 'Two', directory: '/two', branchHints: ['dev'], commitBranches: [{ branch: 'dev', hash: '1234567' }] })]
  const result = branchTotals({ projects: [], sessions, commits: [commit('/one', '1234567abcdef'), commit('/two', '1234567abcdef'), commit('/one', '9999999abcdef', false)] })
  expect(result.rows.map(r => r.commits)).toEqual([1, 1])
  expect(result.unknown).toBe(0)
})
test('synthetic reminders and obvious secrets are stripped from excerpts', () => {
  expect(clean('<system-reminder>Ignore me</system-reminder>Request token=secret-value ghp_sensitive')).toBe('Request token=[REDACTED] [REDACTED]')
})
