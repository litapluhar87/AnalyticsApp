// scripts/append_match.js
// Phase 2 — RACL Match Appender
// Usage: node scripts/append_match.js <path-to-mom-output-json>
// Or piped: ... | node mom_engine.js | node append_match.js
//
// Reads match JSON (with mom field set) → validates no duplicate →
// strips mvpLeaderboard → appends to correct {type}_matches.json →
// updates mvp and meta files
//
// Exit codes:
//   0 = success
//   1 = fatal error (bad input, file not found)
//   2 = duplicate match found (already exists in data)
//   3 = validation failed

'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_DIR  = path.resolve(__dirname, '../data/json');
const META_FILE = path.join(DATA_DIR, 'meta.json');

// ─── Resolve target file from match type ─────────────────────────────────────

function getMatchesFile(type) {
  const fileMap = {
    box:     'box_matches.json',
    classic: 'classic_matches.json',
    pair:    'pair_matches.json',
  };
  const filename = fileMap[type];
  if (!filename) throw new Error(`Unknown match type: "${type}"`);
  return path.join(DATA_DIR, filename);
}

function getMvpFile(type) {
  const fileMap = {
    box:     'box_mvp.json',
    classic: 'classic_mvp.json',
    pair:    'pair_mvp.json',
  };
  const filename = fileMap[type];
  if (!filename) throw new Error(`Unknown match type: "${type}"`);
  return path.join(DATA_DIR, filename);
}

// ─── Duplicate check ──────────────────────────────────────────────────────────
// A match is a duplicate if same season + matchNum + type already exists

function checkDuplicate(existingMatches, match) {
  return existingMatches.find(
    m => m.season   === match.season &&
         m.matchNum === match.matchNum &&
         m.type     === match.type
  );
}

// ─── Strip fields not meant for matches file ──────────────────────────────────

function prepareMatchRecord(match) {
  const record = { ...match };
  // mvpLeaderboard goes to mvp file, not matches file
  delete record.mvpLeaderboard;
  return record;
}

// ─── Prepare MVP record ───────────────────────────────────────────────────────
// Each entry in {type}_mvp.json is a match-level MVP summary

function prepareMvpRecord(match) {
  if (!match.mvpLeaderboard || match.mvpLeaderboard.length === 0) return null;

  return {
    season:   match.season,
    matchNum: match.matchNum,
    type:     match.type,
    format:   match.format,
    ground:   match.ground,
    date:     match.date,
    team1:    match.team1,
    team2:    match.team2,
    winner:   match.winner,
    mom:      match.mom,
    leaderboard: match.mvpLeaderboard.map(p => ({
      player:   p.player,
      team:     p.team,
      total:    p.total,
      batting:  p.batting,
      bowling:  p.bowling,
      fielding: p.fielding,
    })),
  };
}

// ─── Update meta.json ─────────────────────────────────────────────────────────

function updateMeta(match) {
  let meta = {};
  if (fs.existsSync(META_FILE)) {
    meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  }

  const type = match.type; // "box" | "classic" | "pair"

  if (!meta[type]) {
    meta[type] = {
      totalMatches:        0,
      totalPlayerInnings:  0,
      uniquePlayers:       new Set(),
      seasons:             new Set(),
    };
  }

  // We need to re-read the full matches file to recompute stats accurately
  // so we just mark meta as needing regeneration — npm run migrate handles full rebuild
  // Here we just update generatedAt so the pipeline knows it ran
  meta.generatedAt = new Date().toISOString();
  meta.pendingMigrate = true; // Flag for migrate script to pick up

  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}

// ─── Load JSON file safely ────────────────────────────────────────────────────

function loadJsonArray(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`   ℹ️  ${path.basename(filePath)} not found — will create fresh`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  return JSON.parse(content);
}

// ─── Backup file before mutation ─────────────────────────────────────────────

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const backupPath = filePath + '.bak';
  fs.copyFileSync(filePath, backupPath);
  console.log(`   💾 Backup: ${path.basename(backupPath)}`);
}

function restoreBackup(filePath) {
  const backupPath = filePath + '.bak';
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, filePath);
    console.log(`   ♻️  Restored backup: ${path.basename(filePath)}`);
  }
}

function removeBackup(filePath) {
  const backupPath = filePath + '.bak';
  if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
}

// ─── Insert match in correct sorted position ──────────────────────────────────
// Matches sorted by season ASC, then matchNum ASC

function insertSorted(matches, newMatch) {
  const idx = matches.findIndex(m =>
    m.season > newMatch.season ||
    (m.season === newMatch.season && m.matchNum > newMatch.matchNum)
  );
  if (idx === -1) {
    matches.push(newMatch);
  } else {
    matches.splice(idx, 0, newMatch);
  }
  return matches;
}

// ─── Final schema check before writing ───────────────────────────────────────

