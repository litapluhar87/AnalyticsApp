// scripts/parse_scorecard.js
// Phase 2 — RACL Scorecard Parser
// Usage: node scripts/parse_scorecard.js <path-to-pdf>
// e.g.   node scripts/parse_scorecard.js scorecards/B120607SG.pdf
//
// Reads PDF → sends to Claude API → returns structured match JSON
// Player names resolved via src/config/players.config.json
// Ground codes resolved via src/config/grounds.config.json
// Dummy players are silently skipped
// Output written to scripts/output/<filename>.json for inspection

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Config paths (relative to repo root) ────────────────────────────────────
const PLAYERS_CONFIG = path.resolve(__dirname, '../src/config/players.config.json');
const GROUNDS_CONFIG = path.resolve(__dirname, '../src/config/grounds.config.json');

// ─── Filename parser ──────────────────────────────────────────────────────────
// Format: B120607SG.pdf
//   [0]   = type      B/C/P
//   [1-2] = format    12 → T12 | T6 → T6 | TS → Test
//   [3-4] = season    06 → 6
//   [5-6] = matchNum  07 → 7
//   [7-8] = ground    SG → looked up in grounds.config.json

const FORMAT_MAP = {
  '12': 'T12',
  'T6': 'T6',
  'TS': 'Test',
  'T8': 'T8',
};

const TYPE_MAP = {
  'B': 'box',
  'C': 'classic',
  'P': 'pair',
};

function parseFilename(filename) {
  const base = path.basename(filename, '.pdf');
  if (base.length < 9) {
    throw new Error(`Filename too short to parse: ${base}. Expected format like B120607SG`);
  }

  const typeCode   = base[0].toUpperCase();
  const fmtCode    = base.slice(1, 3).toUpperCase();
  const season     = parseInt(base.slice(3, 5), 10);
  const matchNum   = parseInt(base.slice(5, 7), 10);
  const groundCode = base.slice(7, 9).toUpperCase();

  const type   = TYPE_MAP[typeCode];
  const format = FORMAT_MAP[fmtCode];

  if (!type)   throw new Error(`Unknown type code '${typeCode}' in filename ${base}`);
  if (!format) throw new Error(`Unknown format code '${fmtCode}' in filename ${base}`);
  if (isNaN(season))   throw new Error(`Cannot parse season from '${base.slice(3,5)}'`);
  if (isNaN(matchNum)) throw new Error(`Cannot parse matchNum from '${base.slice(5,7)}'`);

  // Resolve ground from config
  const grounds = JSON.parse(fs.readFileSync(GROUNDS_CONFIG, 'utf8'));
  const ground  = grounds[groundCode];
  if (!ground) throw new Error(`Unknown ground code '${groundCode}'. Add it to grounds.config.json`);

  return { type, format, season, matchNum, ground, groundCode };
}

// ─── Build the Claude prompt ──────────────────────────────────────────────────
// This is the most critical piece — the prompt IS the schema contract.

