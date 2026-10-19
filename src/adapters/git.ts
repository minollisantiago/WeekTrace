import path from 'node:path'
import fs from 'node:fs/promises'
import { command } from './process.ts'
import { clean } from '../evidence.ts'
import { CalendarError } from '../errors.ts'
import type { Commit, Project, Session } from '../schema.ts'

const git = (directory: string, args: string[]) => command({ executable: 'git', args: ['-C', directory, ...args] })
export async function collectGit({ project, sessions, start, end }: {
  project: Project; sessions: Session[]; start: number; end: number
}) {
  const directory = project.directory
  const common = await git(directory, ['rev-parse', '--git-common-dir'])
  if (common instanceof Error) return common
  const canonical = await fs.realpath(path.resolve(directory, common.stdout.trim()))
    .catch(cause => new CalendarError({ reason: 'Cannot resolve Git common directory. Check repository access and rerun.', cause }))
  if (canonical instanceof Error) return canonical
  const repository = path.basename(canonical) === '.git' ? path.dirname(canonical) : canonical
  const trees = await git(directory, ['worktree', 'list', '--porcelain'])
  if (trees instanceof Error) return trees
  const log = await git(directory, ['log', '--all', `--since=@${Math.floor(start / 1000) - 86400}`,
    `--until=@${Math.floor(end / 1000) + 86400}`, '--format=%H%x1f%ct%x1f%s%x1f%B%x1e'])
  if (log instanceof Error) return log
  const records = log.stdout.split('\x1e').map(record => record.trim().split('\x1f'))
    .filter(parts => parts.length >= 4 && Number(parts[1]) * 1000 >= start && Number(parts[1]) * 1000 < end)
  const commits: Commit[] = []
  const gaps: string[] = []
  const resolvedHashes = new Map<string, string>()
  for (const hash of new Set(sessions.flatMap(s => s.recordedHashes))) {
    const resolved = await git(directory, ['rev-parse', '--verify', `${hash}^{commit}`])
    if (resolved instanceof Error) {
      console.warn(resolved.message)
      gaps.push(`${directory}: recorded commit prefix ${hash} is unavailable or ambiguous.`)
      continue
    }
    resolvedHashes.set(hash, resolved.stdout.trim())
  }
  for (const [hash, timestamp, subject, ...body] of records) {
    const time = Number(timestamp) * 1000
    const trailers = [...body.join('\x1f').matchAll(/^Session:\s*(ses_\w+)/gm)].map(m => m[1]!)
    const linked: Commit['linked'] = []
    const possible: string[] = []
    for (const s of sessions) {
      if (trailers.includes(s.id)) linked.push({ id: s.id, basis: 'Session trailer' })
      else if (s.recordedHashes.some(h => resolvedHashes.get(h) === hash)) {
        linked.push({ id: s.id, basis: 'Successful git commit output' })
      } else if (s.events.length && s.events.reduce((a, b) => Math.min(a, b), Infinity) <= time
        && time <= s.events.reduce((a, b) => Math.max(a, b), -Infinity)) possible.push(s.id)
    }
    const files = await git(directory, ['diff-tree', '--root', '--diff-merges=first-parent', '--no-commit-id', '--name-only', '-r', hash!])
    if (files instanceof Error) {
      console.warn(files.message)
      gaps.push(`${directory}: files unavailable for ${hash}`)
    }
    // NUL-delimited numstat keeps unusual filenames from being mistaken for rows.
    const diff = await git(directory, ['diff-tree', '--root', '--diff-merges=first-parent', '--no-commit-id', '--numstat', '-z', '-r', '--no-renames', hash!])
    let stats: Commit['stats']
    if (diff instanceof Error) gaps.push(`${directory}: line statistics unavailable for ${hash}`)
    else {
      stats = { added: 0, deleted: 0, binary: 0 }
      for (const row of diff.stdout.split('\0').filter(Boolean)) {
        const [added, deleted] = row.split('\t')
        if (added === '-' || deleted === '-') stats.binary++
        else { stats.added += Number(added); stats.deleted += Number(deleted) }
      }
    }
    commits.push({ repository, hash: hash!, time, subject: clean(subject!),
      ...(stats ? { stats } : {}),
       files: files instanceof Error ? [] : files.stdout.trim().split(/\r?\n/).filter(s => s.length > 0), linked, possible })
  }
  for (const s of sessions) {
    for (const hash of s.recordedHashes) {
      const matches = commits.filter(c => c.hash.startsWith(hash))
      if (matches.length !== 1) gaps.push(`${s.id}: recorded commit ${hash} is ${matches.length ? 'ambiguous' : 'unavailable in retained in-week Git history'}.`)
    }
  }
  return { repository, worktrees: trees.stdout.split(/\r?\n/).filter(line => line.startsWith('worktree ')).map(line => line.slice(9)), commits, gaps, resolvedHashes }
}
