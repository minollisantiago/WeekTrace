# Node.js / TypeScript migration direction

## Decision

Python served the first local implementation well: standard-library HTTP, JSON,
Git subprocesses, and timezone calculations required no pip dependencies. The
source task explicitly favored lightweight Python or equivalent tooling.

The intended distribution runtime is Node.js/TypeScript, matching Kimaki/OpenCode
users and enabling npm installation and `npx` execution. Preserve the current
HTML/CSS design, semantic evidence contract, and the Python tests as reference
cases. This document is a plan; the baseline has not been migrated.

## Target architecture

```text
OpenCode/Kimaki adapter + Git adapter
                 ↓
Normalized, provenance-bearing evidence
                 ↓
Week resolution + intervals + attribution + branch totals
                 ↓
Existing portable HTML renderer + factual summary input
                 ↓
Local files; optional Kimaki orchestration handles delivery
```

Scheduled and on-demand execution should call the same CLI. Collection and
rendering should work without asking an agent to reinvent the template. An agent
can still interpret outcomes and supply an evidenced narrative; deterministic
generation must have a factual fallback without an LLM.

## Proposed interface — not implemented

The package name is tentative and has not been checked or published:

```sh
npx work-calendar report --previous-week
npx work-calendar report --week 2026-10-05 --project /absolute/path/to/repo
```

## Migration sequence

1. Package source/assets separately from personal runtime data; choose package
   name and project license before public publication.
2. Define validated configuration for reporting timezone, project allowlists,
   output directory, theme defaults, and adapter/server discovery.
3. Port interval, midnight/week clipping, deduplication, branch attribution, and
   safe serialization. Verify against the existing tests plus cross-timezone
   daylight-saving boundary cases.
4. Port discovery and collection. Cover sessions older than the reporting week,
   documented API pagination/limits, worktrees, unavailable sources, and explicit
   reporting-session exclusion instead of relying only on title heuristics.
5. Port rendering while retaining the current approved UI and offline assets.
6. Implement explicit-week and previous-complete-week CLI execution; add
   single/multiple-project selection and configurable timezone.
7. Document npm/`npx` installation and Kimaki scheduled delivery. Expose local
   file generation separately so OS cron/task schedulers can invoke it too.
8. Verify a clean external installation and one scheduled/on-demand report before
   calling the distribution workflow ready.

## Acceptance criteria

- No dependency on a clone living at the fixed `~/.calendar/` source path.
- No machine-specific OpenCode port or Discord IDs in the distributable defaults.
- The same input produces the same intervals, counts, and attribution as baseline.
- A new user can select projects, choose a timezone, and generate with one CLI.
- The HTML opens offline and preserves accessibility, responsive layout, and theme controls.
- Every uncertain/unavailable source remains visible as a coverage gap.
- Existing scheduled task #1 changes only when explicitly requested.
