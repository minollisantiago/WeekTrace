# Operations

## Current capabilities and limits

- Collection uses Kimaki project discovery and documented local OpenCode GET APIs.
- Evidence scope is all locally registered projects; there is no project filter.
- `--week` and `--api` are explicit. The collector's default localhost port is
  machine-specific; discover the active port instead of relying on that default.
- Reporting timezone is fixed to `America/Argentina/Buenos_Aires` in the helpers.
- Python generation is deterministic given evidence, summary, and preferences.
- Agent-written summaries and browser verification are orchestration steps.
- Uploads use the current Kimaki session ID; Python does not send attachments.
- This baseline is not an npm package and has no standalone cron/date wrapper.

## Execute an agent-assisted report

1. Read the task and [report contract](report-contract.md). Resolve the requested
   Monday; absent explicit dates, choose the previous complete local Monday–Sunday.
2. Confirm `~/.calendar/` contains helpers/fonts and the runtime directories.
3. Discover local projects with `kimaki project list --json`. Use
   `kimaki session list --project /absolute/path --json` to confirm OpenCode
   availability and obtain the active server port from CLI discovery output.
4. Run `collect.py --week YYYY-MM-DD --api http://127.0.0.1:PORT`. Completion means
   the evidence JSON exists and every unavailable source is recorded as a gap.
5. Inspect response excerpts and commit evidence. Exclude the current reporting
   session and represented subagents from work totals. The collector's title-based
   report-session exclusions are a baseline heuristic; reconcile explicit current
   report IDs if needed before rendering.
6. Write `evidence/YYYY-MM-DD-summary.json` with exactly three factual lines and
   follow-ups tied to real session IDs:

   ```json
   {
     "lines": [
       "What the conversations and linked evidence establish.",
       "Which project had the most estimated session activity.",
       "What explicitly unfinished work deserves follow-up."
     ],
     "followups": [
       {"id": "ses_ACTUAL_ID", "text": "An evidenced outstanding action."}
     ]
   }
   ```

   Use an empty `followups` list if none are evidenced. Do not infer unfinished
   work from missing commits. The renderer supplies a neutral fallback if this
   file is omitted.
7. Run `generate.py --week YYYY-MM-DD`. Confirm HTML and the adjacent three-line
   Markdown summary exist under `weeks/` and match the requested week.
8. Verify the output is self-contained and works without network requests. For
   changed timing/attribution code, run the relevant tests. For changed UI, inspect
   desktop/mobile, long-title details, keyboard/Escape, theme choices, 1032px
   stacking, and toolbar/content alignment above 1900px.
9. Upload the HTML, and a preview when available:

   ```sh
   kimaki upload-to-discord --session CURRENT_RUN_SESSION_ID \
     /absolute/path/to/report.html
   ```

   Obtain the run ID from current session metadata, not historical logs or a
   parent session. Report delivery success only after the upload succeeds.
10. Send a concise summary with dates, accomplishments, most-active project,
    evidenced follow-ups, and coverage gaps. Explain the downloaded HTML opens in
    a browser. Deliver an empty-state report only when the week is genuinely empty.

## Schedule and delivery

A recurring `kimaki send --send-at 'CRON'` creates a reporting-agent run at each
occurrence. Cron is UTC; reporting-week boundaries are local time. Choose delivery
with an existing registered `--project` or a Discord `--channel`.

On the original machine, task #1 remains in TsCanvas and reads the task file in
that repository. Its schedule is Monday 12:00 UTC, or 09:00 Buenos Aires. The new
standalone source project is for development; registering its channel does not
retarget that existing scheduled task.

For another machine, copy this source bundle to `~/.calendar/`, configure
Kimaki/OpenCode, register source projects, test one explicit week, and then create
one recurring task pointing to the portable task in this repository. Reuse the
same helpers/template on scheduled and on-demand runs.

An optional Git-ignored `local-profile.json` can supply agent-only delivery
preferences, such as a Discord owner ID to mention when reports are ready. The
Python helpers do not parse this file. Prefer current run metadata for the thread
and project; if no owner is configured, attach the report without guessing a user.

The host and integrations must be available at execution time. Do not assume
missed executions are automatically replayed; generate the explicit missing week
on demand when necessary.
