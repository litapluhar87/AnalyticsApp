// scripts/migrate.js
// Reads both Excel files and converts to structured JSON
// Run with: npm run migrate

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const BOX_FILE     = 'data/raw/RACL Stats Box cricket.xlsm';
const CLASSIC_FILE = 'data/raw/RACL Stats.xlsm';
const OUTPUT_DIR   = 'data/json';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function num(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// Excel serial date → YYYY-MM-DD
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number' || serial < 1) return null;
  const ms = (serial - 25569) * 86400 * 1000;
  return new Date(ms).toISOString().split('T')[0];
}

// All rows as raw arrays (header:1 mode)
function rawRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

// DB sheet: header is at row-index 1, data starts at row-index 2
function readDB(wb) {
  const rows = rawRows(wb, 'DB');
  if (rows.length < 2) return [];
  const headers = rows[1];
  return rows.slice(2)
    .filter(r => r.some(c => c !== ''))
    .map(r => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i]; });
      return o;
    });
}

// ─── MATCHES ────────────────────────────────────────────────────────────────
// Parse match-level data from scorecard sheets (ScrS3, ScrS4 …).
// Match header row: row[6] === 'Match' && row[7] is a number
// Team scorecard header row: row[4] === 'overs'
function parseMatches(wb, scorecardSheets) {
  const matches = [];

  for (const sheet of scorecardSheets) {
    const season = parseInt(sheet.replace('ScrS', ''), 10);
    const rows   = rawRows(wb, sheet);
    let i = 0;

    while (i < rows.length) {
      const row = rows[i];

      if (row[6] === 'Match' && typeof row[7] === 'number') {
        const date      = excelDateToISO(num(row[1]));
        const format    = String(row[2] || '');
        const matchNum  = row[7];
        const ground    = String(row[12] || '');

        const resultRow = rows[i + 1] || [];
        const mom       = String(resultRow[2] || '');
        const result    = String(resultRow[4] || '');

        // Collect team scorecard-header rows (col[4]==='overs') until next match header
        const teamHeaders = [];
        let j = i + 2;
        while (j < rows.length) {
          if (rows[j][6] === 'Match' && typeof rows[j][7] === 'number') break;
          if (rows[j][4] === 'overs') teamHeaders.push(rows[j]);
          j++;
        }

        let team1 = '', score1 = '', overs1 = '';
        let team2 = '', score2 = '', overs2 = '';
        if (teamHeaders[0]) {
          team1  = String(teamHeaders[0][1] || '');
          score1 = String(teamHeaders[0][2] || '');
          overs1 = String(teamHeaders[0][3] || '');
        }
        if (teamHeaders[1]) {
          team2  = String(teamHeaders[1][1] || '');
          score2 = String(teamHeaders[1][2] || '');
          overs2 = String(teamHeaders[1][3] || '');
        }

        let winner = '';
        const wonMatch = result.match(/^(.+?)\s+won by/i);
        if (wonMatch) winner = wonMatch[1].trim();
        else if (/\bno result\b/i.test(result)) winner = 'No Result';
        else if (/\btie\b/i.test(result))       winner = 'Tie';

        matches.push({
          season,
          format,
          ground,
          date,
          matchNum,
          team1,
          score1,
          overs1,
          team2,
          score2,
          overs2,
          result,
          winner,
          mom,
          batFirst: team1
        });

        i = j;
      } else {
        i++;
      }
    }
  }

  return matches;
}

// ─── PLAYERS ────────────────────────────────────────────────────────────────
// One record per player per match-inning, sourced from DB.
// Uses r['Match'] (integer) for matchNum — r['Inning'] can be fractional
// in Classic Test matches (e.g. 13.2 = match 13, 2nd innings).
function parsePlayers(wb) {
  return readDB(wb)
    .filter(r => r['Player'] && r['Player'] !== '' && num(r['MatchComplete']) === 1)
    .map(r => {
      const isDNB = r['Runs'] === 'DNB' || num(r['DNB']) === 1;
      const wonVal = r['Won?'];
      return {
        player:      String(r['Player']),
        season:      num(r['Season']),
        matchNum:    num(r['Match']),
        inning:      r['Inning'],           // may be fractional (e.g. 13.2) for Test
        date:        excelDateToISO(num(r['Date'])),
        ground:      String(r['Ground']    || ''),
        format:      String(r['MatchType'] || ''),
        team:        String(r['Team']      || ''),
        captain:     String(r['Captain']   || ''),
        won:         wonVal === 1  || wonVal === true,
        tied:        wonVal === 0.5,
        batFirst:    r['BatInning'] === 1,
        batting: {
          innings:       num(r['Inning3']),
          position:      num(r['Position']),
          runs:          isDNB ? null : (r['Runs'] === '' ? null : num(r['Runs'])),
          balls:         num(r['Balls']),
          fours:         num(r['4s']),
          sixes:         num(r['6s']),
          sr:            Math.round(num(r['SR']) * 10000) / 100,  // stored as ratio, convert to %
          dismissalType: String(r['HowOut?']   || ''),
          dismissedBy:   String(r['WicketTo']  || ''),
          notOut:        num(r['Not Out?'])  === 1,
          retired:       num(r['Retired?'])  === 1,
          dnb:           isDNB
        },
        bowling: {
          overs:     num(r['Overs']),
          oversDcml: num(r['OversDcml']),
          maidens:   num(r['Maiden']),
          runs:      num(r['RunsGiven']),
          wickets:   num(r['Wickets']),
          economy:   num(r['economy'])
        },
        fielding: {
          catches:       num(r['Ctch']),
          stumpings:     num(r['Stumpings']),
          directRunOuts: num(r['DirectRO']),
          comboRunOuts:  num(r['ComboRO'])
        },
        mvp: {
          runs:           num(r['MVP runs']),
          srBonus:        num(r['SR Bonus']),
          notOutBonus:    num(r['NotOutBonus']),
          milestoneBonus: num(r['Milestone Bonus']),
          bat:            num(r['MVP Bat']),
          wicketPts:      num(r['MVP Wickets']),
          maidenBonus:    num(r['Maiden Bonus']),
          wicketBonus:    num(r['Wicket bonus']),
          economyBonus:   num(r['Economy Bonus']),
          bowl:           num(r['MVP Bowl']),
          mom:            num(r['MVP MOM']),
          field:          num(r['MVP Field']),
          total:          num(r['Total MVP'])
        },
        isManOfMatch: r['Man of The Match'] === 1 || r['Man of The Match'] === true,
        seasonMatch:  String(r['SeasonMatch'] || '')
      };
    });
}

