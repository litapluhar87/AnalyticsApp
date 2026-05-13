// scripts/regenerate_derived.js
// Phase 2 — Regenerate derived JSON files from {type}_matches.json
// Replaces npm run migrate for the GitHub Action pipeline
// Does NOT read Excel files — works purely from data/json/{type}_matches.json
//
// Rebuilds:
//   {type}_players.json      — flat per-player-per-innings records with MVP
//   {type}_partnerships.json — per-partnership-per-wicket records
//
// {type}_mvp.json is handled by append_match.js — not touched here
//
// Usage: node scripts/regenerate_derived.js [box|classic|pair|all]
// Default: all

'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data/json');

const BOX_CONFIG     = path.resolve(__dirname, '../src/config/box.config.json');
const CLASSIC_CONFIG = path.resolve(__dirname, '../src/config/classic.config.json');
const PAIR_CONFIG    = path.resolve(__dirname, '../src/config/pair.config.json');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r2(n) { return Math.round(n * 100) / 100; }

function toDecimalOvers(overs) {
  if (!overs && overs !== 0) return 0;
  const str    = String(overs);
  const [whole, balls] = str.split('.');
  return parseInt(whole, 10) + (parseInt(balls || '0', 10) / 6);
}

function toTotalBalls(overs) {
  const str    = String(overs);
  const [whole, balls] = str.split('.');
  return (parseInt(whole, 10) * 6) + parseInt(balls || '0', 10);
}

function ballsToOversStr(balls) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  return JSON.parse(content);
}

function loadConfig(type) {
  const map = { box: BOX_CONFIG, classic: CLASSIC_CONFIG, pair: PAIR_CONFIG };
  if (!fs.existsSync(map[type])) throw new Error(`Config not found for type: ${type}`);
  return JSON.parse(fs.readFileSync(map[type], 'utf8'));
}

// ─── MVP calculation (mirrors mom_engine.js) ──────────────────────────────────

const DISMISS_TO_WICKET_TYPE = {
  'b':   'bowled',
  'h':   'hitWicket',
  'c':   'caught',
  'st':  'stumped',
  'lbw': 'lbw',
  'ro':  'runOut',
};

function calcBatMvp(batter, rules) {
  const r      = rules.batting;
  const runs   = batter.runs   || 0;
  const balls  = batter.balls  || 0;
  const fours  = batter.fours  || 0;
  const sixes  = batter.sixes  || 0;
  const notOut = !batter.dismissType || batter.dismissType === '';

  // Base
  const runPts  = runs * r.runPoints;
  const fourPts = fours * r.boundaryBonus.four;
  const sixPts  = sixes * r.boundaryBonus.six;
  const basePts = runPts + fourPts + sixPts;

  // Strike rate
  // Bonus:   0.3 x (SR - Threshold) x runs
  // Penalty: 0.3 x (SR - Threshold) x balls  [diff negative so result negative]
  let srBonus = 0;
  if (balls > 0) {
    const actualSR    = (runs / balls) * 100;
    const thresholdSR = r.strikeRate.threshold * 100;
    const diff        = actualSR - thresholdSR;
    if (diff > 0) {
      srBonus = diff * r.strikeRate.bonusMultiplier * runs;
    } else {
      srBonus = Math.max(diff * r.strikeRate.penaltyMultiplier * balls, r.strikeRate.maxPenalty);
    }
  }

  // Milestones
  let milestoneBonus = 0;
  for (const [threshold, bonus] of Object.entries(r.milestones)) {
    if (runs >= Number(threshold)) milestoneBonus += bonus;
  }

  // Subtotal before not-out
  let bat = basePts + srBonus + milestoneBonus;

  // Not-out bonus: 0.2 x runs (raw runs, not batting points)
  // Applied only if runs >= minimumPoints threshold
  let notOutBonus = 0;
  if (notOut && runs >= r.notOutBonus.minimumPoints) {
    notOutBonus = runs * r.notOutBonus.multiplier;
    bat += notOutBonus;
  }

  return {
    runs:          r2(runPts + fourPts + sixPts), // mvp.runs = base pts
    srBonus:       r2(srBonus),
    notOutBonus:   r2(notOutBonus),
    milestoneBonus:r2(milestoneBonus),
    bat:           r2(bat),
  };
}

