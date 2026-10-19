# WeekTrace

<img src="assets/weektrace.svg" width="96" alt="WeekTrace handwritten W logo">

**Your agent work, week by week.**

Generate a self-contained HTML calendar for **1–7 days** from locally retained OpenCode
sessions, registered Kimaki projects, and Git evidence. Reports open offline,
with an embedded font, theme picker, keyboard-accessible details, and phone agenda.

The shared **Node.js/TypeScript CLI** handles on-demand and scheduler-driven
generation and all development checks. No package has
been published. The approved product name is **WeekTrace**, with `weektrace` as
the private local package and CLI name. Source lives at
[minollisantiago/WeekTrace](https://github.com/minollisantiago/WeekTrace).
Registry availability is not yet checked; the project license remains undecided.
The bundled font retains its SIL Open Font License.

## Set up with a coding agent

**WeekTrace is a companion to OpenCode and Kimaki, not a standalone activity
tracker.** You need both installed and must actually use them for your development
work. It reports retained local OpenCode sessions in locally registered Kimaki
projects; installing WeekTrace cannot reconstruct activity that was never recorded.
Git history alone is not enough to produce session activity totals.

Give an agent with local terminal/filesystem access this prompt:

```text
Set up WeekTrace from https://github.com/minollisantiago/WeekTrace on this machine.
Read the repository's AGENTS.md and docs/agent-setup.md and follow the setup
procedure. First check whether I have and actually use OpenCode and Kimaki;
explain any missing prerequisites before proceeding. Use my native OS and keep
Windows and WSL installations separate. Ask for my reporting timezone and source
projects if they aren't already configured. Build and verify the local CLI,
generate a report from real retained activity, and give me its absolute HTML path
and a reusable command. Explain coverage gaps. Configure scheduling or Discord
delivery only if I request it, and preserve existing routines and personal files.
```

See [agent setup and platform verification](docs/agent-setup.md) for prerequisites,
completion criteria, and a native Windows smoke-test checklist.

## 1. Install and run locally

Requirements: **Node.js 22+**, Git, the Kimaki CLI, and access to local OpenCode
servers retaining the sessions to report.

The build and CLI have native Windows support changes and Linux/Windows CI
coverage configured. Native Windows collection still requires a real-machine
smoke test before it is considered verified. macOS remains unverified.
Generated HTML reports can be opened offline on all three platforms.

```sh
git clone https://github.com/minollisantiago/WeekTrace.git
cd WeekTrace
npm ci
npm run build
node dist/cli.js report --previous-week
node dist/cli.js report --week 2026-10-05 --project /absolute/path/to/repo
node dist/cli.js report --last-days 7
node dist/cli.js report --from 2026-10-07 --to 2026-10-13
```

On **native Windows**, run the same commands in PowerShell with Node.js and Git
on `PATH`; WSL, Git Bash, and Python are not required. Quote paths with spaces:

```powershell
node .\dist\cli.js report --last-days 7 --timezone "Europe/London" --project "C:\Users\YourName\My Project"
```

Replace the example timezone and registered project path with your own. Runtime
storage defaults to `.calendar` inside your OS home directory, such as
`C:\Users\YourName\.calendar`. JSON configuration paths must use escaped
backslashes (`"C:\\Users\\YourName\\My Project"`) or forward slashes.
Run WeekTrace in the same environment as your Kimaki/OpenCode activity: a Windows
installation does not automatically discover WSL registrations or translate paths.

These source commands run from the checkout root. From another working directory,
use the absolute executable path, for example
`node /home/your-user/.calendar/dist/cli.js report --previous-week`.

Automatic discovery runs `kimaki project list --json` and per-project
`kimaki session list --project PATH --json`. Current Kimaki uses OpenCode V2:
WeekTrace invokes `opencode api` for authenticated local service discovery, verifies
`/openapi.json`, and follows every session/message cursor page. Install the OpenCode
CLI alongside Kimaki. Older server discovery and explicit `--api` URLs retain the
legacy `/doc` adapter.
Unavailable APIs, retained-history limits, and unavailable Git remain coverage gaps.

The week is Monday 00:00 inclusive to next Monday 00:00 exclusive in the reporting
timezone. `--previous-week` selects the previous **complete** local week. Explicit
`--week` dates must be Mondays. Choose exactly one date-selection mode.

Custom `--from` and `--to` dates are both inclusive and must span **1–7 calendar
days**. `--last-days N` selects 1–7 local calendar days including today. Today
contains only activity collected so far. All modes use timezone-aware midnight
boundaries, including DST, and reject conflicting date flags.

Custom and rolling artifacts use `YYYY-MM-DD_to_YYYY-MM-DD` names for evidence,
HTML, Markdown, and the optional `-summary.json`, keeping them separate from weekly
artifacts. Use the same flags for `collect` and `render`; across local midnight,
use the resolved explicit `--from`/`--to` dates to render the same cached range.
CLI results expose those inclusive `from`/`to` dates. The grid, agenda, weekday
labels, daily totals, and day filter all adapt to the selected range.

## 2. Commands and configuration

- `report`: collect evidence and render HTML plus a three-line Markdown summary.
- `collect`: save sanitized evidence for inspection and curated summaries.
- `render`: regenerate from cached evidence without fetching sessions or Git.

Shared flags:

| Flag | Purpose |
| --- | --- |
| `--week YYYY-MM-DD` / `--previous-week` | Explicit Monday or previous complete week |
| `--from YYYY-MM-DD --to YYYY-MM-DD` | Inclusive custom range of 1–7 calendar days |
| `--last-days N` | Last 1–7 calendar days including today |
| `--timezone ZONE` | IANA timezone; defaults to `America/Argentina/Buenos_Aires` |
| `--project PATH` | Repeatable registered source-directory filter; omitted includes all local projects |
| `--data-dir PATH` | Runtime storage; defaults to `~/.calendar` |
| `--output-dir PATH` | HTML/Markdown destination; defaults to `DATA_DIR/weeks` |
| `--api URL` | Override automatic OpenCode discovery |
| `--exclude-session ID` | Repeatable reporting-session exclusion |
| `--summary PATH` | Curated summary JSON; omitted uses cached summary or factual fallback |
| `--theme NAME` | Pink, Lavender, Blue, Green, or Peach; saved browser choice takes precedence |

Optional `DATA_DIR/config.json` settings:

```json
{
  "timezone": "Europe/London",
  "projects": ["/absolute/path/to/repo"],
  "theme": "Pink"
}
```

Also supported: `outputDir`, `api`, and `excludeSessions`. CLI settings override
configuration, then defaults apply. Prefer absolute configured paths; relative
paths resolve from the execution directory. Config files are validated and never
silently ignored when malformed. `local-profile.json` remains agent-only delivery
metadata; the CLI does not interpret it.

**Delivery destination and evidence selection are independent:** Kimaki's
`send --project` chooses a working project/channel; this CLI's `--project` filters
source evidence. An agent must pass its current reporting session ID with
`--exclude-session`, rather than relying on the retained title heuristic alone.

## 3. Ask an agent for a calendar report

After local setup, paste these prompts into a Kimaki Discord thread or a local
coding-agent session with access to WeekTrace and your retained activity logs.
The agent handles collection, an evidence-based summary, rendering, and delivery.
In Kimaki, the HTML can be attached directly to the current thread; in a local
session, ask for the generated file path and open it in your browser.

**First request, including the reporting instructions:**

```text
Read ~/.calendar/tasks/weekly-work-calendar.md and follow its linked operations
and report-contract instructions. Generate my calendar report for the last
7 calendar days including today, using my configured reporting timezone and
all locally registered projects. Exclude this report-generation session, inspect
the evidence, and write the three-line summary with only evidenced follow-ups.
Keep the same resolved dates for collection and rendering. Verify the offline
HTML, then attach it to this Discord thread if running in Kimaki, or give me
its absolute file path. Include the dates, estimated session activity, and
any coverage gaps in your response.
```

Replace `~/.calendar` if your checkout is elsewhere. Once the agent has the
reporting instructions, use any of these shorter copy-paste requests.

**Last seven days, including today:**

```text
Generate my calendar report for the last 7 calendar days including today.
Use my configured timezone, include all locally registered projects, and
deliver the offline HTML with a concise evidence-based summary.
```

**Today only:**

```text
Generate my calendar report for today only, using my configured reporting
timezone. Include activity collected so far and deliver the offline HTML.
```

**Previous complete week:**

```text
Generate my calendar report for the previous complete Monday–Sunday in my
configured reporting timezone. Deliver the offline HTML and summarize the
evidenced accomplishments, most-active project, and explicit follow-ups.
```

**Specific inclusive dates:**

```text
Generate my calendar report from 2026-10-07 through 2026-10-13, including
both dates. Use my configured reporting timezone and deliver the offline HTML.
```

**One project and an explicit timezone:**

```text
Generate my calendar report for the last 3 calendar days including today,
using Europe/London as the reporting timezone. Include only the locally
registered project at /absolute/path/to/repo and deliver the offline HTML.
```

Replace the example dates and project path with yours. You can also request
several registered project paths in the same prompt. Source-project selection
controls which activity is included; delivery goes to the current reporting thread.

Every report is limited to **1–7 inclusive local calendar days**. Today contains
only activity collected so far. Without a requested range or week, the agent
uses the previous complete Monday–Sunday. Totals describe **estimated session
activity**, and the summary reports unavailable sources as coverage gaps.

## 4. Curated summaries and offline reports

```sh
node dist/cli.js collect --week 2026-10-05
# Inspect actual conversation outcomes and write an evidenced summary.
node dist/cli.js render --week 2026-10-05 --summary /path/to/summary.json
```

For a rolling collection with a curated summary, pin the dates returned by
`collect` before rendering. For example, a run resolving to October 7–13:

```sh
node dist/cli.js collect --last-days 7 --exclude-session CURRENT_RUN_SESSION_ID
# Inspect evidence/2026-10-07_to_2026-10-13.json and write its -summary.json.
node dist/cli.js render --from 2026-10-07 --to 2026-10-13 --exclude-session CURRENT_RUN_SESSION_ID
```

Use the actual returned dates rather than the example dates. Default curated
summary names are `REPORT_KEY-summary.json`; without curated input, the factual
fallback is used.

For an agent-assisted run from this checkout:

```sh
node dist/cli.js collect --previous-week --exclude-session CURRENT_RUN_SESSION_ID
# Inspect evidence/YYYY-MM-DD.json and write evidence/YYYY-MM-DD-summary.json.
node dist/cli.js render --previous-week --exclude-session CURRENT_RUN_SESSION_ID
kimaki upload-to-discord --session CURRENT_RUN_SESSION_ID /absolute/path/to/weeks/YYYY-MM-DD.html
```

Use the current run's actual session ID in both exclusions and delivery. Collection
and rendering generate local files; the upload command attaches them to Discord.

Summary input contains exactly three single-line `lines` and `followups` with
actual report session IDs. See [operations](docs/operations.md) for the schema
and delivery workflow. Without curated input, generation uses a factual fallback
and infers no follow-ups from commit absence.

Hours mean **estimated agent-session activity**, not human working time. Project
totals may exceed the overall union when projects overlap. Read the
[report contract](docs/report-contract.md) for provenance, timing, commits,
historical branches, and coverage semantics.

Source assets remain in `helpers/template.html` and `fonts/`; the installed CLI
resolves them relative to its package, independently of cwd and runtime storage.
Personal `evidence/`, `weeks/`, `preferences.json`, `config.json`, and
`local-profile.json` are ignored and excluded from the tarball.

## 5. Local npm installation and npx execution

```sh
npm pack --pack-destination weeks
# Substitute the absolute path printed by npm pack.
npm install --prefix /path/to/local-install /absolute/path/to/weektrace-0.0.0.tgz
npm exec --prefix /path/to/local-install -- weektrace report --previous-week
```

`npm exec` is npm's `npx` execution interface. From the local installation,
`npx --no-install weektrace report --previous-week` also runs the CLI.
There is no registry installation command yet. The package is private and its
publication script is disabled pending registry and licensing decisions.

## 6. Scheduling and Discord delivery

Use the same `report` command from an OS scheduler, or have a Kimaki reporting
agent run `collect`, supply an evidenced summary, then `render` and upload.
Scheduling remains external to the CLI. Kimaki cron expressions are UTC;
reporting-week boundaries use the configured local timezone and account for DST.

**Existing task #1 stays in TsCanvas**, on its existing Monday `0 12 * * 1`
schedule and task file. Its instructions permit lightweight tooling; use the Node
CLI via its absolute path when running from a delivery project. The task and
default runtime layout are preserved.

Read [operations](docs/operations.md) before generating or attaching a report.

## Shell completions

For a local installed binary, enable completion with
`weektrace completions install`, then restart your shell. Remove it
with `weektrace completions uninstall`. From source, use
`node dist/cli.js completions script --shell bash` to inspect the script first.

## Verify and develop

```sh
npm run check
npm run verify:package
```

TypeScript tests cover the eight baseline cases, frozen synthetic whole-report parity,
DST/week boundaries, inclusive ranges, rolling timezone boundaries, date validation,
range-specific cache/output names, clipped totals, safe embedding, source adapters,
and CLI configuration and filtering. Packaging verification installs a local tarball and executes it away
from the source root, with all temporary artifacts under ignored `weeks/`.

For UI changes, verify offline opening, themes, keyboard details/Escape/focus,
phone agenda, 1032px stacking, and wide alignment. See
[helper/design reference](helpers/README.md) and
[migration status](docs/typescript-migration.md).
