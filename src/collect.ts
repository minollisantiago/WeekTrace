import { z } from 'zod'
import { registeredProjects, recentSessions, type RecentSession } from './adapters/kimaki.ts'
import { apiSessionSchema, documentedApi, getJson, messagesSchema, type ApiSession, type Messages } from './adapters/opencode.ts'
import { collectGit } from './adapters/git.ts'
import type { Config } from './config.ts'
import { belongsTo, clean, compare } from './evidence.ts'
import { GAP } from './time.ts'
import type { Evidence, Project, Session } from './schema.ts'

export function normalizeSession({ source, messages, project, meta, start, end }: {
  source: ApiSession; messages: Messages; project: Project; meta?: RecentSession; start: number; end: number
}): Session | null {
  const events: number[] = []
  const prompts: Array<[number, string]> = []
  const finals: Array<[number, string]> = []
  const models = new Set<string>(), hashes = new Set<string>(), branches = new Set<string>()
  const commitBranches = new Map<string, { branch: string; hash: string }>()
  const threads: string[] = []
  for (const message of messages) {
    const info = message.info, time = info.time, created = time.created ?? 0
    const times = [time.created, time.completed]
    const texts: string[] = []
    for (const part of message.parts) {
      times.push(part.time?.start, part.time?.end)
      if (part.type === 'tool') {
        const state = part.state
        times.push(state?.time?.start, state?.time?.end)
        const inWeek = start <= (state?.time?.start ?? created) && (state?.time?.start ?? created) < end
        if (state?.status === 'completed' && ['bash', 'functions.bash'].includes(part.tool ?? '') && inWeek) {
          const cmd = state.input?.command ?? '', output = state.output ?? ''
          if (/\bgit\s+(?:-C\s+\S+\s+)?commit\b/.test(cmd)) {
            for (const match of output.matchAll(/^\[([^\]\n]+?) ([0-9a-f]{7,40})\]/gm)) {
              const branch = match[1]!.replace(/ \(root-commit\)$/, ''), hash = match[2]!
              hashes.add(hash)
              if (!['HEAD', 'detached HEAD'].includes(branch)) {
                branches.add(branch); commitBranches.set(JSON.stringify([branch, hash]), { branch, hash })
              }
            }
          }
          if (/\bgit\s+(?:-C\s+\S+\s+)?(?:checkout|switch)\b/.test(cmd)) {
            for (const m of output.matchAll(/(?:Switched to (?:a new )?branch|Already on) '([^'\n]+)'/g)) branches.add(m[1]!)
          }
        }
      }
      if (part.type !== 'text') continue
      const raw = part.text ?? ''
      const thread = raw.match(/thread-id="(\d+)"/)?.[1]
      if (thread) threads.push(thread)
      if (info.role === 'user' && start <= created && created < end) {
        for (const m of raw.matchAll(/\[current git branch(?: is|:)\s+([^\]\n]+)\]/g)) branches.add(m[1]!)
      }
      if (!part.synthetic) {
        const text = clean(raw, info.role === 'assistant' ? 1800 : 900)
        if (text) texts.push(text)
      }
    }
    events.push(...times.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)))
    const model = info.modelID ?? info.model?.modelID
    if (model && start <= created && created < end) models.add(model)
    if (info.role === 'user' && texts.length) prompts.push([created, texts.join('\n')])
    if (info.role === 'assistant' && info.finish === 'stop' && start <= created && created < end && texts.length) finals.push([created, texts.join('\n')])
  }
  const retained = [...new Set(events.filter(x => start - GAP <= x && x <= end + GAP))].sort((a, b) => a - b)
  if (!retained.some(x => start <= x && x < end)) return null
  return { id: source.id, title: clean(source.title), directory: source.directory, project: project.folder_name,
    projectDirectory: project.directory, guild: project.guild_id, thread: meta?.threadId ?? threads.at(-1) ?? null,
    models: [...models].sort(compare), prompt: prompts.sort((a, b) => a[0] - b[0] || compare(a[1], b[1]))[0]?.[1] ?? 'First user prompt unavailable.',
    events: retained, finals: finals.sort((a, b) => a[0] - b[0] || compare(a[1], b[1])).map(x => x[1]), recordedHashes: [...hashes].sort(compare),
    statusNow: meta?.status ?? 'unknown', parent: source.parentID ?? null, branchHints: [...branches].sort(compare),
    commitBranches: [...commitBranches.values()].sort((a, b) => compare(a.branch, b.branch) || compare(a.hash, b.hash)) }
}