function calcBowlMvp(bowler, battingInnings, rules) {
  const r       = rules.bowling;
  const overs   = toDecimalOvers(bowler.overs);
  const maidens = bowler.maidens || 0;
  const runs    = bowler.runs    || 0;
  const wickets = bowler.wickets || 0;

  // Wicket points by type
  const dismissed = (battingInnings.batters || []).filter(
    b => b.bowler === bowler.player && b.dismissType && b.dismissType !== 'ro' && b.dismissType !== ''
  );
  let wicketPts = 0;
  for (const b of dismissed) {
    const key = DISMISS_TO_WICKET_TYPE[b.dismissType];
    if (key && r.wicketTypes[key] !== undefined) wicketPts += r.wicketTypes[key];
  }

  // Maidens
  const maidenBonus = maidens * r.maidenOver;

  // Economy
  let economyBonus = 0;
  if (overs > 0) {
    const eco  = runs / overs;
    const diff = r.economy.expectedEconomy - eco;
    economyBonus = Math.max(diff * runs * r.economy.multiplier, r.economy.maxPenalty);
  }

  // Milestone
  let wicketBonus = 0;
  for (const [threshold, bonus] of Object.entries(r.milestones)) {
    if (wickets >= Number(threshold)) wicketBonus += bonus;
  }

  const bowl = wicketPts + maidenBonus + economyBonus + wicketBonus;

  return {
    wicketPts:   r2(wicketPts),
    maidenBonus: r2(maidenBonus),
    wicketBonus: r2(wicketBonus),
    economyBonus:r2(economyBonus),
    bowl:        r2(bowl),
  };
}

function calcFieldMvp(playerName, allInnings, rules) {
  const r = rules.fielding;
  let catches = 0, stumpings = 0, directRO = 0, comboRO = 0;

  for (const inn of allInnings) {
    for (const b of (inn.batters || [])) {
      const dt = b.dismissType;
      if (dt === 'c') {
        if (b.fielder === '' && b.bowler === playerName) catches++;
        else if (b.fielder === playerName) catches++;
      }
      if (dt === 'st' && b.fielder === playerName) stumpings++;
      if (dt === 'ro') {
        const fStr = b.fielder || '';
        if (fStr.includes('/')) {
          const parts = fStr.split('/').map(s => s.trim());
          if (parts.includes(playerName)) comboRO++;
        } else if (fStr.trim() === playerName) {
          directRO++;
        }
      }
    }
  }

  const field = (catches * r.catch) + (stumpings * r.stumping) +
                (directRO * r.directRunOut) + (comboRO * r.comboRunOut);

  return { catches, stumpings, directRunOuts: directRO, comboRunOuts: comboRO, field: r2(field) };
}

// ─── Build player records for one match ───────────────────────────────────────

