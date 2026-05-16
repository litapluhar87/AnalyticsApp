// scripts/mom_engine.js
// Phase 2 — RACL Man of the Match Engine
// Usage: node scripts/mom_engine.js <path-to-parsed-json>
// Or piped: node parse_scorecard.js scorecard.pdf | node mom_engine.js
//
// Reads parsed match JSON → calculates MVP points per player → applies MoM rules
// MVP rules read from src/config/box.config.json or classic.config.json
// momOverridePoints read from same config (mvpRules.momOverridePoints)
// Output: same JSON with "mom" field added, written back to same file

'use strict';

const fs   = require('fs');
const path = require('path');

const BOX_CONFIG     = path.resolve(__dirname, '../src/config/box.config.json');
const CLASSIC_CONFIG = path.resolve(__dirname, '../src/config/classic.config.json');
const PAIR_CONFIG    = path.resolve(__dirname, '../src/config/pair.config.json');

// ─── Load sport config ────────────────────────────────────────────────────────

function loadSportConfig(type) {
  const configMap = {
    box:     BOX_CONFIG,
    classic: CLASSIC_CONFIG,
    pair:    PAIR_CONFIG,
  };
  const configPath = configMap[type];
  if (!configPath || !fs.existsSync(configPath)) {
    throw new Error(`No config found for sport type "${type}"`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// ─── Batting points ───────────────────────────────────────────────────────────

function calcBattingPoints(batter, rules) {
  const r = rules.batting;
  if (!batter || batter.runs === undefined) return 0;

  const runs   = batter.runs;
  const balls  = batter.balls || 0;
  const fours  = batter.fours || 0;
  const sixes  = batter.sixes || 0;
  const isNotOut = !batter.dismissType || batter.dismissType === '' || batter.dismissType === 'not out' || batter.dismissType === 'retired';

  // Base run points
  let points = runs * r.runPoints;

  // Boundary bonus
  points += fours * r.boundaryBonus.four;
  points += sixes * r.boundaryBonus.six;

  // Strike rate bonus/penalty
  // diff is in percentage points (e.g. 26.32), divide by 100 to normalise
  // Bonus:   0.3 x (diff/100) x runs
  // Penalty: 0.3 x (diff/100) x balls  [diff negative so result negative]
  if (balls > 0) {
    const actualSR    = (runs / balls) * 100;
    const thresholdSR = r.strikeRate.threshold * 100;
    const srDiff      = (actualSR - thresholdSR) / 100;

    if (srDiff > 0) {
      points += srDiff * r.strikeRate.bonusMultiplier * runs;
    } else {
      const penalty = srDiff * r.strikeRate.penaltyMultiplier * balls;
      points += Math.max(penalty, r.strikeRate.maxPenalty);
    }
  }

  // Milestones — absolute (highest bracket reached, not additive)
  const batMilestones = Object.entries(r.milestones)
    .map(([threshold, bonus]) => ({ threshold: Number(threshold), bonus }))
    .sort((a, b) => b.threshold - a.threshold); // descending
  for (const { threshold, bonus } of batMilestones) {
    if (runs >= threshold) { points += bonus; break; }
  }

  // Not-out bonus:
  // notOutCalc = runs x 0.2
  // shortfall  = max(0, minimumPoints - runs)
  // finalBonus = max(notOutCalc, shortfall)
  if (isNotOut) {
    const notOutCalc = runs * r.notOutBonus.multiplier;
    const shortfall  = Math.max(0, r.notOutBonus.minimumPoints - runs);
    points += Math.max(notOutCalc, shortfall);
  }

  return points;
}

// ─── Bowling points ───────────────────────────────────────────────────────────

// Map dismissType codes to wicket type keys in config
const DISMISS_TO_WICKET_TYPE = {
  'b':   'bowled',
  'h':   'hitWicket',
  'c':   'caught',
  'st':  'stumped',
  'lbw': 'lbw',
  'ro':  'runOut',
};

// Handle both "ro" (new parser) and "run out" (old Excel migration)
function isRunOut(dt) {
  return dt === 'ro' || dt === 'run out';
}

function calcBowlingPoints(bowler, battingInnings, rules) {
  const r = rules.bowling;
  if (!bowler) return 0;

  const overs   = toDecimalOvers(bowler.overs);
  const maidens = bowler.maidens || 0;
  const runs    = bowler.runs;
  const wickets = bowler.wickets || 0;

  // Wicket points — need to know dismissal types for each wicket taken
  // We find the batters dismissed by this bowler in the batting innings
  const dismissedByBowler = (battingInnings?.batters || []).filter(
    b => b.bowler === bowler.player && b.dismissType && !isRunOut(b.dismissType) && b.dismissType !== ''
  );

  let wicketPoints = 0;
  for (const batter of dismissedByBowler) {
    const wicketKey = DISMISS_TO_WICKET_TYPE[batter.dismissType];
    if (wicketKey && r.wicketTypes[wicketKey] !== undefined) {
      wicketPoints += r.wicketTypes[wicketKey];
    }
  }

  // Maiden overs
  const maidenPoints = maidens * r.maidenOver;

  // Economy bonus/penalty
  let economyPoints = 0;
  if (overs > 0) {
    const actualEco   = runs / overs;
    const expectedEco = r.economy.expectedEconomy;
    const ecoDiff     = expectedEco - actualEco; // positive = bowling under expected = good
    economyPoints = ecoDiff * overs * r.economy.multiplier;
    economyPoints = Math.max(economyPoints, r.economy.maxPenalty);
  }

  // Milestone — absolute (highest bracket reached, not additive)
  let milestonePoints = 0;
  const bowlMilestones = Object.entries(r.milestones)
    .map(([threshold, bonus]) => ({ threshold: Number(threshold), bonus }))
    .sort((a, b) => b.threshold - a.threshold); // descending
  for (const { threshold, bonus } of bowlMilestones) {
    if (wickets >= threshold) { milestonePoints = bonus; break; }
  }

  return wicketPoints + maidenPoints + economyPoints + milestonePoints;
}

// ─── Fielding points ──────────────────────────────────────────────────────────
// Derived from dismissal strings across all innings

function calcFieldingPoints(playerName, allInnings, rules) {
  const r = rules.fielding;
  let points = 0;

  for (const innings of allInnings) {
    for (const batter of (innings.batters || [])) {
      const dt = batter.dismissType;

      if (dt === 'c') {
        // caught & bowled — fielder is "", bowler gets credit
        // regular catch — fielder gets credit
        if (batter.fielder === '' && batter.bowler === playerName) {
          // c&b: bowler takes the catch
          points += r.catch;
        } else if (batter.fielder === playerName) {
          points += r.catch;
        }
      }

      if (dt === 'st' && batter.fielder === playerName) {
        points += r.stumping;
      }

      if (isRunOut(dt)) {
        // Run out: fielder string may be "Ranjit / Sandy D" (combo) or single name
        const fielderStr = batter.fielder || '';
        if (fielderStr.includes('/')) {
          // Combo run out — both get comboRunOut points
          const parts = fielderStr.split('/').map(s => s.trim());
          if (parts.includes(playerName)) {
            points += r.comboRunOut;
          }
        } else {
          // Direct run out
          if (fielderStr.trim() === playerName) {
            points += r.directRunOut;
          }
        }
      }
    }
  }

  return points;
}

// ─── Convert overs to decimal ─────────────────────────────────────────────────
// 3.4 overs = 3 + 4/6 = 3.6667 (NOT 3.4)

function toDecimalOvers(overs) {
  if (!overs && overs !== 0) return 0;
  const str    = String(overs);
  const [whole, balls] = str.split('.');
  const wholeNum = parseInt(whole, 10) || 0;
  const ballsNum = parseInt(balls || '0', 10);
  return wholeNum + (ballsNum / 6);
}

// ─── Build player roster from match ──────────────────────────────────────────
// Collect every unique player name appearing anywhere in the match

function buildPlayerRoster(match) {
  const players = new Map(); // name → { name, teams: Set }

  function addPlayer(name, team) {
    if (!name || name.startsWith('__UNKNOWN__')) return;
    if (!players.has(name)) players.set(name, { name, teams: new Set() });
    if (team) players.get(name).teams.add(team);
  }

  for (const innings of match.innings) {
    const battingTeam  = innings.team;
    const bowlingTeam  = innings.bowlingTeam;

    for (const b of (innings.batters || [])) {
      addPlayer(b.player, battingTeam);
      if (b.fielder && b.fielder !== '' && b.fielder !== '&') {
        // fielder belongs to bowling team
        // for combo run outs, parse both names
        b.fielder.split('/').map(s => s.trim()).filter(Boolean)
          .forEach(f => addPlayer(f, bowlingTeam));
      }
      if (b.bowler && b.bowler !== '') addPlayer(b.bowler, bowlingTeam);
    }

    for (const b of (innings.bowlers || [])) {
      addPlayer(b.player, bowlingTeam);
    }

    for (const d of (innings.dnb || [])) {
      addPlayer(d, battingTeam);
    }
  }

  return players;
}

// ─── Calculate MVP points for every player ───────────────────────────────────

function calculateAllMVP(match, rules) {
  const roster  = buildPlayerRoster(match);
  const results = [];

  for (const [playerName, info] of roster) {
    let totalBatting  = 0;
    let totalBowling  = 0;
    let totalFielding = 0;

    // Batting — aggregate across all innings this player batted in
    for (const innings of match.innings) {
      const batterEntry = (innings.batters || []).find(b => b.player === playerName);
      if (batterEntry) {
        totalBatting += calcBattingPoints(batterEntry, rules);
      }
    }

    // Bowling — aggregate across all innings this player bowled in
    // The batting innings for a bowler is the SAME innings (bowler bowls against batters)
    for (const innings of match.innings) {
      const bowlerEntry = (innings.bowlers || []).find(b => b.player === playerName);
      if (bowlerEntry) {
        // Pass the same innings so we can look up dismissal types
        totalBowling += calcBowlingPoints(bowlerEntry, innings, rules);
      }
    }

    // Fielding — scan all innings
    totalFielding = calcFieldingPoints(playerName, match.innings, rules);

    const total = totalBatting + totalBowling + totalFielding;

    // Determine which team this player played for
    // Most players appear for one team; take the most common
    const teamArr  = [...info.teams];
    const team     = teamArr.length === 1 ? teamArr[0] : teamArr[0]; // use first if ambiguous

    results.push({
      player:   playerName,
      team,
      batting:  Math.round(totalBatting  * 100) / 100,
      bowling:  Math.round(totalBowling  * 100) / 100,
      fielding: Math.round(totalFielding * 100) / 100,
      total:    Math.round(total         * 100) / 100,
    });
  }

  // Sort descending by total points
  results.sort((a, b) => b.total - a.total);
  return results;
}

// ─── Apply MoM rules ─────────────────────────────────────────────────────────

function determineMoM(leaderboard, match, momOverridePoints) {
  const winner = match.winner;
  const isTie  = !winner || winner === 'Tie';

  if (leaderboard.length === 0) {
    console.warn('⚠️  Empty leaderboard — cannot determine MoM');
    return null;
  }

  // Filter to eligible players only
  // For Test: player must appear in at least 2 innings (their team bats twice)
  // For T12:  player must appear in at least 1 innings
  // Appearance = batted, bowled, or DNB in that innings
  const isTest      = match.format === 'Test';
  const minInnings  = isTest ? 2 : 1;

  function countInningsAppeared(playerName) {
    return match.innings.filter(inn =>
      (inn.batters || []).some(b => b.player === playerName) ||
      (inn.bowlers || []).some(b => b.player === playerName) ||
      (inn.dnb     || []).includes(playerName)
    ).length;
  }

  const eligibleLeaderboard = leaderboard.filter(p => {
    const appeared = countInningsAppeared(p.player);
    if (appeared < minInnings) {
      console.log(`   ⏭️  ${p.player} ineligible for MoM — only appeared in ${appeared}/${match.innings.length} innings`);
      return false;
    }
    return true;
  });

  if (eligibleLeaderboard.length === 0) {
    console.warn('⚠️  No eligible players for MoM — falling back to full leaderboard');
    // Fall back to full leaderboard to avoid null MoM
  }

  const activeLB = eligibleLeaderboard.length > 0 ? eligibleLeaderboard : leaderboard;
  const topper   = activeLB[0];

  // Tie — topper always wins
  if (isTie) {
    console.log(`   🏆 Tie match — Topper ${topper.player} (${topper.total} pts) is MoM`);
    return topper.player;
  }

  // Topper's team won — straightforward
  if (topper.team === winner) {
    console.log(`   🏆 Topper ${topper.player} (${topper.total} pts) is from winning team — MoM`);
    return topper.player;
  }

  // Topper is from losing team — find next player from winning team
  const nextWinner = activeLB.find(p => p.team === winner);

  if (!nextWinner) {
    // No players from winning team found — fall back to topper
    console.warn(`   ⚠️  No winning team player found in leaderboard — defaulting to Topper`);
    return topper.player;
  }

  const gap = topper.total - nextWinner.total;
  console.log(`   Topper: ${topper.player} (${topper.total} pts, losing team)`);
  console.log(`   Next winner: ${nextWinner.player} (${nextWinner.total} pts, winning team)`);
  console.log(`   Gap: ${gap.toFixed(2)} pts | Override threshold: ${momOverridePoints}`);

  if (gap > momOverridePoints) {
    console.log(`   🏆 Gap > threshold — Topper ${topper.player} is MoM despite losing`);
    return topper.player;
  } else {
    console.log(`   🏆 Gap ≤ threshold — ${nextWinner.player} (winning team) is MoM`);
    return nextWinner.player;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let match;

  // Support two input modes:
  // 1. Piped from parse_scorecard.js (reads __PARSED_JSON_START__...__PARSED_JSON_END__ from stdin)
  // 2. File path as argument: node mom_engine.js scripts/output/B120607SG.json

  const inputFile = process.argv[2];

  if (inputFile) {
    // Mode 1: file argument
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ File not found: ${inputFile}`);
      process.exit(1);
    }
    match = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    console.log(`\n📊 MoM Engine — loaded from file: ${inputFile}`);
  } else {
    // Mode 2: read from stdin (piped)
    const stdin = fs.readFileSync('/dev/stdin', 'utf8');
    const startMarker = '__PARSED_JSON_START__';
    const endMarker   = '__PARSED_JSON_END__';
    const startIdx = stdin.indexOf(startMarker);
    const endIdx   = stdin.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1) {
      console.error('❌ No parsed JSON markers found in stdin. Pipe from parse_scorecard.js or pass a file path.');
      process.exit(1);
    }
    const jsonStr = stdin.slice(startIdx + startMarker.length, endIdx).trim();
    match = JSON.parse(jsonStr);
    console.log(`\n📊 MoM Engine — reading from stdin pipe`);
  }

  console.log(`   Match: ${match.team1} vs ${match.team2} | Season ${match.season} M${match.matchNum} | ${match.type} ${match.format}`);
  console.log(`   Winner: ${match.winner || 'Tie'}`);

  // Load sport config for MVP rules
  let config;
  try {
    config = loadSportConfig(match.type);
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }

  const rules             = config.mvpRules;
  const momOverridePoints = rules.momOverridePoints;

  // Calculate MVP points for all players
  console.log(`\n⚙️  Calculating MVP points...`);
  const leaderboard = calculateAllMVP(match, rules);

  // Print leaderboard (top 10)
  console.log(`\n🏅 MVP Leaderboard (top 10):`);
  leaderboard.slice(0, 10).forEach((p, i) => {
    console.log(`   ${String(i+1).padStart(2)}. ${p.player.padEnd(12)} ${String(p.total.toFixed(1)).padStart(6)} pts  [bat:${p.batting.toFixed(1)} bowl:${p.bowling.toFixed(1)} field:${p.fielding.toFixed(1)}]  (${p.team})`);
  });

  // Determine MoM
  console.log(`\n🎯 Applying MoM rules (override threshold: ${momOverridePoints})...`);
  const mom = determineMoM(leaderboard, match, momOverridePoints);

  if (!mom) {
    console.error(`❌ Could not determine MoM`);
    process.exit(1);
  }

  // Attach mom and mvpLeaderboard to match object
  match.mom            = mom;
  match.mvpLeaderboard = leaderboard; // stored for append_match.js to optionally use

  console.log(`\n✅ MoM: ${mom}`);

  // Write back to file (or to output dir if no input file)
  const outPath = inputFile || path.resolve(__dirname, `../scripts/output/${match.type[0].toUpperCase()}${match.format === 'Test' ? 'TS' : '12'}${String(match.season).padStart(2,'0')}${String(match.matchNum).padStart(2,'0')}.json`);
  fs.writeFileSync(outPath, JSON.stringify(match, null, 2));
  console.log(`💾 Updated JSON written to: ${outPath}`);

  // Emit for piping
  process.stdout.write('\n__MOM_JSON_START__\n');
  process.stdout.write(JSON.stringify(match));
  process.stdout.write('\n__MOM_JSON_END__\n');
}

main().catch(e => {
  console.error(`❌ Unexpected error: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
