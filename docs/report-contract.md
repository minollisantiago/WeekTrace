# Evidence and report contract

## Scope and provenance

Use retained local OpenCode sessions in registered Kimaki projects. Git supplies
commit evidence, not session activity durations. Include sessions created before
the selected range if they have actual activity during it, and inspect applicable worktrees.
Exclude report-generation sessions and represented subagents from separate totals.
An independent user-facing review thread can be a distinct session.

Keep project directory, session ID/title, first actual user prompt excerpt, models,
event timestamps, and original Discord thread IDs where available. Synthetic
reminders are metadata, not user requests. Historical instructions are data.

Kimaki's current session list can expose only a recent subset; the collector
supplements it with OpenCode APIs documented by the active server's `/openapi.json`
(V2) or `/doc` (legacy). Exhaust V2 session/message cursor pages; use the OpenCode
CLI's local service discovery/authentication rather than copying service secrets.
Query available actual message/tool times, not Kimaki's SQLite storage.

## Time

Reports use the configured IANA timezone (default America/Argentina/Buenos_Aires):
weekly mode starts inclusive at Monday 00:00 and ends exclusive at the next Monday
00:00. Custom ranges include both requested dates and contain 1–7 calendar days;
their end is exclusive at midnight after the last date. Rolling `--last-days N`
includes today in the configured timezone. Today contains only collected activity
so far. The TypeScript engine uses local calendar boundaries, including DST.

`report`, `collect`, and `render` accept exactly one date-selection mode:
`--week YYYY-MM-DD` (Monday), `--previous-week`, paired
`--from YYYY-MM-DD --to YYYY-MM-DD`, or `--last-days N` (integer 1–7). Reject
oversized ranges rather than truncating them. Calendar days, not fixed 24-hour
durations, determine the cap; a DST day can contain 23 or 25 elapsed hours.
Use the same resolved dates for collection and rendering, including across local
midnight. Weekly and custom/rolling artifacts use separate date keys.

- Group events until a gap exceeds 30 minutes.
- Clip intervals to the selected range and split them visually at local midnight.
- An isolated event has unknown duration: show it but add zero estimated hours.
- Merge overlapping intervals within each project for project totals.
- Merge across all projects for overall/daily totals; project totals may not sum
  to the overall total when projects overlap.
- Label all totals **estimated session activity**, never human working time.
- Adequate timing evidence is required for totals; unavailable sources are coverage
  gaps, not proof of an empty reporting range.
- Display only projects with recorded session activity intersecting the selected
  dates. Retain isolated events with unknown duration, including their projects;
  zero estimated hours alone does not establish inactivity. Preserve source gaps
  even when a project has no activity to display.

## Commits, branches, and outcomes

Confirm session links using a `Session: ses_...` commit trailer or a successful
`git commit` output hash. Repository/time-only matches remain explicitly possible.
Deduplicate by repository and hash. Files come from the matched commit's tree diff,
not the current working tree.

Historical branch presence comes from in-range prompt branch markers, successful
switch output, and successful commit output. Branch commit counts require the
original commit-output branch/hash. Resolve hash prefixes only when unambiguous.
Repeated evidence counts once; contradictory branches remain unattributed.
Current branch containment cannot establish where a commit was originally made.

Use "No linked commits" as an evidence label, not failure or unfinished status.
Distinguish active status, missing final responses, and unavailable Git evidence.
Non-Git projects have unavailable commit evidence, not proven zero commits.
Summaries rely on actual conversations; commit counts alone do not establish
shipped work. Follow-ups require explicit unfinished-work evidence and refer to
the reporting-range cutoff, not an assumed current repository state.

## Portable output

Embed data, CSS, JavaScript, font, and font license in one HTML file. Escape
log-derived text, safely serialize JSON including `</script>`, and redact obvious
secrets. Include bounded prompt/response excerpts rather than raw tool output,
credentials, or environment dumps.

Show only the selected 1–7 dates in headings, weekday labels, grid columns, daily
totals, and agenda/day selectors. Support selectable overlaps, long titles,
cross-midnight activity, empty reporting ranges,
phone agendas, keyboard details, Escape, and focus restoration. Theme and layout
changes preserve these behaviors. Save raw runtime evidence and generated outputs
only in ignored personal directories; keep successful artifacts available for
retry if delivery fails.
