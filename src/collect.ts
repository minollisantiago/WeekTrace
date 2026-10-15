import { z } from 'zod'
import { registeredProjects, recentSessions, type RecentSession } from './adapters/kimaki.ts'
import { apiSessionSchema, documentedApi, getJson, messagesSchema, type ApiSession, type Messages } from './adapters/opencode.ts'
import { collectGit } from './adapters/git.ts'
import type { Config } from './config.ts'
import { belongsTo, clean, compare } from './evidence.ts'
import { GAP } from './time.ts'
import type { Evidence, Project, Session } from './schema.ts'
import { localV2, v2Inventory, v2Messages } from './adapters/opencode-v2.ts'
import type { UsageRecord } from './usage.ts'

export function collectUsage(messages: Messages, source: string, session: string, start: number, end: number): UsageRecord[] {
  return messages.flatMap((m, index) => {
    const time = m.info.time.created
    if (!['assistant', 'compaction'].includes(m.info.role) || time === undefined || time < start || time >= end) return []
    return [{ session, source, id: m.info.id ?? `index:${index}`, time, tokens: m.info.tokens }]
  })
}

export function usageOwner(source: ApiSession, inventory: ApiSession[], excluded: Set<string>): string | null {
  const byId = new Map(inventory.map(s => [s.id, s])), seen = new Set<string>()
  let current = source
  for (;;) {
    if (excluded.has(current.id) || seen.has(current.id) || /weekly work calendar|HTML work calendar/i.test(current.title)) return null
    seen.add(current.id)
    if (!current.parentID) return current.title.includes('subagent)') ? null : current.id
    const parent = byId.get(current.parentID)
    if (!parent) return current.title.includes('subagent)') ? null : current.id
    current = parent
  }
}

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
        if (state?.status === 'completed' && ['bash', 'functions.bash', 'shell', 'functions.shell'].includes(part.tool ?? '') && inWeek) {
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
  const usage: UsageRecord[] = []
  const methods = new Set<string>()
  for (const project of projects) {
    if (!project.guild_id) gaps.push(`${project.directory}: Discord guild metadata unavailable; thread IDs are retained, but direct Discord links are unavailable.`)
    const recent = await recentSessions(project.directory)
    if (recent instanceof Error) { console.warn(recent.message); gaps.push(`${project.directory}: Kimaki recent metadata unavailable.`) }
    const base = config.api ?? (recent instanceof Error ? null : recent.api) ?? localV2
    if (!base) {
      gaps.push(`${project.directory}: server discovery failed. Run kimaki session list --project PATH --json or pass --api http://127.0.0.1:PORT.`)
      continue
    }
    const documented = base === localV2 ? await v2Inventory(project.directory) : await documentedApi(base)
    if (documented instanceof Error) { console.warn(documented.message); gaps.push(`${project.directory}: ${documented.message}`); continue }
    const query: Record<string, string | number> = { directory: project.directory, limit: documented.limit }
    if (documented.scope) query.scope = 'project'
    else gaps.push(`${project.directory}: project-scoped worktree session inventory is unavailable on this server; worktree coverage may be incomplete.`)
    const all = 'sessions' in documented ? { data: z.array(apiSessionSchema).parse(documented.sessions), truncated: false } : await getJson({ base, route: '/session', query, schema: z.array(apiSessionSchema) })
    if (all instanceof Error) { console.warn(all.message); gaps.push(`${project.directory}: ${all.message}`); continue }
    methods.add(base === localV2
      ? 'Documented OpenCode V2 /openapi.json, /api/session and /api/session/{id}/message via the authenticated local opencode api CLI; cursor pages exhausted, including project worktrees.'
      : 'Documented local OpenCode GET /session and /session/{id}/message.')
    if (all.data.length >= documented.limit || all.truncated) gaps.push(`${project.directory}: session inventory limit reached; coverage incomplete.`)
    if (!documented.allMessages) gaps.push(`${project.directory}: server does not document unlimited message retrieval; timing coverage may be incomplete.`)
    const ids = new Set(all.data.map(s => s.id))
    const subagent = (s: ApiSession) => Boolean((s.parentID && ids.has(s.parentID)) || s.title.includes('subagent)'))
    inventory.push({ project: project.directory, sessions: all.data.length,
      kimakiListed: recent instanceof Error ? 0 : recent.sessions.length, excludedSubagents: all.data.filter(subagent).length })
    const excluded = new Set(config.excludeSessions)
    const candidates = all.data.filter(s => usageOwner(s, all.data, excluded) && s.time.updated >= config.start - GAP && s.time.created < config.end)
    const known = new Map((recent instanceof Error ? [] : recent.sessions).map(s => [s.id, s]))
    // Bound concurrent message requests and preserve inventory order for deterministic colors/lane placement.
    for (let i = 0; i < candidates.length; i += 3) {
      const batch = await Promise.all(candidates.slice(i, i + 3).map(async source => {
        const messages = base === localV2 ? await v2Messages(source.id) : await getJson({ base, route: `/session/${encodeURIComponent(source.id)}/message`,
          query: { directory: source.directory }, schema: messagesSchema })
        if (messages instanceof Error) return { gap: `${source.id}: messages unavailable. ${messages.message}` }
        usage.push(...collectUsage(messages.data, source.id, usageOwner(source, all.data, excluded)!, config.start, config.end))
        return { session: subagent(source) ? null : normalizeSession({ source, messages: messages.data, project, meta: known.get(source.id), start: config.start, end: config.end }),
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
    projects, sessions, usage: [...new Map(usage.map(r => [JSON.stringify([r.source, r.id]), r])).values()].sort((a, b) => a.time - b.time || compare(a.source, b.source) || compare(a.id, b.id)), commits: [...deduplicated.values()], gaps: [...new Set(gaps)], inventory,
    method: `${[...methods].join(' ')} Actual message/tool timestamps; Kimaki recent metadata supplemented by prompt thread IDs. Git --all includes worktree refs. No session creation/update lifespans used.` }
  return evidence
}