function buildPlayerRecords(match, config) {
  const rules    = config.mvpRules;
  const winner   = match.winner;
  const isTie    = !winner || winner === 'Tie';
  const records  = [];

  // Determine MoM from mvp leaderboard stored in match (set by mom_engine)
  const momPlayer = match.mom || null;

  // Process each innings
  match.innings.forEach((innings, inningsIdx) => {
    const overallInning    = match.matchNum + ((inningsIdx + 1) / 10);
    const battingTeam      = innings.team;
    const isTeam1          = battingTeam === match.team1;
    const batFirstTeam     = match.batFirst;
    const teamBatFirst     = battingTeam === batFirstTeam;

    // batting.innings = 1 if this is the team's first batting innings, 2 if second
    // For T12: always 1. For Test: team1 bats in innings 0 and 2 (idx), team2 in 1 and 3
    let teamBattingInnings = 1;
    if (match.format === 'Test') {
      // innings 0 = team1 1st, innings 1 = team2 1st, innings 2 = team1 2nd, innings 3 = team2 2nd
      teamBattingInnings = inningsIdx <= 1 ? 1 : 2;
    }

    const won  = !isTie && battingTeam === winner;
    const tied = isTie;

    // Process each batter
    innings.batters.forEach((batter, pos) => {
      if (!batter.player || batter.player.startsWith('__UNKNOWN__')) return;

      // Batting MVP
      const batMvp = calcBatMvp(batter, rules);

      // Bowling MVP — find this player's bowling entry in the OPPOSITE innings
      // A player bats in innings N and bowls in the other team's innings
      // Find their bowling entry across all innings where they appear as bowler
      let bowlMvp = { wicketPts: 0, maidenBonus: 0, wicketBonus: 0, economyBonus: 0, bowl: 0 };
      let bowlingEntry = null;
      let bowlingInnings = null;

      for (const inn of match.innings) {
        const be = (inn.bowlers || []).find(b => b.player === batter.player);
        if (be) {
          // A player bowls in the innings where the OTHER team bats
          // So only count bowling from innings where this player's team is bowling
          if (inn.team !== battingTeam) {
            bowlingEntry   = be;
            bowlingInnings = inn;
            bowlMvp = calcBowlMvp(be, inn, rules);
            break; // take first match (for T12); Test handles below
          }
        }
      }

      // For Test: aggregate bowling across BOTH innings this player bowled in
      if (match.format === 'Test') {
        const bowlingInningsList = match.innings.filter(
          inn => inn.team !== battingTeam && (inn.bowlers || []).some(b => b.player === batter.player)
        );
        if (bowlingInningsList.length > 0) {
          // Recalculate aggregated bowling
          let totalWicketPts = 0, totalMaiden = 0, totalWicketBonus = 0, totalEcoBonus = 0;
          let totalOvers = 0, totalRuns = 0, totalWickets = 0, totalMaidens = 0;

          for (const bi of bowlingInningsList) {
            const be = bi.bowlers.find(b => b.player === batter.player);
            if (!be) continue;
            const bm = calcBowlMvp(be, bi, rules);
            totalWicketPts   += bm.wicketPts;
            totalMaiden      += bm.maidenBonus;
            totalWicketBonus += bm.wicketBonus;
            totalEcoBonus    += bm.economyBonus;
            totalOvers       += toDecimalOvers(be.overs);
            totalRuns        += be.runs;
            totalWickets     += be.wickets;
            totalMaidens     += be.maidens;
          }

          bowlMvp = {
            wicketPts:   r2(totalWicketPts),
            maidenBonus: r2(totalMaiden),
            wicketBonus: r2(totalWicketBonus),
            economyBonus:r2(totalEcoBonus),
            bowl:        r2(totalWicketPts + totalMaiden + totalWicketBonus + totalEcoBonus),
          };

          // Use first bowling innings for the entry reference
          bowlingEntry   = bowlingInningsList[0].bowlers.find(b => b.player === batter.player);
          bowlingInnings = bowlingInningsList[0];
        }
      }

      // Fielding MVP — across all innings
      const fieldData = calcFieldMvp(batter.player, match.innings, rules);

      // MoM subtotal and total
      const mom   = r2(batMvp.bat + bowlMvp.bowl);
      const total = r2(mom + fieldData.field);

      // Bowling data for record
      const bowlOvers    = bowlingEntry ? bowlingEntry.overs : 0;
      const bowlOversDcm = r2(toDecimalOvers(bowlOvers));
      const bowlMaidens  = bowlingEntry ? bowlingEntry.maidens : 0;
      const bowlRuns     = bowlingEntry ? bowlingEntry.runs : 0;
      const bowlWickets  = bowlingEntry ? bowlingEntry.wickets : 0;
      const bowlEconomy  = bowlOversDcm > 0 ? r2(bowlRuns / bowlOversDcm) : 0;

      const record = {
        player:      batter.player,
        season:      match.season,
        matchNum:    match.matchNum,
        inning:      r2(overallInning),
        date:        match.date,
        ground:      match.ground,
        format:      match.format,
        team:        battingTeam,
        captain:     batter.captain || '',
        won,
        tied,
        batFirst:    teamBatFirst,
        batting: {
          innings:      teamBattingInnings,
          position:     pos + 1,
          runs:         batter.runs   || 0,
          balls:        batter.balls  || 0,
          fours:        batter.fours  || 0,
          sixes:        batter.sixes  || 0,
          sr:           r2(batter.balls > 0 ? (batter.runs / batter.balls) * 100 : 0),
          dismissalType: batter.dismissType === '' ? 'not out' : batter.dismissType,
          dismissedBy:  batter.bowler || (batter.dismissType === 'ro' ? 'run out' : ''),
          fielder:      batter.fielder || '',
          notOut:       !batter.dismissType || batter.dismissType === '',
          retired:      false,
          dnb:          false,
        },
        bowling: {
          overs:     bowlOvers,
          oversDcml: bowlOversDcm,
          maidens:   bowlMaidens,
          runs:      bowlRuns,
          wickets:   bowlWickets,
          economy:   bowlEconomy,
        },
        fielding: {
          catches:       fieldData.catches,
          stumpings:     fieldData.stumpings,
          directRunOuts: fieldData.directRunOuts,
          comboRunOuts:  fieldData.comboRunOuts,
        },
        mvp: {
          runs:          batMvp.runs,
          srBonus:       batMvp.srBonus,
          notOutBonus:   batMvp.notOutBonus,
          milestoneBonus:batMvp.milestoneBonus,
          bat:           batMvp.bat,
          wicketPts:     bowlMvp.wicketPts,
          maidenBonus:   bowlMvp.maidenBonus,
          wicketBonus:   bowlMvp.wicketBonus,
          economyBonus:  bowlMvp.economyBonus,
          bowl:          bowlMvp.bowl,
          mom,
          field:         fieldData.field,
          total,
        },
        isManOfMatch: batter.player === momPlayer,
        seasonMatch:  `${match.season}-${match.matchNum}`,
      };

      records.push(record);
    });

    // DNB players — add minimal records
    (innings.dnb || []).forEach(playerName => {
      if (!playerName || playerName.startsWith('__UNKNOWN__')) return;
      const won  = !isTie && battingTeam === winner;
      records.push({
        player:      playerName,
        season:      match.season,
        matchNum:    match.matchNum,
        inning:      r2(overallInning),
        date:        match.date,
        ground:      match.ground,
        format:      match.format,
        team:        battingTeam,
        captain:     '',
        won,
        tied,
        batFirst:    teamBatFirst,
        batting: {
          innings: teamBattingInnings, position: 0, runs: 0, balls: 0, fours: 0, sixes: 0,
          sr: 0, dismissalType: '', dismissedBy: '', fielder: '', notOut: false,
          retired: false, dnb: true,
        },
        bowling:  { overs: 0, oversDcml: 0, maidens: 0, runs: 0, wickets: 0, economy: 0 },
        fielding: { catches: 0, stumpings: 0, directRunOuts: 0, comboRunOuts: 0 },
        mvp:      { runs: 0, srBonus: 0, notOutBonus: 0, milestoneBonus: 0, bat: 0,
                    wicketPts: 0, maidenBonus: 0, wicketBonus: 0, economyBonus: 0,
                    bowl: 0, mom: 0, field: 0, total: 0 },
        isManOfMatch: false,
        seasonMatch: `${match.season}-${match.matchNum}`,
      });
    });
  });

  return records;
}

