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
- `src/baseline-report.fixture.ts`: frozen synthetic report output for regression checks.
- `scripts/verify-package.mjs`: local tarball inspection and installed CLI execution.

Keeping the approved template retains
the separately approved hover-card improvements committed during migration planning.
The template includes WeekTrace's approved identity and embedded favicon, plus
timezone-correct date labels and configurable theme defaults.

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

- Run the 8 baseline timing/branch cases ported to TypeScript.
- Compare normalized whole-report data against frozen synthetic reference output.
- Test DST weeks, local Monday boundaries, old-session actual activity, branch
  conflicts/prefix ambiguity, safe serialization, curated follow-ups, configuration,
  project filtering, documented API limits, and commit-tree file evidence.
- Verify browser controls offline at desktop, 1032px stacking, and phone sizes.
- Install a local npm tarball, inspect its file list, and execute the installed CLI
  outside the source root using npm's npx execution interface.
- Exercise real automatic discovery and a scheduler-style previous-week invocation.

Run `npm run check` and `npm run verify:package` from a source checkout. Development
checks and local package verification require Node.js and Git; real collection also
uses the Kimaki CLI and local OpenCode servers.

## Regression fixtures

`src/fixtures.ts` supplies synthetic evidence, and `src/baseline-report.fixture.ts`
stores independent expected report output. Keep the expected fixture independent
of the implementation under test. Whole-report comparison covers sessions, blocks,
totals, attribution, and summaries; coverage prose and branding/date additions are
checked separately where applicable.

## Publication remains deferred

The approved product identity is **WeekTrace**, with `weektrace` as the local
package/bin name. Version `0.0.0` and private status remain in place. Registry-name
availability, code license, and npm publishing workflow remain deferred. Source is
hosted at [minollisantiago/WeekTrace](https://github.com/minollisantiago/WeekTrace),
with repository/homepage/issue metadata configured. No public registry command is
documented as available.

Scheduling and delivery remain Kimaki/OS orchestration. Existing task #1 in TsCanvas
is preserved. Its task file permits equivalent lightweight tooling; the Node CLI
works from that delivery project with an absolute executable path. A schedule/task
retargeting still requires explicit approval.