// ─── MVP ────────────────────────────────────────────────────────────────────
// Compact per-player per-match MVP summary (subset of player data).
function parseMVP(wb) {
  return readDB(wb)
    .filter(r => r['Player'] && r['Player'] !== '' && num(r['MatchComplete']) === 1)
    .map(r => ({
      player:      String(r['Player']),
      season:      num(r['Season']),
      matchNum:    num(r['Match']),
      inning:      r['Inning'],
      date:        excelDateToISO(num(r['Date'])),
      ground:      String(r['Ground']    || ''),
      format:      String(r['MatchType'] || ''),
      team:        String(r['Team']      || ''),
      bat:         num(r['MVP Bat']),
      bowl:        num(r['MVP Bowl']),
      field:       num(r['MVP Field']),
      mom:         num(r['MVP MOM']),
      total:       num(r['Total MVP']),
      isManOfMatch: r['Man of The Match'] === 1 || r['Man of The Match'] === true,
      seasonMatch:  String(r['SeasonMatch'] || '')
    }));
}

// ─── PARTNERSHIPS ────────────────────────────────────────────────────────────
// PrtnerDB header is at row 0 (both Box and Classic).
// Box columns:  Pair,Season,Inning,AbsInn,BatInning,Wicket,Scorecard,Runs,Balls,Not Out,Player 1,Player 2,Inning Bat,Team
// Classic cols: Pair,Season,Inning,AbsInn,BatInning,Scorecard,Runs,Balls,Wicket,Not Out,Player 1,Player 2
// Both are accessed by name so column-order differences don't matter.
function parsePartnerships(wb) {
  const rows = rawRows(wb, 'PrtnerDB');
  if (!rows.length) return [];
  const headers = rows[0];

  return rows.slice(1)
    .filter(r => r.some(c => c !== '') && String(r[0]) !== 'Grand Total')
    .map(r => {
      const o = {};
      headers.forEach((h, i) => { if (h !== '') o[h] = r[i]; });
      return {
        pair:      String(o['Pair']     || ''),
        player1:   String(o['Player 1'] || ''),
        player2:   String(o['Player 2'] || ''),
        season:    num(o['Season']),
        matchNum:  num(o['Inning']),
        batInning: num(o['BatInning']),
        wicket:    num(o['Wicket']),
        runs:      num(o['Runs']),
        balls:     Math.round(num(o['Balls'])),
        notOut:    num(o['Not Out']) === 1,
        // Team only present in Box PrtnerDB
        team:      String(o['Team'] || '')
      };
    });
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
function write(filename, data) {
  const out = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(`  ✓ ${filename}: ${data.length} records`);
}

function main() {
  ensureDir(OUTPUT_DIR);

  // ── Box Cricket ──────────────────────────────────────────────────────────
  console.log('\n=== Box Cricket ===');
  const wbBox = XLSX.readFile(BOX_FILE);
  const boxScr = wbBox.SheetNames.filter(n => /^ScrS\d+$/.test(n));
  console.log('  Scorecard sheets:', boxScr.join(', '));

  write('box_matches.json',      parseMatches(wbBox, boxScr));
  write('box_players.json',      parsePlayers(wbBox));
  write('box_mvp.json',          parseMVP(wbBox));
  write('box_partnerships.json', parsePartnerships(wbBox));

  // ── Classic Cricket ───────────────────────────────────────────────────────
  console.log('\n=== Classic Cricket ===');
  const wbClassic = XLSX.readFile(CLASSIC_FILE);
  const classicScr = wbClassic.SheetNames.filter(n => /^ScrS\d+$/.test(n));
  console.log('  Scorecard sheets:', classicScr.join(', '));

  write('classic_matches.json',      parseMatches(wbClassic, classicScr));
  write('classic_players.json',      parsePlayers(wbClassic));
  write('classic_mvp.json',          parseMVP(wbClassic));
  write('classic_partnerships.json', parsePartnerships(wbClassic));

  console.log('\nMigration complete.');
}

main();