// ─── Build partnership records for one innings ────────────────────────────────

function buildPartnerships(match) {
  const partnerships = [];

  match.innings.forEach((innings, inningsIdx) => {
    const batters = innings.batters || [];
    const fow     = innings.fow     || [];
    if (batters.length === 0) return;

    const team          = innings.team;
    const inningsNum    = inningsIdx + 1; // 1-based overall innings

    // Build wicket events: each fow entry tells us when a wicket fell
    // Partnership N: batters[N] + batters[N+1], from prev wicket to this wicket
    // runs in partnership = fow[N].runs - (fow[N-1].runs || 0)
    // balls = toTotalBalls(fow[N].overs) - toTotalBalls(fow[N-1].overs || "0")

    // Track who is "at the crease" — start with batter[0] and batter[1]
    let onCrease    = [0, 1]; // indices into batters array
    let prevRuns    = 0;
    let prevBalls   = 0;
    let nextBatter  = 2;

    for (let w = 0; w < fow.length; w++) {
      const wicketEvent = fow[w];
      const partRuns  = (wicketEvent.runs || 0) - prevRuns;
      const partBalls = toTotalBalls(wicketEvent.overs || '0') - prevBalls;

      // Who got out?
      const dismissedPlayer = wicketEvent.player;

      // Find which crease position got out
      const outIdx = onCrease.find(i => batters[i] && batters[i].player === dismissedPlayer);

      // Both crease players form this partnership
      const p1Idx = onCrease[0];
      const p2Idx = onCrease[1];

      if (p1Idx !== undefined && p2Idx !== undefined &&
          batters[p1Idx] && batters[p2Idx]) {

        const p1 = batters[p1Idx].player;
        const p2 = batters[p2Idx].player;

        // notOut = the wicket didn't fall (last partnership can be not out)
        const notOut = false; // this partnership ended with a wicket

        partnerships.push({
          pair:     `${p1} & ${p2}`,
          player1:  p1,
          player2:  p2,
          season:   match.season,
          matchNum: match.matchNum,
          batInning:inningsNum,
          wicket:   w + 1,
          runs:     partRuns,
          balls:    partBalls,
          notOut,
          team,
        });
      }

      // Advance: dismissed player is replaced by next batter
      if (outIdx !== undefined) {
        const outCreaseIdx = onCrease.indexOf(outIdx);
        if (nextBatter < batters.length) {
          onCrease[outCreaseIdx] = nextBatter;
          nextBatter++;
        }
      }

      prevRuns  = wicketEvent.runs  || 0;
      prevBalls = toTotalBalls(wicketEvent.overs || '0');
    }

    // Last partnership (if innings ended without all out)
    // Remaining batters still at crease — add final not-out partnership
    if (onCrease[0] !== undefined && onCrease[1] !== undefined &&
        batters[onCrease[0]] && batters[onCrease[1]]) {
      const p1 = batters[onCrease[0]].player;
      const p2 = batters[onCrease[1]].player;

      // Parse total innings runs from score e.g. "70/4" → 70
      const totalRuns = parseInt((innings.score || '0').split('/')[0], 10);
      const finalRuns = totalRuns - prevRuns;
      const totalBallsInnings = toTotalBalls(innings.overs || '0');
      const finalBalls = totalBallsInnings - prevBalls;

      if (finalRuns > 0 || finalBalls > 0) {
        partnerships.push({
          pair:     `${p1} & ${p2}`,
          player1:  p1,
          player2:  p2,
          season:   match.season,
          matchNum: match.matchNum,
          batInning:inningsNum,
          wicket:   (fow.length + 1),
          runs:     finalRuns,
          balls:    finalBalls,
          notOut:   true,
          team,
        });
      }
    }
  });

  return partnerships;
}

