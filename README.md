# Work Calendar

Generate a self-contained weekly HTML calendar from locally retained OpenCode
sessions, registered Kimaki projects, and Git evidence. Reports open offline,
with an embedded font, theme picker, keyboard-accessible details, and phone agenda.

The shared **Node.js/TypeScript CLI** now handles on-demand and scheduler-driven
generation. The Python helpers remain a reference implementation. No package has
been published; `work-calendar-local` is a temporary private package/bin name.
Public package naming, repository metadata, and the project license remain undecided.
The bundled font retains its SIL Open Font License.

## 1. Install and run locally

Requirements: **Node.js 22+**, Git, the Kimaki CLI, and access to local OpenCode
servers retaining the sessions to report. Python 3.9+ is needed only for baseline
parity tests, not for the installed CLI.

```sh
npm ci
npm run build
node dist/cli.js report --previous-week
node dist/cli.js report --week 2026-10-05 --project /absolute/path/to/repo
```

These source commands run from the checkout root. From another working directory,
use the absolute executable path, for example
`node /home/your-user/.calendar/dist/cli.js report --previous-week`.

Automatic discovery runs `kimaki project list --json` and per-project
`kimaki session list --project PATH --json`, then verifies the discovered server's
`/doc`. If discovery cannot locate a server, supply `--api http://127.0.0.1:PORT`.
Unavailable APIs, retained-history limits, and unavailable Git remain coverage gaps.

The week is Monday 00:00 inclusive to next Monday 00:00 exclusive in the reporting
timezone. `--previous-week` selects the previous **complete** local week. Explicit
`--week` dates must be Mondays. Choose exactly one week option.

## 2. Commands and configuration

- `report`: collect evidence and render HTML plus a three-line Markdown summary.
- `collect`: save sanitized evidence for inspection and curated summaries.
- `render`: regenerate from cached evidence without fetching sessions or Git.

Shared flags:

| Flag | Purpose |
| --- | --- |
| `--week YYYY-MM-DD` / `--previous-week` | Explicit Monday or previous complete week |
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

## 3. Curated summaries and offline reports

```sh
node dist/cli.js collect --week 2026-10-05
# Inspect actual conversation outcomes and write an evidenced summary.
node dist/cli.js render --week 2026-10-05 --summary /path/to/summary.json
```

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

## 4. Local npm installation and npx execution

```sh
npm pack --pack-destination weeks
# Substitute the absolute path printed by npm pack.
npm install --prefix /path/to/local-install /absolute/path/to/work-calendar-local-0.0.0.tgz
npm exec --prefix /path/to/local-install -- work-calendar-local report --previous-week
```

`npm exec` is npm's `npx` execution interface. From the local installation,
`npx --no-install work-calendar-local report --previous-week` also runs the CLI.
There is no registry installation command yet. The package is private and its
publication script is disabled pending naming/license decisions.

## 5. Scheduling and Discord delivery

Use the same `report` command from an OS scheduler, or have a Kimaki reporting
agent run `collect`, supply an evidenced summary, then `render` and upload.
Scheduling remains external to the CLI. Kimaki cron expressions are UTC;
reporting-week boundaries use the configured local timezone and account for DST.

**Existing task #1 stays in TsCanvas**, on its existing Monday `0 12 * * 1`
schedule and task file. This migration does not retarget or modify it. The Python
reference helpers and default runtime layout remain available for that workflow.

Read [operations](docs/operations.md) before generating or attaching a report.

## Shell completions

For a local installed binary, enable completion with
`work-calendar-local completions install`, then restart your shell. Remove it
with `work-calendar-local completions uninstall`. From source, use
`node dist/cli.js completions script --shell bash` to inspect the script first.

## Verify and develop

```sh
npm run check
python helpers/test_timing.py
python helpers/test_branches.py
npm run verify:package
```

TypeScript tests cover the eight baseline cases, synthetic whole-report parity,
DST/week boundaries, safe embedding, source adapters, and CLI configuration and
filtering. Packaging verification installs a local tarball and executes it away
from the source root, with all temporary artifacts under ignored `weeks/`.

For UI changes, verify offline opening, themes, keyboard details/Escape/focus,
phone agenda, 1032px stacking, and wide alignment. See
[helper/design reference](helpers/README.md) and
[migration status](docs/typescript-migration.md).
