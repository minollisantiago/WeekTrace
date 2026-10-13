# Node.js / TypeScript migration

## Implemented architecture

```text
goke CLI + validated local configuration
                    ↓
Kimaki discovery → documented OpenCode GET APIs + Git adapter
                    ↓
Typed, sanitized evidence with provenance and visible coverage gaps
                    ↓
Temporal week boundaries → intervals, union totals and branch attribution
                    ↓
Approved HTML template + embedded font/license + evidenced/fallback summary
                    ↓
Ignored local evidence and output files
```

The private package targets Node.js 22+, builds ESM and declarations with `tsc`,
uses goke/Zod for typed CLI inputs, errore for domain-error values, and the Temporal
polyfill for timezone-safe date arithmetic. Relative source imports use `.ts`;
the compiler rewrites them to `.js` in `dist/`.

## Source and assets

- `src/commands.ts`, `cli.ts`, `config.ts`, `run.ts`: shared report/collect/render CLI.
- `src/adapters/`: Kimaki discovery, validated OpenCode GET responses, Git subprocesses.
- `src/schema.ts`, `evidence.ts`, `time.ts`, `report.ts`: evidence and deterministic calculations.
- `src/render.ts`: package-relative asset loading and safe one-pass embedding.
- `assets/weektrace.svg`: approved WeekTrace handwritten W mark.
- `helpers/template.html`, `fonts/`: shared approved design and offline assets.
- `helpers/*.py`: untouched Python reference engine and eight regression tests.
- `scripts/verify-package.mjs`: local tarball inspection and installed CLI execution.

Keeping one shared template avoids divergent Python/TypeScript designs and retains
the separately approved hover-card improvements committed during migration planning.
The template includes WeekTrace's approved identity and embedded favicon, plus
timezone-correct date labels and configurable theme defaults. Python reports retain
their existing date fallback and pink theme default.

## CLI and runtime

`report` collects and renders; `collect` and `render` expose the same stages for
agent-curated summaries. Both explicit Monday and previous-complete-week modes
support timezone, repeatable project filters, automatic per-project server
discovery, output/runtime paths, explicit reporting-session exclusions, and
curated summary input. CLI overrides local config, then defaults apply.

Default runtime storage remains `~/.calendar`, but package assets have no dependency
on installation there. Configured runtime paths must be writable and personal.
The npm `files` allowlist excludes all evidence, reports, colors, config, and
delivery profiles. No Discord IDs or OpenCode port are embedded in package defaults.

## Verification gates

- Re-run the 8 Python tests and reproduce their cases in TypeScript.
- Compare normalized whole-report data against Python using synthetic evidence.
- Test DST weeks, local Monday boundaries, old-session actual activity, branch
  conflicts/prefix ambiguity, safe serialization, curated follow-ups, configuration,
  project filtering, documented API limits, and commit-tree file evidence.
- Verify browser controls offline at desktop, 1032px stacking, and phone sizes.
- Install a local npm tarball, inspect its file list, and execute the installed CLI
  outside the source root using npm's npx execution interface.
- Exercise real automatic discovery and a scheduler-style previous-week invocation.

Run `npm run check` and `npm run verify:package` from a source checkout. Python is
required for parity development tests only; shipped report generation uses Node.

## Publication remains deferred

The approved product identity is **WeekTrace**, with `weektrace` as the local
package/bin name. Version `0.0.0` and private status remain in place. Registry-name
availability, code license, and npm publishing workflow remain deferred. Source is
hosted at [minollisantiago/WeekTrace](https://github.com/minollisantiago/WeekTrace),
with repository/homepage/issue metadata configured. No public registry command is
documented as available.

Scheduling and delivery remain Kimaki/OS orchestration. Existing task #1 in TsCanvas
is preserved and continues to use its existing Python workflow until the user
explicitly approves a schedule/task change.