function finalValidate(match) {
  const errors = [];

  if (!match.mom) errors.push('mom field is missing or empty');
  if (!match.date) console.warn('   ⚠️  date is null — scorecard date was not readable');

  // Check all player names in innings are resolved (no __UNKNOWN__)
  function scanUnknown(obj, path = '') {
    if (typeof obj === 'string' && obj.startsWith('__UNKNOWN__')) {
      errors.push(`Unresolved player at ${path}: ${obj}`);
    } else if (Array.isArray(obj)) {
      obj.forEach((v, i) => scanUnknown(v, `${path}[${i}]`));
    } else if (obj && typeof obj === 'object') {
      Object.entries(obj).forEach(([k, v]) => scanUnknown(v, `${path}.${k}`));
    }
  }
  scanUnknown(match.innings, 'innings');

  return errors;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let match;
  const inputFile = process.argv[2];

  if (inputFile) {
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ File not found: ${inputFile}`);
      process.exit(1);
    }
    match = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    console.log(`\n📥 Append Match — loaded from: ${inputFile}`);
  } else {
    // Read from stdin pipe
    const stdin = fs.readFileSync('/dev/stdin', 'utf8');
    const startMarker = '__MOM_JSON_START__';
    const endMarker   = '__MOM_JSON_END__';
    const startIdx = stdin.indexOf(startMarker);
    const endIdx   = stdin.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1) {
      console.error('❌ No MoM JSON markers in stdin. Pipe from mom_engine.js or pass a file path.');
      process.exit(1);
    }
    const jsonStr = stdin.slice(startIdx + startMarker.length, endIdx).trim();
    match = JSON.parse(jsonStr);
    console.log(`\n📥 Append Match — reading from stdin pipe`);
  }

  console.log(`   Match : S${match.season} M${match.matchNum} — ${match.team1} vs ${match.team2}`);
  console.log(`   Type  : ${match.type} | Format: ${match.format} | Ground: ${match.ground}`);
  console.log(`   MoM   : ${match.mom}`);
  console.log(`   Winner: ${match.winner}`);

  // ── Step 1: Final validation ─────────────────────────────────────────────
  console.log(`\n🔍 Final validation...`);
  const errors = finalValidate(match);
  if (errors.length > 0) {
    console.error(`❌ Validation failed:`);
    errors.forEach(e => console.error(`   • ${e}`));
    process.exit(3);
  }
  console.log(`   ✅ Passed`);

  // ── Step 2: Resolve file paths ───────────────────────────────────────────
  let matchesFile, mvpFile;
  try {
    matchesFile = getMatchesFile(match.type);
    mvpFile     = getMvpFile(match.type);
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }

  // ── Step 3: Load existing data ───────────────────────────────────────────
  console.log(`\n📂 Loading existing data...`);
  const existingMatches = loadJsonArray(matchesFile);
  const existingMvp     = loadJsonArray(mvpFile);
  console.log(`   ${path.basename(matchesFile)}: ${existingMatches.length} matches`);
  console.log(`   ${path.basename(mvpFile)}: ${existingMvp.length} entries`);

  // ── Step 4: Duplicate check ──────────────────────────────────────────────
  console.log(`\n🔎 Checking for duplicates...`);
  const duplicate = checkDuplicate(existingMatches, match);
  if (duplicate) {
    console.error(`❌ Duplicate found: S${match.season} M${match.matchNum} (${match.type}) already exists`);
    console.error(`   Existing entry: ${duplicate.team1} vs ${duplicate.team2} on ${duplicate.date}`);
    console.error(`   If you want to re-parse this match, manually remove it from ${path.basename(matchesFile)} first.`);
    process.exit(2);
  }
  console.log(`   ✅ No duplicate found`);

  // ── Step 5: Backup before writing ───────────────────────────────────────
  console.log(`\n💾 Backing up data files...`);
  backupFile(matchesFile);
  backupFile(mvpFile);

  // ── Step 6: Prepare records ──────────────────────────────────────────────
  const matchRecord = prepareMatchRecord(match);
  const mvpRecord   = prepareMvpRecord(match);

  // ── Step 7: Insert and write ─────────────────────────────────────────────
  try {
    console.log(`\n✍️  Writing data...`);

    // Matches file
    const updatedMatches = insertSorted(existingMatches, matchRecord);
    fs.writeFileSync(matchesFile, JSON.stringify(updatedMatches, null, 2));
    console.log(`   ✅ ${path.basename(matchesFile)} — now ${updatedMatches.length} matches`);

    // MVP file
    if (mvpRecord) {
      const updatedMvp = insertSorted(existingMvp, mvpRecord);
      fs.writeFileSync(mvpFile, JSON.stringify(updatedMvp, null, 2));
      console.log(`   ✅ ${path.basename(mvpFile)} — now ${updatedMvp.length} entries`);
    }

    // Meta
    updateMeta(match);
    console.log(`   ✅ meta.json updated`);

  } catch (e) {
    // Write failed — restore backups
    console.error(`\n❌ Write failed: ${e.message}`);
    console.error(`   Restoring backups...`);
    restoreBackup(matchesFile);
    restoreBackup(mvpFile);
    process.exit(1);
  }

  // ── Step 8: Clean up backups ─────────────────────────────────────────────
  removeBackup(matchesFile);
  removeBackup(mvpFile);

  // ── Step 9: Summary ──────────────────────────────────────────────────────
  console.log(`\n✅ Match appended successfully`);
  console.log(`\n📊 Summary:`);
  console.log(`   S${match.season} M${match.matchNum} | ${match.type} ${match.format} | ${match.ground}`);
  console.log(`   ${match.team1} vs ${match.team2}`);
  console.log(`   Result : ${match.result}`);
  console.log(`   MoM    : ${match.mom}`);
  console.log(`   Date   : ${match.date || 'unknown'}`);
  console.log(`   Innings: ${match.innings.length}`);
  console.log(`\n➡️  Next step: npm run migrate`);
}

main().catch(e => {
  console.error(`❌ Unexpected error: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
