# Agent setup

Use this procedure when a user points an agent at the WeekTrace repository and
asks for a working local installation. Report the result of each completion gate;
an installed CLI is not proof that real activity collection works.

## 1. Prerequisites and scope

Read `AGENTS.md`, `README.md`, and `docs/operations.md`. Before generating a report,
also read `tasks/weekly-work-calendar.md` and `docs/report-contract.md`.

Determine the host OS and whether the terminal is native Windows or WSL. Use the
environment where the user's OpenCode/Kimaki activity lives; treat native Windows
and WSL as separate installations. Confirm Node.js 22+, npm, Git, `kimaki`, and
`opencode` are accessible, and inspect their help/version output.

**Explain the dependency:** WeekTrace needs the user to have and actually use
OpenCode and Kimaki. It reads retained local sessions in registered Kimaki projects;
it does not record earlier work retroactively or infer session time from Git alone.

Inspect `kimaki project list --json`. If prerequisites, local registrations,
authentication, or session history are missing, explain the missing item and ask
before installing/configuring other tools or registering projects. Let the user
complete interactive authentication themselves; keep credentials out of reports
and chat. With no real retained activity, report setup as awaiting activity rather
than fabricating a successful activity report.

**Gate:** the environment and prerequisite versions are known, and the user
understands whether their real activity is available.

## 2. Install without disturbing existing state

Reuse a checkout only after checking its branch and working-tree state. Otherwise
clone the repository into a user-approved directory. Use the requested revision
if one was supplied; do not discard local changes or overwrite personal config.
Run these commands separately, checking each exit status:

```text
npm ci
npm run check
npm run verify:package
node dist/cli.js --help
```

Native Windows uses PowerShell or CMD; no Unix utilities or Python are required
for these commands. If PowerShell blocks `npm.ps1`, use the installed `npm.cmd`
launcher instead of weakening the machine's execution policy.

Use the built CLI through its absolute `dist/cli.js` path from other directories.
Registry publication is deferred; do not substitute an unrelated npm package.

**Gate:** checks and installed-tarball verification pass, and CLI help works.
Report command failures explicitly and retain their diagnostics.

## 3. Configure and collect real evidence

Read existing runtime configuration first. Ask for the reporting IANA timezone
when none is configured; confirm the source projects, with all local registrations
as the offered default. Keep the checkout and personal runtime storage distinct
when appropriate. The default runtime directory is `.calendar` in the OS home.
Preserve unrelated settings, evidence, reports, and delivery preferences.

Use quoted absolute native paths. Windows JSON paths can use forward slashes or
escaped backslashes. Windows path matching treats drive-letter/UNC paths as
case-insensitive; case-sensitive Windows project directories are not supported.
WSL `/mnt/c/...` paths are not aliases for native Windows registrations.

Generate the requested 1–7-day range, or the previous complete Monday–Sunday when
none was requested, following the shared report procedure. Exclude the current
reporting session when its ID is known. Separate unavailable collection sources
from a genuinely empty range. Review real session evidence and Git coverage.

**Gate:** real discovery and collection succeed, or the precise coverage gap is
reported without claiming end-to-end success.

## 4. Open and hand off

Give the absolute generated HTML path and a reusable command using the selected
timezone/projects. The HTML opens offline without a local server. If the user
requests browser opening, use the host's native opener on the exact generated
file: PowerShell `Start-Process -FilePath` on Windows, `open` on macOS, or
`xdg-open` on desktop Linux. In WSL follow the shared task's Windows-path launcher.
Pass paths as data, not interpolated shell code. Successful launching is not
visual browser verification.

Scheduling and Discord uploads are optional: configure only when requested.
Ask for the timezone before adding a schedule, and preserve existing routines.
Existing host-specific schedules in operations are not new-user defaults.

**Gate:** the user has the report path, reusable command, chosen configuration,
and an explicit list of any unverified steps or coverage gaps.

## Native Windows release checklist

Linux-only checks cannot close this checklist. On a native Windows 11 machine:

- Run the build, tests, and package verification from PowerShell with Node.js 22+
  and Git for Windows, without relying on WSL/Git Bash utilities.
- Use a checkout/runtime/install directory containing spaces and Unicode.
- Confirm actual npm-installed Kimaki/OpenCode launchers work from WeekTrace,
  including authenticated discovery and paginated session/message collection.
- Select a real registered project using native drive paths; check separator/case
  variations, Git worktrees, commit evidence, and reported coverage gaps.
- Generate a real report, then render its cached evidence from another cwd.
- Open the HTML offline in a Windows browser and check details/theme controls.
- Record Windows, Node.js, Git, Kimaki, and OpenCode versions, commands, results,
  and remaining gaps before describing native Windows support as verified.

CI covers Linux/Windows build, regression tests, and local tarball execution on
Node.js 22 and 24. It uses synthetic evidence and does not replace the real-source
smoke test above. macOS has not yet been validated.