export async function collect(config: Config) {
  const projects = await registeredProjects(config.projects)
  if (projects instanceof Error) return projects
  const gaps: string[] = [], sessions: Session[] = [], inventory: Evidence['inventory'] = []
  for (const project of projects) {
    const recent = await recentSessions(project.directory)
    if (recent instanceof Error) { console.warn(recent.message); gaps.push(`${project.directory}: Kimaki recent metadata unavailable.`) }
    const base = config.api ?? (recent instanceof Error ? null : recent.api)
    if (!base) {
      gaps.push(`${project.directory}: server discovery failed. Run kimaki session list --project PATH --json or pass --api http://127.0.0.1:PORT.`)
      continue
    }
    const documented = await documentedApi(base)
    if (documented instanceof Error) { console.warn(documented.message); gaps.push(`${project.directory}: ${documented.message}`); continue }
    const query: Record<string, string | number> = { directory: project.directory, limit: documented.limit }
    if (documented.scope) query.scope = 'project'
    else gaps.push(`${project.directory}: project-scoped worktree session inventory is unavailable on this server; worktree coverage may be incomplete.`)
    const all = await getJson({ base, route: '/session', query, schema: z.array(apiSessionSchema) })
    if (all instanceof Error) { console.warn(all.message); gaps.push(`${project.directory}: ${all.message}`); continue }
    if (all.data.length >= documented.limit || all.truncated) gaps.push(`${project.directory}: session inventory limit reached; coverage incomplete.`)
    if (!documented.allMessages) gaps.push(`${project.directory}: server does not document unlimited message retrieval; timing coverage may be incomplete.`)
    const ids = new Set(all.data.map(s => s.id))
    const subagent = (s: ApiSession) => Boolean((s.parentID && ids.has(s.parentID)) || s.title.includes('subagent)'))
    inventory.push({ project: project.directory, sessions: all.data.length,
      kimakiListed: recent instanceof Error ? 0 : recent.sessions.length, excludedSubagents: all.data.filter(subagent).length })
    const excluded = new Set(config.excludeSessions)
    const candidates = all.data.filter(s => !subagent(s) && !excluded.has(s.id) && s.time.updated >= config.start - GAP && s.time.created < config.end
      && !/weekly work calendar|HTML work calendar/i.test(s.title))
    const known = new Map((recent instanceof Error ? [] : recent.sessions).map(s => [s.id, s]))
    // Bound concurrent message requests and preserve inventory order for deterministic colors/lane placement.
    for (let i = 0; i < candidates.length; i += 3) {
      const batch = await Promise.all(candidates.slice(i, i + 3).map(async source => {
        const messages = await getJson({ base, route: `/session/${encodeURIComponent(source.id)}/message`,
          query: { directory: source.directory }, schema: messagesSchema })
        if (messages instanceof Error) return { gap: `${source.id}: messages unavailable. ${messages.message}` }
        return { session: normalizeSession({ source, messages: messages.data, project, meta: known.get(source.id), start: config.start, end: config.end }),
          gap: messages.truncated ? `${source.id}: message response truncated; timing coverage incomplete.` : null }
      }))
      for (const result of batch) {
        if (result.gap) gaps.push(result.gap)
        if ('session' in result && result.session && !sessions.some(s => s.id === result.session!.id)) sessions.push(result.session)
      }
    }
  }
  const commits: Evidence['commits'] = []
  for (const project of projects) {
    const projectSessions = sessions.filter(session => belongsTo({ session, directory: project.directory, name: project.folder_name }))
    const result = await collectGit({ project, sessions: projectSessions, start: config.start, end: config.end })
    if (result instanceof Error) {
      console.warn(result.message); project.gitAvailable = false
      gaps.push(`${project.directory}: Git evidence unavailable. ${result.message}`); continue
    }
    project.gitAvailable = true; project.worktrees = result.worktrees; project.repository = result.repository
    for (const session of projectSessions) {
      // Preserve branch presence, but count only prefixes verified uniquely by Git.
      session.commitBranches = session.commitBranches.filter(record => result.resolvedHashes.has(record.hash))
        .map(record => ({ ...record, hash: result.resolvedHashes.get(record.hash)! }))
    }
    commits.push(...result.commits); gaps.push(...result.gaps)
  }
  // Merge links when multiple registered worktrees share a repository/hash.
  const deduplicated = new Map<string, Evidence['commits'][number]>()
  for (const commit of commits) {
    const key = JSON.stringify([commit.repository, commit.hash]), previous = deduplicated.get(key)
    if (!previous) { deduplicated.set(key, commit); continue }
    previous.linked = [...new Map([...previous.linked, ...commit.linked].map(l => [l.id, l])).values()]
    previous.possible = [...new Set([...previous.possible, ...commit.possible])]
  }
  const evidence: Evidence = { schemaVersion: 1, week: config.week, timezone: config.timezone, start: config.start, end: config.end,
    projects, sessions, commits: [...deduplicated.values()], gaps: [...new Set(gaps)], inventory,
    method: 'Documented local OpenCode GET /session and /session/{id}/message; actual message created/completed and text/tool start/end timestamps. Kimaki recent metadata supplemented by prompt thread IDs. Git --all includes worktree refs. No session creation/update lifespans used.' }
  return evidence
}
