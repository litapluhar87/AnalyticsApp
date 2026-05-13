# RACL Stats App — Phase 2: Scorecard Ingestion Pipeline

> Automated PDF scorecard → JSON data → live site pipeline powered by GitHub Actions + Claude API.

---

## How it works

```
You upload PDF (GitHub mobile)
        ↓
GitHub Action triggers automatically
        ↓
parse_scorecard.js  →  Claude API reads the PDF
        ↓
mom_engine.js       →  calculates Man of the Match from MVP rules
        ↓
append_match.js     →  appends to {type}_matches.json + {type}_mvp.json
        ↓
npm run migrate     →  regenerates _players, _partnerships, _mvp derived files
        ↓
npm run build + deploy  →  site goes live at litapluhar87.github.io/AnalyticsApp
```

No terminal. No laptop. Just upload the PDF.

---

## Uploading a scorecard (step by step)

### 1. Rename the PDF before uploading

Use the naming convention exactly:

```
{Type}{Format}{Season}{Match}{Ground}.pdf
```

| Segment | Length | Values | Example |
|---|---|---|---|
| Type | 1 char | `B` = Box, `C` = Classic, `P` = Pair | `B` |
| Format | 2 chars | `12` = T12, `T6` = T6, `TS` = Test | `12` |
| Season | 2 digits | Zero-padded | `06` |
| Match | 2 digits | Zero-padded | `07` |
| Ground | 2 chars | Code from `grounds.config.json` | `SG` |

**Examples:**

| Filename | Meaning |
|---|---|
| `B120607SG.pdf` | Box, T12, Season 6, Match 7, Sangvi |
| `CTS0313MS.pdf` | Classic, Test, Season 3, Match 13, Moshi |
| `C120601WK.pdf` | Classic, T12, Season 6, Match 1, Wakad |
| `BTS0501RT.pdf` | Box, Test, Season 5, Match 1, Royal Turf |

### 2. Add a new player first (if needed)

If the match has a player not previously in the system, add them to `src/config/players.config.json` **before** uploading the scorecard. Otherwise the pipeline will fail with an unknown player error and file a GitHub Issue.

```json
{
  "Mangesh Lokhande":     "Mangesh",
  "Machhindra Deshmukh":  "Macchi",
  "Sandip Dhakane":       "Sandy D",
  "Sandeep Naikwadi":     "Sandy N",
  "New Player Full Name": "NewCanonical"
}
```

Commit that change first, then upload the PDF.

### 3. Upload via GitHub mobile

1. Open the `AnalyticsApp` repo in the GitHub mobile app
2. Navigate to the `scorecards/` folder
3. Tap **+** → **Upload file**
4. Select the renamed PDF from your phone
5. Commit directly to `main`

The pipeline triggers automatically within seconds.

### 4. Monitor the pipeline

Go to **Actions** tab in the GitHub repo. You'll see a run named `Scorecard Ingestion Pipeline` in progress. It takes roughly 2–3 minutes end to end.

- ✅ Green = scorecard ingested, site deployed
- ❌ Red = something failed → a GitHub Issue has been automatically filed with details

---

## Ground codes

Maintained in `src/config/grounds.config.json`. Current codes:

| Code | Ground |
|---|---|
| `SG` | Sangvi |
| `MS` | Moshi |
| `WK` | Wakad |
| `BW` | Balewadi |
| `HJ` | Hinjewadi |
| `RT` | Royal Turf |
| `SD` | Saudagar |

To add a new ground: edit `grounds.config.json`, add `"XX": "Ground Name"`, commit, then use the new code in future filenames.

---

## Man of the Match calculation

MoM is **not read from the scorecard** — it is calculated by the pipeline using the MVP points system.

### Points system

**Batting** (per innings, aggregated across all innings for Test):
- 1 pt per run
- +1 per four, +2 per six
- Strike rate bonus/penalty vs threshold (Box: 100, Classic: 75)
- Milestone bonuses: Box 15/30/50/100 runs, Classic 30/50/100 runs
- Not-out bonus: +20% of batting points if ≥ 8 batting points