// ─── Regenerate one sport type ────────────────────────────────────────────────

function regenerateType(type) {
  console.log(`\n⚙️  Regenerating derived data for: ${type}`);

  const matchesFile      = path.join(DATA_DIR, `${type}_matches.json`);
  const playersFile      = path.join(DATA_DIR, `${type}_players.json`);
  const partnershipsFile = path.join(DATA_DIR, `${type}_partnerships.json`);

  if (!fs.existsSync(matchesFile)) {
    console.log(`   ℹ️  ${type}_matches.json not found — skipping`);
    return;
  }

  const matches = loadJson(matchesFile);
  console.log(`   📂 Loaded ${matches.length} matches from ${type}_matches.json`);

  let config;
  try {
    config = loadConfig(type);
  } catch (e) {
    console.error(`   ❌ ${e.message}`);
    process.exit(1);
  }

  const allPlayerRecords  = [];
  const allPartnerships   = [];

  for (const match of matches) {
    try {
      const playerRecords = buildPlayerRecords(match, config);
      const partnerships  = buildPartnerships(match);
      allPlayerRecords.push(...playerRecords);
      allPartnerships.push(...partnerships);
    } catch (e) {
      console.error(`   ❌ Error processing S${match.season} M${match.matchNum}: ${e.message}`);
      console.error(e.stack);
      process.exit(1);
    }
  }

  fs.writeFileSync(playersFile,      JSON.stringify(allPlayerRecords, null, 2));
  fs.writeFileSync(partnershipsFile, JSON.stringify(allPartnerships,  null, 2));

  console.log(`   ✅ ${type}_players.json      — ${allPlayerRecords.length} records`);
  console.log(`   ✅ ${type}_partnerships.json — ${allPartnerships.length} records`);
}

// ─── Update meta.json ─────────────────────────────────────────────────────────

function updateMeta() {
  const metaFile = path.join(DATA_DIR, 'meta.json');
  const types    = ['box', 'classic', 'pair'];
  const meta     = { generatedAt: new Date().toISOString() };

  for (const type of types) {
    const matchesFile = path.join(DATA_DIR, `${type}_matches.json`);
    if (!fs.existsSync(matchesFile)) continue;

    const matches       = loadJson(matchesFile);
    const seasons       = [...new Set(matches.map(m => m.season))].sort((a,b) => a-b);
    const uniquePlayers = new Set();
    let totalInnings    = 0;

    for (const m of matches) {
      for (const inn of (m.innings || [])) {
        totalInnings += (inn.batters || []).length;
        for (const b of (inn.batters || [])) {
          if (b.player) uniquePlayers.add(b.player);
        }
      }
    }

    meta[type] = {
      totalMatches:       matches.length,
      totalPlayerInnings: totalInnings,
      uniquePlayers:      uniquePlayers.size,
      seasons,
    };
  }

  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  console.log(`\n✅ meta.json updated`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const arg   = process.argv[2] || 'all';
  const types = arg === 'all' ? ['box', 'classic', 'pair'] : [arg];

  console.log(`\n🔄 RACL Derived Data Regeneration`);
  console.log(`   Types: ${types.join(', ')}`);

  for (const type of types) {
    regenerateType(type);
  }

  updateMeta();

  console.log(`\n✅ Regeneration complete`);
}

main();