function buildPrompt(meta, playersConfig) {
  const isTest      = meta.format === 'Test';
  const inningsCount = isTest ? 4 : 2;
  const playerMap   = JSON.stringify(playersConfig, null, 2);

  return `You are a cricket scorecard data extractor for RACL (a private cricket league).

Your job is to read this scorecard PDF and return a single JSON object matching the exact schema below.
Return ONLY valid JSON. No explanation, no markdown, no code fences. Just the raw JSON object.

━━━ MATCH METADATA (already resolved — do NOT change these fields) ━━━
{
  "season":   ${meta.season},
  "matchNum": ${meta.matchNum},
  "type":     "${meta.type}",
  "format":   "${meta.format}",
  "ground":   "${meta.ground}"
}

━━━ FIELDS YOU MUST EXTRACT FROM THE SCORECARD ━━━

"date"     : Match date in YYYY-MM-DD format. Read from Match Details section. If not visible, use null.
"team1"    : Full team name of the team that batted FIRST (i.e. the team whose 1st innings opens the scorecard).
"team2"    : Full team name of the other team.
"batFirst" : Same as team1 (the team that batted first).
"score1"   : team1's 1st innings score as "runs/wickets" e.g. "74/8". For all-out use wicket count.
"overs1"   : team1's 1st innings overs as a string e.g. "16.2".
"score2"   : team2's 1st innings score.
"overs2"   : team2's 1st innings overs.
"result"   : Full result string exactly as shown e.g. "Rising Abhyuday Warriors won by 6 runs" or "Tie".
"winner"   : Winning team's full name. If tie, use "Tie".

━━━ INNINGS ARRAY ━━━

This match has exactly ${inningsCount} innings.
${isTest ? 'Order: team1 1st inn → team2 1st inn → team1 2nd inn → team2 2nd inn.' : 'Order: team that batted first → team that batted second.'}

Each innings object:
{
  "team":        full team name (batting team),
  "score":       "runs/wickets",
  "overs":       "X.Y" as string,
  "bowlingTeam": full team name (bowling team),
  "extras":      integer total extras (wides + no-balls + byes etc),
  "batters": [ ... ],
  "bowlers": [ ... ],
  "fow":     [ ... ],
  "dnb":     [ ... ]
}

━━━ BATTER OBJECT ━━━
{
  "player":      canonical name from player map (see below),
  "runs":        integer,
  "balls":       integer,
  "fours":       integer,
  "sixes":       integer,
  "dismissal":   full dismissal string using canonical names e.g. "c Amol b Sandy D",
  "dismissType": one of: "b" | "c" | "ro" | "st" | "lbw" | "h" | "" (not out),
  "fielder":     canonical name of fielder, or "" if not applicable,
  "bowler":      canonical name of bowler, or "" if run out / not out
}

DISMISSAL RULES:
- bowled          → dismissType "b",  fielder ""
- caught          → dismissType "c",  fielder = catcher's canonical name
- caught & bowled → dismissType "c",  fielder "" (bowler IS the catcher — do NOT put "&" in fielder)
  dismissal string should be "c & b <BowlerName>"
- run out         → dismissType "ro", bowler "",  fielder = "Fielder1 / Fielder2" if combo
- stumped         → dismissType "st", fielder = keeper name
- lbw             → dismissType "lbw", fielder ""
- hit wicket      → dismissType "h",  fielder ""
- not out         → dismissType "",   fielder "", bowler ""

━━━ BOWLER OBJECT ━━━
{
  "player":  canonical name,
  "overs":   number e.g. 3.4 (NOT a string),
  "maidens": integer,
  "runs":    integer,
  "wickets": integer,
  "economy": number rounded to 2 decimal places (runs / overs, where .4 means 4 balls = 4/6 of an over)
}

Economy calculation: convert overs to decimal first. 3.4 overs = 3 + 4/6 = 3.667 overs. economy = runs / decimal_overs.

━━━ FALL OF WICKETS ARRAY ━━━
Each entry:
{ "wicket": integer, "player": canonical name of dismissed batsman, "runs": integer, "overs": "X.Y" string }

━━━ DNB (DID NOT BAT) ARRAY ━━━
List of canonical player names who were listed in the squad but did not bat.
If no DNB players, use [].

━━━ PLAYER NAME MAPPING ━━━
CRITICAL: Every player name in your output (batters, bowlers, fielders, bowlers, fow, dnb, mom) 
MUST be the canonical name from this map. Look up the scorecard name → canonical name.
If a name does not appear in this map, output "__UNKNOWN__:<scorecard_name>" so it can be flagged.
ALWAYS skip any player named "Dummy" entirely — do not include them anywhere in the output.

Player map (scorecard name → canonical name):
${playerMap}

━━━ COMPLETE OUTPUT SCHEMA ━━━
{
  "season":   ${meta.season},
  "matchNum": ${meta.matchNum},
  "type":     "${meta.type}",
  "format":   "${meta.format}",
  "ground":   "${meta.ground}",
  "date":     "<YYYY-MM-DD or null>",
  "team1":    "<team name>",
  "team2":    "<team name>",
  "batFirst": "<team name>",
  "score1":   "<runs/wkts>",
  "overs1":   "<X.Y>",
  "score2":   "<runs/wkts>",
  "overs2":   "<X.Y>",
  "result":   "<result string>",
  "winner":   "<team name or Tie>",
  "innings": [
    {
      "team":        "<batting team>",
      "score":       "<runs/wkts>",
      "overs":       "<X.Y>",
      "bowlingTeam": "<bowling team>",
      "extras":      0,
      "batters":     [],
      "bowlers":     [],
      "fow":         [],
      "dnb":         []
    }
  ]
}

Remember: Return ONLY the JSON object. No text before or after it.`;
}

// ─── Call Claude API ──────────────────────────────────────────────────────────

async function callClaudeAPI(pdfBase64, prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type:       'base64',
                media_type: 'application/pdf',
                data:       pdfBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  return text;
}

// ─── Validate parsed output ───────────────────────────────────────────────────

