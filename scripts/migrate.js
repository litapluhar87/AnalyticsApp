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
// ─── MATCHES + SCORECARD DETAIL ──────────────────────────────────────────────
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

        // Collect all rows until next match header
        let j = i + 2;
        const matchRows = [];
        while (j < rows.length) {
          if (rows[j][6] === 'Match' && typeof rows[j][7] === 'number') break;
          matchRows.push(rows[j]);
          j++;
        }

        // Find team scorecard header rows (col[4]==='overs')
        const teamHeaders = matchRows.filter(r => r[4] === 'overs');

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

        // ── Parse batting rows for each innings ──
        // Batting rows: col[1] is player name (string), col[6] is runs (number)
        // Format: [_, player, dismissType, fielder, 'b', bowler, runs, balls, 4s, 6s, ...]
        // FOW rows: col[17] is wicket# (number), col[18] is player, T12 col is runs
        // FOW is in the resultRow area — col[18] = 'FOW' marks the FOW header

        const innings = [];
        let currentInning = null;
        let inFOW = false;

        for (const r of matchRows) {
          // New innings starts at team scorecard header
          if (r[4] === 'overs') {
            if (currentInning) innings.push(currentInning);
            currentInning = {
              team:    String(r[1] || ''),
              score:   String(r[2] || ''),
              overs:   String(r[3] || ''),
              bowlingTeam: String(r[11] || ''),
              batters: [],
              bowlers: [],
              fow:     [],
              extras:  0,
              dnb:     [],
            };
            inFOW = false;
            continue;
          }

          if (!currentInning) continue;

          // Batting row: col[1] is player string, col[6] is runs number or col[5]==='Extras'
		  // Extras row — col[5]==='Extras', value in col[6]
          // Also catches DNB+Extras combined row
          if (r[5] === 'Extras' && r[6] !== '') {
            currentInning.extras = Number(r[6]) || 0;
            // Also check for DNB on same row
            if (typeof r[1] === 'string' && r[1].startsWith('Did not bat')) {
              const dnbPart = r[1].replace('Did not bat -', '').replace('Did not bat-', '').trim();
              dnbPart.split(',').map(p => p.trim()).filter(Boolean).forEach(p => {
                currentInning.dnb = currentInning.dnb || [];
                currentInning.dnb.push(p);
              });
            }
            continue;
          }

          // Standalone DNB row (no extras)
          if (typeof r[1] === 'string' && r[1].startsWith('Did not bat')) {
            const dnbPart = r[1].replace('Did not bat -', '').replace('Did not bat-', '').trim();
            dnbPart.split(',').map(p => p.trim()).filter(Boolean).forEach(p => {
              currentInning.dnb = currentInning.dnb || [];
              currentInning.dnb.push(p);
            });
            continue;
          }

          if (
            typeof r[1] === 'string' && r[1] !== '' &&
            r[1] !== 'Man of the Match' &&
            r[4] !== 'overs'
          ) {
            // Check if this looks like a batter row
            // col[2] = dismissType (c, b, run out, not out, etc)
            // col[3] = fielder (if caught) or blank
            // col[4] = 'b' separator or blank
            // col[5] = bowler or blank
            // col[6] = runs (number)
            const runsVal = r[6];
            if (typeof runsVal === 'number' || runsVal === '') {
			  // Column mapping in scorecard rows:
              // col[2] = dismissType (c, b, lbw, run out, st, hit wkt, not out, retired)
              // col[3] = fielder1 (catcher for c, first fielder for run out, blank for b/lbw)
              // col[4] = separator ('b' for bowling dismissals, '/' for two-fielder run out)
              // col[5] = bowler (for c/b/lbw/st/hitwkt) or second fielder (for run out)

			  const col2raw = String(r[2] || '').trim().toLowerCase();
              const col3    = String(r[3] || '').trim();
              const col3low = col3.toLowerCase();
              const col4    = String(r[4] || '').trim().toLowerCase();
              const col5    = String(r[5] || '').trim();

              // Determine dismissal type from column patterns:
              // Retired:        col3 === 'retired'
              // Not out:        col3 === 'not out'
              // Caught:         col2 === 'c', col3=fielder or '&', col4='b', col5=bowler
              // Bowled:         col2 blank, col3 blank, col4 === 'b', col5=bowler
              // LBW:            col2 === 'lbw', col4='b', col5=bowler
              // Run out 2 fld:  col2 === 'run out', col4 === '/', col3+col5=fielders
              // Run out 1 fld:  col2 === 'run out', col3=fielder, col4+col5 blank
              // Stumped:        col2 === 'st', col4='b', col5=bowler
              // Hit wicket:     col2 === 'hit wkt' or 'hw', col4='b', col5=bowler

              let dismissType = '';
              if (col3low === 'retired') {
                dismissType = 'retired';
              } else if (col3low === 'not out') {
                dismissType = 'not out';
              } else if (col2raw === 'c') {
                dismissType = 'c';
              } else if (col2raw === 'run out') {
                dismissType = 'run out';
              } else if (col2raw === 'lbw') {
                dismissType = 'lbw';
              } else if (col2raw === 'st') {
                dismissType = 'st';
              } else if (col2raw === 'hit wkt' || col2raw === 'hw') {
                dismissType = 'hit wkt';
              } else if (col4 === 'b' && col5 !== '') {
                dismissType = 'b';
              } else {
                dismissType = '';
              }

			  let dismissal = '';
              let fielder   = '';
              let bowler    = '';

              if (dismissType === 'c') {
                fielder = col3;
                bowler  = col5;
                if (fielder && bowler) {
                  dismissal = `c ${fielder} b ${bowler}`;
                } else if (bowler) {
                  dismissal = `c & b ${bowler}`;
                } else {
                  dismissal = 'caught';
                }
              } else if (dismissType === 'b') {
                bowler    = col5;
                dismissal = bowler ? `b ${bowler}` : 'bowled';
              } else if (dismissType === 'lbw') {
                bowler    = col5;
                dismissal = bowler ? `lbw b ${bowler}` : 'lbw';
              } else if (dismissType === 'st') {
                bowler    = col5;
                dismissal = bowler ? `st b ${bowler}` : 'stumped';
              } else if (dismissType === 'hit wkt') {
                bowler    = col5;
                dismissal = bowler ? `hit wkt b ${bowler}` : 'hit wicket';
              } else if (dismissType === 'run out') {
                if (col3 && col4 === '/' && col5) {
                  fielder   = `${col3} / ${col5}`;
                  dismissal = `run out (${col3} / ${col5})`;
                } else if (col3) {
                  fielder   = col3;
                  dismissal = `run out (${col3})`;
                } else {
                  dismissal = 'run out';
                }
              } else if (dismissType === 'retired') {
                dismissal = 'retired';
              } else if (dismissType === 'not out') {
                dismissal = 'not out';
              } else {
                dismissal = 'not out';
              }

			  currentInning.batters.push({
                player:       r[1],
                dismissal,
                dismissType,
                fielder,
                bowler,
                runs:         typeof runsVal === 'number' ? runsVal : null,
                balls:        num(r[7]),
                fours:        num(r[8]),
                sixes:        num(r[9]),
              });

              // Bowling on same row — col[11]=bowler, col[12]=overs, col[13]=maidens, col[14]=runs, col[15]=wickets
              if (typeof r[11] === 'string' && r[11] !== '' && typeof r[12] === 'number') {
                currentInning.bowlers.push({
                  player:  String(r[11]),
                  overs:   num(r[12]),
                  maidens: num(r[13]),
                  runs:    num(r[14]),
                  wickets: num(r[15]),
                  economy: num(r[12]) > 0 ? Math.round((num(r[14]) / num(r[12])) * 10) / 10 : 0,
                });
              }

              // FOW on same row — col 17=wicket, 18=player, 19=runs

			  if (
                typeof r[17] === 'number' &&
                r[17] >= 1 && r[17] <= 11 &&
                typeof r[18] === 'string' && r[18] !== ''
              ) {
                currentInning.fow.push({
                  wicket: num(r[17]),
                  player: String(r[18]),
                  runs:   num(r[19]),
                  overs:  r[20] !== '' ? String(r[20]) : null,
                });
              }
            }
          }
        }

        if (currentInning) innings.push(currentInning);

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
          batFirst: team1,
          innings,
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
          sr:            Math.round(num(r['SR']) * 10000) / 100,
          dismissalType: String(r['HowOut?']   || ''),
          dismissedBy:   String(r['WicketTo']  || ''),
          fielder:       String(r['CaughtBy']  || ''),
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
