/**
 * Frozen output from the retired Python renderer (helpers/generate.py at 20cc40a),
 * captured before removal using fixture() from fixtures.ts. All evidence is synthetic.
 * Coverage prose is excluded: its hardcoded project count changed during migration.
 * Keep this independent of buildReport(); Git history retains the reference engine.
 */
export const baselineReport = {
  "week": "2026-10-05",
  "timezone": "America/Argentina/Buenos_Aires",
  "projects": [
    { "name": "App", "directory": "/synthetic/app", "color": "#b9a9f4", "hours": 0.8333333333333334, "gitAvailable": true, "sessions": 3 },
    { "name": "Research", "directory": "/synthetic/research", "color": "#9edcc6", "hours": 0.5, "gitAvailable": false, "sessions": 1 }
  ],
  "sessions": [
    {
      "id": "ses_one", "title": "Implement synthetic feature", "directory": "/synthetic/app", "project": "App",
      "guild": "", "thread": null, "models": ["synthetic-model"], "prompt": "Build the fixture feature.",
      "statusNow": "idle", "parent": null, "branchHints": ["feature"], "color": "#b9a9f4",
      "outcome": "Implemented the synthetic feature; tests passed.", "status": "1 linked commits",
      "commits": [{
        "repository": "/synthetic/app", "hash": "1234567abcdef", "time": 1791203400000,
        "subject": "Implement synthetic feature", "files": ["feature.ts"],
        "linked": [{ "id": "ses_one", "basis": "Session trailer" }], "possible": []
      }],
      "possible": [], "estimatedHours": 0.5
    },
    {
      "id": "ses_midnight", "title": "Cross midnight", "directory": "/synthetic/app", "project": "App",
      "guild": "", "thread": null, "models": ["synthetic-model"], "prompt": "Build the fixture feature.",
      "statusNow": "idle", "parent": null, "branchHints": ["feature"], "color": "#b9a9f4",
      "outcome": "Implemented the synthetic feature; tests passed.", "status": "No linked commits",
      "commits": [], "possible": [], "estimatedHours": 0.3333333333333333
    },
    {
      "id": "ses_isolated", "title": "Isolated event", "directory": "/synthetic/app", "project": "App",
      "guild": "", "thread": null, "models": ["synthetic-model"], "prompt": "Build the fixture feature.",
      "statusNow": "idle", "parent": null, "branchHints": ["feature"], "color": "#b9a9f4",
      "outcome": "Implemented the synthetic feature; tests passed.", "status": "No linked commits",
      "commits": [], "possible": [], "estimatedHours": 0
    },
    {
      "id": "ses_two", "title": "Research a synthetic design with a deliberately long title to inspect wrapping and keyboard details",
      "directory": "/synthetic/research", "project": "Research", "guild": "", "thread": null,
      "models": ["synthetic-model"], "prompt": "Build the fixture feature.", "statusNow": "idle", "parent": null,
      "branchHints": [], "color": "#9edcc6", "outcome": "No final response recorded in the reporting week; outcome unknown.",
      "status": "Git evidence unavailable", "commits": [], "possible": [], "estimatedHours": 0.5
    }
  ],
  "blocks": [
    { "session": "ses_one", "day": 0, "start": 1791201600000, "end": 1791203400000, "minute": 540, "duration": 30, "lane": 0, "lanes": 2 },
    { "session": "ses_midnight", "day": 0, "start": 1791255000000, "end": 1791255600000, "minute": 1430, "duration": 10, "lane": 0, "lanes": 1 },
    { "session": "ses_midnight", "day": 1, "start": 1791255600000, "end": 1791256200000, "minute": 0, "duration": 10, "lane": 0, "lanes": 1 },
    { "session": "ses_isolated", "day": 0, "start": 1791205200000, "end": 1791205200000, "minute": 600, "duration": 0, "lane": 0, "lanes": 1 },
    { "session": "ses_two", "day": 0, "start": 1791202500000, "end": 1791204300000, "minute": 555, "duration": 30, "lane": 1, "lanes": 2 }
  ],
  "daily": [0.9166666666666666, 0.16666666666666666, 0, 0, 0, 0, 0],
  "hours": 1.0833333333333333,
  "commits": 1,
  "possibleCommits": 0,
  "method": "Synthetic parity fixture using actual event timestamps.",
  "inventory": [{ "project": "/synthetic/app", "sessions": 4, "kimakiListed": 4, "excludedSubagents": 0 }],
  "summary": {
    "lines": [
      "4 sessions with recorded activity; inspect details for evidenced outcomes.",
      "Most estimated session activity: App.",
      "No follow-ups inferred automatically from commit absence."
    ],
    "followups": []
  },
  "branches": [{ "project": "App", "name": "feature", "commits": 1 }],
  "unattributedBranchCommits": 0
} as const
