// scripts/diagnose_bowling.js
// Finds players with missing bowling data in {type}_matches.json
// Compare output against your Excel to identify what needs fixing
//
// Usage: node scripts/diagnose_bowling.js [box|classic|pair]
// Default: box

'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data/json');

function toDecimalOvers(overs) {
  if (!overs && overs !== 0) return 0;
  const [whole, balls] = String(overs).split('.');
  return parseInt(whole, 10) + (parseInt(balls || '0', 10) / 6);
}

function diagnoseType(type) {
  const matchesFile = path.join(DATA_DIR, `${type}_matches.json`);
  if (!fs.existsSync(matchesFile)) {
    console.log(`❌ ${type}_matches.json not found`);
    return;
  }

  const matches = JSON.parse(fs.readFileSync(matchesFile, 'utf8'));
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${type.toUpperCase()} — ${matches.length} matches`);
  console.log('='.repeat(60));

  let totalIssues = 0;

  for (const match of matches) {
    const matchLabel = `S${match.season} M${match.matchNum} (${match.format} @ ${match.ground} ${match.date || 'no date'})`;
    const issues = [];

    for (let i = 0; i < match.innings.length; i++) {
      const innings  = match.innings[i];
      const batters  = innings.batters  || [];
      const bowlers  = innings.bowlers  || [];
      const dnb      = innings.dnb      || [];

      // All player names who bowled this innings
      const bowlerNames = new Set(bowlers.map(b => b.player));

      // Total overs bowled
      const totalOvers = bowlers.reduce((sum, b) => sum + toDecimalOvers(b.overs), 0);

      // Check each batter — did they bowl in any innings?
      // A batter might bowl in a DIFFERENT innings (they bowl against opposite team)
      // So check ALL innings for their bowling
      const allBowlerNames = new Set(
        match.innings.flatMap(inn => (inn.bowlers || []).map(b => b.player))
      );

      // Flag batters with no bowling anywhere in the match
      const battersNoBowling = batters
        .filter(b => b.player && !allBowlerNames.has(b.player))
        .map(b => b.player);

      // Flag DNB players with no bowling
      const dnbNoBowling = dnb
        .filter(p => p && !allBowlerNames.has(p));

      // Flag innings with suspiciously few bowlers
      const expectedBowlers = match.format === 'Test' ? 4 : 3;
      const fewBowlers = bowlers.length < expectedBowlers;

      // Flag innings with 0 total overs bowled but wickets taken
      const wicketsTaken = batters.filter(b => b.dismissType && b.dismissType !== '' && b.dismissType !== 'not out' && b.dismissType !== 'retired').length;

      if (battersNoBowling.length > 0 || dnbNoBowling.length > 0 || fewBowlers) {
        const innLabel = `  Inn ${i+1} (${innings.team} batting, ${innings.bowlingTeam} bowling)`;

        if (battersNoBowling.length > 0) {
          issues.push(`${innLabel}`);
          issues.push(`    ⚠️  Batters with NO bowling in entire match: ${battersNoBowling.join(', ')}`);
        }

        if (dnbNoBowling.length > 0) {
          issues.push(`${innLabel}`);
          issues.push(`    ⚠️  DNB players with NO bowling: ${dnbNoBowling.join(', ')}`);
        }

        if (fewBowlers) {
          issues.push(`${innLabel}`);
          issues.push(`    ⚠️  Only ${bowlers.length} bowler(s) recorded (expected ${expectedBowlers}+): ${bowlers.map(b => `${b.player}(${b.overs}ov)`).join(', ')}`);
        }
      }
    }

    if (issues.length > 0) {
      totalIssues++;
      console.log(`\n❌ ${matchLabel}`);
      console.log(`   ${match.team1} vs ${match.team2}`);
      issues.forEach(i => console.log(i));
    }
  }

  if (totalIssues === 0) {
    console.log('\n✅ No obvious bowling data issues found');
  } else {
    console.log(`\n📊 Total matches with issues: ${totalIssues} / ${matches.length}`);
  }
}

const type = process.argv[2] || 'box';
diagnoseType(type);
console.log('\nDone. Compare flagged players against your Excel Scr tabs to find missing bowling entries.');