**Bowling** (per spell, aggregated):
- Bowled/Hit wicket: 12 pts | Caught/Stumped/LBW (Classic): 10 pts
- Maiden over: 5 pts
- Economy bonus/penalty vs expected (Box: 6.0, Classic: 4.5)
- Milestone bonuses: 2/3/4/5 wickets

**Fielding**:
- Catch: 5 pts | Stumping: 5 pts
- Direct run out: 8 pts | Combo run out: 4 pts each

### MoM decision logic

```
1. Rank all players by total MVP points
2. Topper = highest scorer

3. If match is a Tie       → Topper is MoM
4. If Topper's team won    → Topper is MoM
5. If Topper's team lost:
     Find NextWinner = highest scorer from winning team
     gap = Topper.points - NextWinner.points
     If gap > momOverridePoints (22) → Topper is MoM
     Else                            → NextWinner is MoM
```

`momOverridePoints` is configured per sport in `box.config.json` and `classic.config.json` under `mvpRules.momOverridePoints`.

---

## What happens when something fails

The pipeline files a GitHub Issue automatically. Three types:

| Issue title | Cause | Fix |
|---|---|---|
| `❌ Parse failed: X.pdf` | Unknown player, bad filename, Claude API error | Check issue body for specific error. Fix config, re-upload. |
| `⚠️ Duplicate match: X.pdf` | Match already exists in data | If intentional re-parse: manually delete existing entry from `{type}_matches.json`, re-upload. |
| `❌ Pipeline failure: X.pdf` | MoM engine, append, migrate, or deploy error | Check Actions logs. Data rolled back automatically via `.bak` files. |

---

## Scripts reference

All scripts live in `scripts/` and can be run locally for testing:

```bash
# Parse a scorecard only (no API call needed if testing JSON flow)
node scripts/parse_scorecard.js scorecards/B120607SG.pdf

# Run MoM engine on a parsed output file
node scripts/mom_engine.js scripts/output/B120607SG.json

# Append a processed match file to data
node scripts/append_match.js scripts/output/B120607SG.json

# Full local test (requires ANTHROPIC_API_KEY in .env)
node scripts/parse_scorecard.js scorecards/B120607SG.pdf && \
node scripts/mom_engine.js scripts/output/B120607SG.json && \
node scripts/append_match.js scripts/output/B120607SG.json && \
npm run migrate
```

Local output files land in `scripts/output/` which is gitignored.

---

## GitHub Secrets required

Set in: **GitHub repo → Settings → Secrets and variables → Actions**

| Secret | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (`sk-ant-...`) |
| `GH_PAGES_TOKEN` | Personal Access Token with `repo` + `pages` scope — needed for gh-pages deploy |

---

## Config files quick reference

| File | Purpose |
|---|---|
| `src/config/players.config.json` | Scorecard name → canonical player ID mapping |
| `src/config/grounds.config.json` | 2-letter ground code → full ground name |
| `src/config/box.config.json` | Box cricket MVP rules, MoM threshold, season config |
| `src/config/classic.config.json` | Classic cricket MVP rules, MoM threshold, season config |
| `src/config/awards.config.json` | Season-level awards (MoS, Orange Cap, Purple Cap) |

---

## Full commit checklist (Phase 2 go-live)

```
✅  .github/workflows/scorecard_pipeline.yml
✅  scripts/parse_scorecard.js
✅  scripts/mom_engine.js
✅  scripts/append_match.js
✅  scorecards/.gitkeep
✅  src/config/players.config.json
✅  src/config/grounds.config.json
✅  .gitignore  (scripts/output/ added)
✅  README_PHASE2.md
```

GitHub Secrets set:
```
✅  ANTHROPIC_API_KEY
✅  GH_PAGES_TOKEN
```

---

*RACL Phase 2 — built with GitHub Actions + Claude API*