function validateOutput(parsed) {
  const errors = [];

  // Required top-level fields
  const required = ['season','matchNum','type','format','ground','team1','team2',
                    'batFirst','score1','overs1','score2','overs2','result','winner','innings'];
  for (const f of required) {
    if (parsed[f] === undefined) errors.push(`Missing field: ${f}`);
  }

  // Innings count
  const expectedInnings = parsed.format === 'Test' ? 4 : 2;
  if (!Array.isArray(parsed.innings)) {
    errors.push('innings must be an array');
  } else if (parsed.innings.length !== expectedInnings) {
    errors.push(`Expected ${expectedInnings} innings for format ${parsed.format}, got ${parsed.innings.length}`);
  }

  // Check for unknown players
  const unknownPlayers = new Set();
  function scanForUnknowns(obj) {
    if (typeof obj === 'string' && obj.startsWith('__UNKNOWN__:')) {
      unknownPlayers.add(obj.replace('__UNKNOWN__:', ''));
    } else if (Array.isArray(obj)) {
      obj.forEach(scanForUnknowns);
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(scanForUnknowns);
    }
  }
  scanForUnknowns(parsed);
  if (unknownPlayers.size > 0) {
    errors.push(`Unknown players found (add to players.config.json): ${[...unknownPlayers].join(', ')}`);
  }

  // Validate each innings
  if (Array.isArray(parsed.innings)) {
    parsed.innings.forEach((inn, i) => {
      const prefix = `innings[${i}]`;
      if (!inn.team)        errors.push(`${prefix}: missing team`);
      if (!inn.bowlingTeam) errors.push(`${prefix}: missing bowlingTeam`);
      if (!Array.isArray(inn.batters))  errors.push(`${prefix}: batters must be array`);
      if (!Array.isArray(inn.bowlers))  errors.push(`${prefix}: bowlers must be array`);
      if (!Array.isArray(inn.fow))      errors.push(`${prefix}: fow must be array`);
      if (!Array.isArray(inn.dnb))      errors.push(`${prefix}: dnb must be array`);
      if (typeof inn.extras !== 'number') errors.push(`${prefix}: extras must be a number`);

      const validDismissTypes = new Set(['b','c','ro','st','lbw','h','']);
      (inn.batters || []).forEach((b, j) => {
        if (!b.player) errors.push(`${prefix}.batters[${j}]: missing player`);
        if (!validDismissTypes.has(b.dismissType)) {
          errors.push(`${prefix}.batters[${j}] (${b.player}): invalid dismissType "${b.dismissType}"`);
        }
      });
    });
  }

  return errors;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('Usage: node scripts/parse_scorecard.js <path-to-pdf>');
    process.exit(1);
  }

  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log(`\n📄 Parsing: ${pdfPath}`);

  // 1. Parse filename for metadata
  let meta;
  try {
    meta = parseFilename(pdfPath);
    console.log(`✅ Filename decoded: type=${meta.type} format=${meta.format} season=${meta.season} match=${meta.matchNum} ground=${meta.ground}`);
  } catch (e) {
    console.error(`❌ Filename parse error: ${e.message}`);
    process.exit(1);
  }

  // 2. Load player config
  if (!fs.existsSync(PLAYERS_CONFIG)) {
    console.error(`❌ players.config.json not found at ${PLAYERS_CONFIG}`);
    process.exit(1);
  }
  const playersConfig = JSON.parse(fs.readFileSync(PLAYERS_CONFIG, 'utf8'));
  console.log(`✅ Loaded ${Object.keys(playersConfig).length} player mappings`);

  // 3. Read PDF as base64
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');
  console.log(`✅ PDF loaded (${Math.round(pdfBuffer.length / 1024)}KB)`);

  // 4. Build prompt
  const prompt = buildPrompt(meta, playersConfig);

  // 5. Call Claude API
  console.log(`🤖 Sending to Claude API...`);
  let rawText;
  try {
    rawText = await callClaudeAPI(pdfBase64, prompt);
  } catch (e) {
    console.error(`❌ Claude API error: ${e.message}`);
    process.exit(1);
  }

  // 6. Parse JSON response
  let parsed;
  try {
    // Strip any accidental markdown fences just in case
    const cleaned = rawText.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'').trim();
    parsed = JSON.parse(cleaned);
    console.log(`✅ Claude returned valid JSON`);
  } catch (e) {
    console.error(`❌ Failed to parse Claude response as JSON`);
    console.error(`Raw response:\n${rawText}`);
    process.exit(1);
  }

  // 7. Validate
  const errors = validateOutput(parsed);
  if (errors.length > 0) {
    console.error(`\n❌ Validation failed with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`   • ${e}`));
    // Write failed output for inspection
    const failPath = path.resolve(__dirname, `../scripts/output/FAILED_${path.basename(pdfPath, '.pdf')}.json`);
    fs.mkdirSync(path.dirname(failPath), { recursive: true });
    fs.writeFileSync(failPath, JSON.stringify({ errors, raw: parsed }, null, 2));
    console.error(`\n💾 Failed output saved to ${failPath}`);
    process.exit(2); // Exit code 2 = validation failure (GitHub Action checks this)
  }

  console.log(`✅ Validation passed`);

  // 8. Write output JSON
  const outDir  = path.resolve(__dirname, '../scripts/output');
  const outFile = path.join(outDir, `${path.basename(pdfPath, '.pdf')}.json`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(parsed, null, 2));

  console.log(`\n✅ Output written to: ${outFile}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Match   : ${parsed.team1} vs ${parsed.team2}`);
  console.log(`   Result  : ${parsed.result}`);
  console.log(`   Date    : ${parsed.date || 'not found in scorecard'}`);
  console.log(`   Innings : ${parsed.innings.length}`);
  parsed.innings.forEach((inn, i) => {
    console.log(`     [${i+1}] ${inn.team}: ${inn.score} (${inn.overs} ov) — ${inn.batters.length} batters, ${inn.bowlers.length} bowlers`);
  });

  // Output the JSON to stdout for piping to next script
  process.stdout.write('\n__PARSED_JSON_START__\n');
  process.stdout.write(JSON.stringify(parsed));
  process.stdout.write('\n__PARSED_JSON_END__\n');
}

main().catch(e => {
  console.error(`❌ Unexpected error: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
