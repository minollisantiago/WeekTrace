# WeekTrace identity

**Your agent work, week by week.**

## Name and mark

- Product name in prose: **WeekTrace**.
- Wordmark, local npm package, and executable: **weektrace**.
- Mark: the approved Week Trace concept, a single handwritten W-shaped activity trace.
- Source asset: [`assets/weektrace.svg`](../assets/weektrace.svg).

The symbol shares TsCanvas's confident stroke weight, rounded ends, and slightly
human irregularity. Its W connects the weekly view to the activity trace without
requiring a literal calendar icon.

## Color and typography

- Brand rose: **`#F23568`**. Keep the mark in this color across report themes.
- Supporting pink: **`#F77C9D`**, also the default report accent.
- Charcoal: **`#101014`**.
- Light presentation background: **`#F7F6F2`**.
- Wordmark: lowercase, compact bold sans-serif. The report uses system Arial/Helvetica.
- Report content: embedded JetBrains Mono, including its existing font license.

Keep comfortable space around the symbol. Preserve the SVG's proportions and
stroke shape; a one-color white version is suitable on rose/charcoal backgrounds.
Avoid effects that obscure the simple silhouette.

## Offline reports and compatibility

The shared report template embeds the logo inline and the favicon as a data URL.
No logo/font request is required. `assets/weektrace.svg` is included in local
tarballs for reuse, while personal reports and evidence stay outside distribution.

The same identity and tagline apply to weekly reports and on-demand 1–7-day
reports. Custom `--from`/`--to` dates are inclusive; `--last-days N` includes today.
Display the actual selected dates in report headings and browser titles, with
matching weekday labels, grid columns, and phone agenda days. See the
[report contract](report-contract.md) for timezone and range semantics.

Existing `~/.calendar` storage, task-file paths, and browser theme-preference key
are retained so the brand change preserves existing reports and preferences.
The local CLI now runs as `weektrace`; reinstall the local tarball to replace the
old `work-calendar-local` executable. Product naming does not imply registry-name
availability or publication. The package remains private and unpublished.
