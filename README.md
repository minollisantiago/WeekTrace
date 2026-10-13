# Work Calendar

A personal weekly calendar of coding-agent activity, generated from locally
retained OpenCode sessions and Git evidence. One self-contained HTML file opens
offline in a browser; no application server or frontend framework is needed to
view it.

This repository captures the working **Python baseline** before a planned
Node.js/TypeScript migration. There is no published npm package or working `npx`
command yet.

## What it does

- Displays a Monday–Sunday calendar with selectable session intervals and an agenda.
- Estimates activity from actual message/tool timestamps, merging overlaps.
- Shows prompts, response excerpts, models, Discord links, commits, and changed files.
- Lists historical branches and commits made on each, using recorded commit output.
- Includes daily activity, project totals, and an evidence-based weekly summary.
- Embeds JetBrains Mono and offers five theme colors, with a lighter pink default.
- Fits the viewport; stacks calendar/summary at 1032px and uses an agenda on phones.

Hours represent **estimated agent-session activity**, not human working hours.
Commit absence is not a failure classification. See [the evidence contract](docs/report-contract.md).

## 1. Install the current baseline

Requirements: Python 3.9+ with timezone data, Git, the Kimaki CLI, and access to the
local OpenCode server retaining the sessions you want to report.

Install this checkout at **`~/.calendar/`**. The current helpers read templates,
font assets, and runtime files from that fixed directory. If you downloaded the
source elsewhere, copy `helpers/`, `fonts/`, and the documentation/task files here.

```text
~/.calendar/
├── README.md, AGENTS.md, docs/, tasks/   Instructions and operating contract
├── helpers/                            Collector, renderer, tests, HTML template
├── fonts/                              JetBrains Mono + SIL Open Font License
├── evidence/                           Local activity cache; ignored by Git
├── weeks/                              HTML, Markdown, previews; ignored by Git
└── preferences.json                    Local project colors; ignored by Git
```

Create `evidence/` and `weeks/` if they do not exist. Register source projects with
Kimaki and verify `kimaki project list --json` returns their local directories.
The font license is included in every generated HTML file.

## 2. Run on demand

### With an agent in Discord

Ask an agent with access to this machine:

> Read `~/.calendar/tasks/weekly-work-calendar.md`. Generate, verify, and attach my
> calendar for the previous complete week, reusing `~/.calendar/helpers/`.

You can instead request a specific week, for example October 5–11, 2026, in
America/Argentina/Buenos_Aires. An agent determines the week, writes the evidenced
summary, verifies the output, and attaches it to the current thread.

### With Kimaki

Replace the path with an existing registered reporting project. Without
`--send-at`, this starts immediately in a new thread:

```sh
kimaki send \
  --project '/absolute/path/to/reporting-project' \
  --prompt 'Read ~/.calendar/tasks/weekly-work-calendar.md and generate, verify, and attach the previous complete week’s work calendar.' \
  --agent build
```

### Directly with Python

Find the current server port from Kimaki CLI discovery output, for example by
running `kimaki session list --project /absolute/project/path --json`.

```sh
python ~/.calendar/helpers/collect.py \
  --week 2026-10-05 \
  --api http://127.0.0.1:PORT

python ~/.calendar/helpers/generate.py --week 2026-10-05
```

Replace `PORT` with the actual OpenCode server port. `--week` is the reporting
Monday, not the execution date. Output: `~/.calendar/weeks/2026-10-05.html` and the
adjacent three-line `.md` summary.

Direct Python execution generates files but does not upload them. Without a
curated `evidence/YYYY-MM-DD-summary.json`, the renderer uses a neutral factual
summary. See [operations](docs/operations.md) for summary fields and delivery.

## 3. Choose projects

**Delivery project and evidence scope are separate.**

- `kimaki send --project ...` chooses the agent's working project and Discord channel.
- The current collector includes **all locally registered Kimaki projects**.
- Their directories identify OpenCode sessions and Git repositories/worktrees.
- A Git repository alone cannot establish timestamped coding-agent activity.

The Python collector currently has no single-project filter. An explicit
`--project`/project allowlist is planned for the TypeScript CLI; do not confuse
Kimaki's delivery option with a collector filter that does not exist.

## 4. Run weekly

Kimaki supplies scheduling and Discord delivery; an agent orchestrates the same
collector and renderer used on demand:

```text
Scheduled Kimaki prompt → collect evidence → write evidenced summary
                       → render existing template → verify → attach HTML
```

For a new user's machine, personalize the reporting project and schedule:

```sh
kimaki send \
  --project '/absolute/path/to/reporting-project' \
  --prompt 'Read ~/.calendar/tasks/weekly-work-calendar.md and generate, verify, and attach the previous complete week’s work calendar.' \
  --send-at '0 12 * * 1' \
  --agent build
```

This example runs **Monday at 12:00 UTC**, equivalent to **09:00 Buenos Aires**.
Kimaki cron expressions are UTC. Other reporting timezones require code changes
in this baseline, and their scheduling offsets may change with daylight saving.

The host, Kimaki, model access, and the local OpenCode server must be available
when the task runs. Inspect/manage existing tasks with `kimaki task list`,
`kimaki task edit`, and `kimaki task delete`; edit an existing schedule instead of
creating duplicates.

**Existing deployment:** task #1 currently runs through the TsCanvas project and
reads `tasks/weekly-work-calendar.md` there. It already uses Monday `0 12 * * 1`.
The standalone project/channel registration does not move or replace that task.

## 5. Why Python, and why migrate?

Python was chosen for a lightweight, standard-library-only local prototype:
HTTP, JSON, timezone conversion, and Git subprocesses needed no pip dependencies.
The original task explicitly favored this approach.

For distribution to Kimaki/OpenCode users, Node.js/TypeScript is the intended
direction: npm installation, `npx` execution, typed configuration, and a familiar
runtime. The existing HTML/CSS design and evidence semantics should carry over.

See [the migration plan](docs/typescript-migration.md). The proposed npm commands
there are design targets, not commands available in this version.

## Verify and develop

```sh
python ~/.calendar/helpers/test_timing.py
python ~/.calendar/helpers/test_branches.py
```

For UI changes, render a report and check offline `file://` opening, details,
keyboard access, mobile layout, 1032px stacking, and maximum-width grid alignment.
See [helper reference](helpers/README.md) for renderer and design details.

Source code, documentation, and font assets are versioned. Personal evidence,
generated reports, preferences, and local profile settings are ignored. No remote
repository, publication, or project-wide license has been selected yet; the
bundled font retains its existing SIL Open Font License.
