# Weekly report routine template

Copy this file into ignored `routines/` and replace every placeholder before use.
Configure scheduling separately after confirming the user's timezone and UTC cron.

- Read `<CHECKOUT>/tasks/weekly-work-calendar.md` and its linked instructions.
- Use `node <CHECKOUT>/dist/cli.js` with `--previous-week --timezone <IANA_ZONE>`.
- Include all locally registered projects and exclude this run's session ID.
- Inspect evidence, write the factual summary, and verify the offline HTML.
- Attach it to the current run's conversation in the configured delivery channel.
- Read `<DATA_DIR>/local-profile.json` if present for owner/delivery preferences;
  otherwise deliver without guessing an owner to mention.
- Report dates, estimated session activity, and coverage or delivery gaps.
- Open the local report or apply retention only if requested in the local copy.
- Leave code, Git history, and schedules unchanged during report generation.
