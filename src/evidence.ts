import type { Evidence, Session } from './schema.ts'
import { samePath } from './paths.ts'

export function clean(text: string, limit = 900) {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>|<discord-user[^>]*>|<embed>[\s\S]*?<\/embed>/g, '')
    .replace(/\[current git branch[^\]]*\]/g, '')
    .replace(/((?:api[_ -]?key|token|password|secret|authorization)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]+|AKIA[A-Z0-9]{16})\b/g, '[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .trim().slice(0, limit)
}

export function belongsTo({ session, directory, name }: { session: Session; directory: string; name: string }) {
  return session.projectDirectory ? samePath(session.projectDirectory, directory) : session.project === name
}

export function branchTotals(data: Pick<Evidence, 'projects' | 'sessions' | 'commits'>) {
  const buckets = new Map<string, { project: string; name: string; hashes: Set<string> }>()
  const assignments = new Map<string, Set<string>>()
  const bucket = (project: string, name: string) => {
    const id = JSON.stringify([project, name])
    if (!buckets.has(id)) buckets.set(id, { project, name, hashes: new Set() })
    return id
  }
  for (const session of data.sessions) {
    for (const branch of session.branchHints) bucket(session.project, branch)
    const projects = data.projects.filter(p => belongsTo({ session, directory: p.directory, name: p.folder_name }))
    const repositories = new Set(projects.length ? projects.map(p => p.repository ?? p.directory) : [session.directory])
    for (const record of session.commitBranches) {
      const matches = data.commits.filter(c => c.linked.length && repositories.has(c.repository) && c.hash.startsWith(record.hash))
      const keys = new Set(matches.map(c => JSON.stringify([c.repository, c.hash])))
      if (keys.size !== 1) continue
      const key = [...keys][0]!
      if (!assignments.has(key)) assignments.set(key, new Set())
      assignments.get(key)!.add(bucket(session.project, record.branch))
    }
  }
  const assigned = new Set<string>()
  for (const [key, branches] of assignments) {
    if (branches.size !== 1) continue
    buckets.get([...branches][0]!)!.hashes.add(key)
    assigned.add(key)
  }
  const confirmed = new Set(data.commits.filter(c => c.linked.length).map(c => JSON.stringify([c.repository, c.hash])))
  const rows = [...buckets.values()].map(b => ({ project: b.project, name: b.name, commits: b.hashes.size }))
    .sort((a, b) => b.commits - a.commits || compare(a.project, b.project) || compare(a.name, b.name))
  return { rows, unknown: [...confirmed].filter(key => !assigned.has(key)).length }
}
export const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
