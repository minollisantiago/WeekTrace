# Operations

## Current capabilities

- Node.js/TypeScript `report`, `collect`, and `render` share one engine.
- Every command accepts weekly, inclusive custom `--from`/`--to`, or rolling
  `--last-days N` selections, with a hard cap of 1–7 local calendar days.
  Today includes only activity collected so far; grid and agenda match the range.
- Collection discovers locally registered Kimaki projects and per-project OpenCode
  servers through CLI output, verifies `/doc`, and uses documented GET APIs.
- Default source scope is all local registrations; repeatable `--project` selects
  registered source directories. Git alone cannot establish session durations.
- Reporting timezone is configurable, with Buenos Aires retained as the default.
- Generation is deterministic given evidence, configuration, summary, and colors.
- Agent-written narratives, browser checks, scheduling, and uploads are orchestration.
- The private local package is installable from a tarball; registry publication is deferred.

## Execute an agent-assisted report

1. Read the task and [report contract](report-contract.md). Resolve the requested
   range or reporting Monday, or use `--previous-week` for the previous complete local week.
   Choose exactly one date-selection mode. Custom dates must use YYYY-MM-DD, both
   `--from` and `--to`, and span 1–7 inclusive days. `--last-days` accepts integers
   from 1 to 7. Reversed, oversized, incomplete, and conflicting selections fail.
   Respect the user's timezone and project filters.
2. Use the installed local `weektrace` binary, or `node dist/cli.js` from
   a built source checkout. Confirm `--help`. Runtime defaults to `~/.calendar`;
   override `--data-dir` or `--output-dir` when requested. The CLI creates directories.
3. Run collection, excluding this report-generation session explicitly:

   ```sh
   weektrace collect --previous-week --exclude-session CURRENT_RUN_SESSION_ID
   ```

   Without a locally installed binary, run this from the built checkout instead:

   ```sh
   node dist/cli.js collect --previous-week --exclude-session CURRENT_RUN_SESSION_ID
   ```

   For an explicit week, replace `--previous-week` with `--week YYYY-MM-DD`.
   For on-demand ranges, use `--from YYYY-MM-DD --to YYYY-MM-DD` (inclusive,
   maximum seven days), or `--last-days N` (1–7 days including today).
   Range artifacts and curated summaries use `YYYY-MM-DD_to_YYYY-MM-DD` instead
   of the weekly date key. Inspect the reported evidence path. If collection and
   rendering cross local midnight, use the returned inclusive `from`/`to` dates
   as explicit flags for rendering. The reporting timezone determines today's date.
   Apply the same timezone, project, data-directory, and exclusion options to
    subsequent commands. No fixed OpenCode port is assumed. With current Kimaki,
    the installed `opencode api` CLI discovers/authenticates to the local V2 service;
    the adapter verifies `/openapi.json` and exhausts session/message cursor pages.
    Older discovered servers and explicit `--api` URLs use the legacy `/doc` adapter.
    Missing Discord guild metadata is disclosed separately from activity coverage;
    thread IDs remain retained, but links are omitted when the guild is unknown.
4. Inspect sanitized evidence and actual final response excerpts. Check source gaps,
   represented subagents, commit links, and timing coverage. Missing Git evidence,
   missing finals, current idle status, and commit absence are distinct facts.
5. Write `DATA_DIR/evidence/REPORT_KEY-summary.json`, or supply another file with
   `--summary`. `REPORT_KEY` is the Monday for weekly reports, or
   `YYYY-MM-DD_to_YYYY-MM-DD` for custom/rolling reports. The shape is:

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

   Use exactly three nonempty single lines; use an empty `followups` list when none
   are evidenced. Follow-up IDs must be present in the selected report. Do not infer
   unfinished work from missing commits. Omitted curated input produces a neutral
   factual fallback without an LLM.
6. Render using the same resolved dates/configuration:

   ```sh
   weektrace render --previous-week --exclude-session CURRENT_RUN_SESSION_ID
   ```

   Source-checkout equivalent:

   ```sh
   node dist/cli.js render --previous-week --exclude-session CURRENT_RUN_SESSION_ID
   ```

   `report` combines collection/rendering for deterministic on-demand or OS-scheduled
   runs. It reads an existing summary or uses the fallback. `render` requires cached
   evidence boundaries to match the requested timezone/range; recollect when they differ.
7. Confirm the HTML and adjacent three-line Markdown exist under the selected output
   directory as `REPORT_KEY.html` and `REPORT_KEY.md`. Inspect estimates and gaps
   before calling the selected range empty. A partial
   report records unavailable sources and emits a coverage warning on stderr;
   validation or fatal setup failures exit nonzero. Successful partial output is retained.
8. Verify offline opening and zero network requests. For engine changes, run
   `npm run check`, which includes frozen baseline regression checks. For renderer changes, check
   details, long titles, keyboard/Escape/focus restoration, theme choices, phone
   agenda, 1032px stacking, and toolbar alignment above 1900px.
9. Upload with this run's current Kimaki session ID:

   ```sh
   kimaki upload-to-discord --session CURRENT_RUN_SESSION_ID /absolute/path/to/report.html
   ```

   Current run metadata supplies the destination, not historical prompts or parent
   session IDs. Claim delivery success only after upload succeeds. Preserve artifacts
   for retry when delivery fails.
10. Send a concise result with dates, evidenced accomplishments, most-active project,
    explicit follow-ups, and coverage gaps. Explain that the downloaded HTML opens
    directly in a browser.

## Scheduling and existing deployment

Kimaki recurring prompts or OS cron/task schedulers invoke the same CLI. Kimaki cron
is UTC; report-date boundaries are local and DST-aware. Choose the scheduler time
separately from the reporting timezone, with no assumption that missed runs replay.

Existing task #1 remains in TsCanvas, reads its task file there, and runs Monday
`0 12 * * 1`. Its task instructions permit similarly lightweight tooling, so the
Node CLI can be invoked from the delivery project using its absolute path. The
task definition and schedule are preserved; retargeting requires explicit approval.

For a new deployment, install the local tarball, configure source registrations and
timezone, verify an explicit week and a previous-week invocation, then configure
one external scheduler. Delivery-project/channel selection is independent of the
CLI's source-project filters. The host, Kimaki, and local OpenCode servers must be
available at execution time.

Optional ignored `local-profile.json` supplies agent-only delivery preferences,
such as a Discord owner ID to mention. The CLI does not parse it. Without configured
preferences, attach without guessing an owner.

## Run from a delivery project

When the agent's working directory is TsCanvas or another delivery project, use
the built CLI's absolute path rather than a relative `dist/cli.js`:

```sh
node ~/.calendar/dist/cli.js collect --previous-week --exclude-session CURRENT_RUN_SESSION_ID
node ~/.calendar/dist/cli.js render --previous-week --exclude-session CURRENT_RUN_SESSION_ID
```

Use the installed local `weektrace` executable instead when available. Both
invocations resolve packaged assets independently of cwd and use the same reporting
engine.

For an on-demand rolling report from any delivery project:

```sh
node ~/.calendar/dist/cli.js report --last-days 7 --exclude-session CURRENT_RUN_SESSION_ID
```

For a curated range, substitute `--from YYYY-MM-DD --to YYYY-MM-DD` into both
`collect` and `render` above. Upload the exact output path returned by the CLI.
