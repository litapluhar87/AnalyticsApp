// scripts/patch_captains.js
// Restores captain data in box_matches.json and classic_matches.json
// Stores captain as innings-level field: innings.captain = "PlayerName"
// This covers all players (batters AND DNB) consistently
// Run: node scripts/patch_captains.js
// After running: node scripts/regenerate_derived.js box && node scripts/regenerate_derived.js classic

'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data/json');

// ─── Captain data ─────────────────────────────────────────────────────────────
// batInning 1 = first batting innings of match (innings[0] for T12)
// batInning 2 = second batting innings of match (innings[1] for T12)
// For Test: inningGroup 1 = first weekend (innings 0,1), inningGroup 2 = second weekend (innings 2,3)

const BOX_CAPTAINS = [
  { season:3, matchNum:1,  batInning:1, player:'Gaurav'  },
  { season:3, matchNum:1,  batInning:2, player:'Eshwar'  },
  { season:4, matchNum:1,  batInning:1, player:'Amar'    },
  { season:4, matchNum:1,  batInning:2, player:'Eshwar'  },
  { season:5, matchNum:1,  batInning:1, player:'Amar'    },
  { season:5, matchNum:1,  batInning:2, player:'Macchi'  },
  { season:5, matchNum:2,  batInning:1, player:'Amar'    },
  { season:5, matchNum:2,  batInning:2, player:'Anil'    },
  { season:5, matchNum:3,  batInning:1, player:'Amar'    },
  { season:5, matchNum:3,  batInning:2, player:'Macchi'  },
  { season:5, matchNum:4,  batInning:1, player:'Amar'    },
  { season:5, matchNum:4,  batInning:2, player:'Amol'    },
  { season:5, matchNum:5,  batInning:1, player:'Sandy D' },
  { season:5, matchNum:5,  batInning:2, player:'Eshwar'  },
  { season:5, matchNum:6,  batInning:1, player:'Sandy D' },
  { season:5, matchNum:6,  batInning:2, player:'Eshwar'  },
  // S5 M7 Test — 4 innings
  { season:5, matchNum:7,  batInning:1, player:'Mangesh', inningGroup:1 },
  { season:5, matchNum:7,  batInning:2, player:'Sandy D', inningGroup:1 },
  { season:5, matchNum:7,  batInning:1, player:'Sandy D', inningGroup:2 },
  { season:5, matchNum:7,  batInning:2, player:'Mangesh', inningGroup:2 },
  { season:6, matchNum:1,  batInning:1, player:'Macchi'  },
  { season:6, matchNum:1,  batInning:2, player:'Gaurav'  },
  { season:6, matchNum:2,  batInning:1, player:'Amol'    },
  { season:6, matchNum:2,  batInning:2, player:'Macchi'  },
  { season:6, matchNum:3,  batInning:1, player:'Anil'    },
  { season:6, matchNum:3,  batInning:2, player:'Amol'    },
  { season:6, matchNum:4,  batInning:1, player:'Macchi'  },
  { season:6, matchNum:4,  batInning:2, player:'Amol'    },
  { season:6, matchNum:5,  batInning:1, player:'Amol'    },
  { season:6, matchNum:5,  batInning:2, player:'Macchi'  },
  { season:6, matchNum:6,  batInning:1, player:'Ranjit'  },
  { season:6, matchNum:6,  batInning:2, player:'Macchi'  },
  { season:6, matchNum:7,  batInning:1, player:'Amol'    },
  { season:6, matchNum:7,  batInning:2, player:'Macchi'  },
];

const CLASSIC_CAPTAINS = [
  // Season 1
  { season:1, matchNum:1,  batInning:1, player:'Eshwar'  },
  { season:1, matchNum:1,  batInning:2, player:'Rahul'   },
  { season:1, matchNum:2,  batInning:1, player:'Eshwar'  },
  { season:1, matchNum:2,  batInning:2, player:'Rahul'   },
  { season:1, matchNum:3,  batInning:1, player:'Rahul'   },
  { season:1, matchNum:3,  batInning:2, player:'Eshwar'  },
  { season:1, matchNum:4,  batInning:1, player:'Rahul'   },
  { season:1, matchNum:4,  batInning:2, player:'Eshwar'  },
  { season:1, matchNum:5,  batInning:1, player:'Rahul'   },
  { season:1, matchNum:5,  batInning:2, player:'Eshwar'  },
  { season:1, matchNum:6,  batInning:1, player:'Eshwar'  },
  { season:1, matchNum:6,  batInning:2, player:'Amol'    },
  { season:1, matchNum:7,  batInning:1, player:'Amol'    },
  { season:1, matchNum:7,  batInning:2, player:'Eshwar'  },
  { season:1, matchNum:8,  batInning:1, player:'Amol'    },
  { season:1, matchNum:8,  batInning:2, player:'Eshwar'  },
  { season:1, matchNum:9,  batInning:1, player:'Amol'    },
  { season:1, matchNum:9,  batInning:2, player:'Eshwar'  },
  { season:1, matchNum:10, batInning:1, player:'Amol'    },
  { season:1, matchNum:10, batInning:2, player:'Eshwar'  },
  // S1 M11 Test
  { season:1, matchNum:11, batInning:1, player:'Eshwar',  inningGroup:1 },
  { season:1, matchNum:11, batInning:2, player:'Amol',    inningGroup:1 },
  { season:1, matchNum:11, batInning:1, player:'Amol',    inningGroup:2 },
  { season:1, matchNum:11, batInning:2, player:'Eshwar',  inningGroup:2 },
  // Season 2
  { season:2, matchNum:1,  batInning:1, player:'Vallabh' },
  { season:2, matchNum:1,  batInning:2, player:'Macchi'  },
  { season:2, matchNum:2,  batInning:1, player:'Vallabh' },
  { season:2, matchNum:2,  batInning:2, player:'Macchi'  },
  { season:2, matchNum:3,  batInning:1, player:'Macchi'  },
  { season:2, matchNum:3,  batInning:2, player:'Vallabh' },
  { season:2, matchNum:4,  batInning:1, player:'Amar'    },
  { season:2, matchNum:4,  batInning:2, player:'Macchi'  },
  { season:2, matchNum:5,  batInning:1, player:'Vallabh' },
  { season:2, matchNum:5,  batInning:2, player:'Macchi'  },
  { season:2, matchNum:6,  batInning:1, player:'Vallabh' },
  { season:2, matchNum:6,  batInning:2, player:'Macchi'  },
  { season:2, matchNum:7,  batInning:1, player:'Sandy N' },
  { season:2, matchNum:7,  batInning:2, player:'Vallabh' },
  // S2 M8 Test
  { season:2, matchNum:8,  batInning:1, player:'Macchi',  inningGroup:1 },
  { season:2, matchNum:8,  batInning:2, player:'Vallabh', inningGroup:1 },
  { season:2, matchNum:8,  batInning:1, player:'Macchi',  inningGroup:2 },
  { season:2, matchNum:8,  batInning:2, player:'Amar',    inningGroup:2 },
  // S2 M9 Test
  { season:2, matchNum:9,  batInning:1, player:'Vallabh', inningGroup:1 },
  { season:2, matchNum:9,  batInning:2, player:'Sudhir',  inningGroup:1 },
  { season:2, matchNum:9,  batInning:1, player:'Vallabh', inningGroup:2 },
  { season:2, matchNum:9,  batInning:2, player:'Sudhir',  inningGroup:2 },
  // Season 3
  { season:3, matchNum:1,  batInning:1, player:'Gaurav'  },
  { season:3, matchNum:1,  batInning:2, player:'Amol'    },
  { season:3, matchNum:2,  batInning:1, player:'Amol'    },
  { season:3, matchNum:2,  batInning:2, player:'Gaurav'  },
  { season:3, matchNum:3,  batInning:1, player:'Gaurav'  },
  { season:3, matchNum:3,  batInning:2, player:'Amol'    },
  { season:3, matchNum:4,  batInning:1, player:'Gaurav'  },
  { season:3, matchNum:4,  batInning:2, player:'Amol'    },
  { season:3, matchNum:5,  batInning:1, player:'Gaurav'  },
  { season:3, matchNum:5,  batInning:2, player:'Sushil'  },
  { season:3, matchNum:6,  batInning:1, player:'Gaurav'  },
  { season:3, matchNum:6,  batInning:2, player:'Sushil'  },
  { season:3, matchNum:7,  batInning:1, player:'Sandy D' },
  { season:3, matchNum:7,  batInning:2, player:'Sushil'  },
  { season:3, matchNum:8,  batInning:1, player:'Anil'    },
  { season:3, matchNum:8,  batInning:2, player:'Sandy D' },
  { season:3, matchNum:9,  batInning:1, player:'Amar'    },
  { season:3, matchNum:9,  batInning:2, player:'Mangesh' },
  { season:3, matchNum:10, batInning:1, player:'Amar'    },
  { season:3, matchNum:10, batInning:2, player:'Mangesh' },
  { season:3, matchNum:11, batInning:1, player:'Macchi'  },
  { season:3, matchNum:11, batInning:2, player:'Amar'    },
  // S3 M12 Test
  { season:3, matchNum:12, batInning:1, player:'Rahul',   inningGroup:1 },
  { season:3, matchNum:12, batInning:2, player:'Anil',    inningGroup:1 },
  { season:3, matchNum:12, batInning:1, player:'Rahul',   inningGroup:2 },
  { season:3, matchNum:12, batInning:2, player:'Anil',    inningGroup:2 },
  // S3 M13 Test
  { season:3, matchNum:13, batInning:1, player:'Sandy N', inningGroup:1 },
  { season:3, matchNum:13, batInning:2, player:'Rahul',   inningGroup:1 },
  { season:3, matchNum:13, batInning:1, player:'Sandy N', inningGroup:2 },
  { season:3, matchNum:13, batInning:2, player:'Rahul',   inningGroup:2 },
  // Season 6
  { season:6, matchNum:1,  batInning:1, player:'Macchi'  },
  { season:6, matchNum:1,  batInning:2, player:'Amol'    },
];

// ─── Patch function ───────────────────────────────────────────────────────────
// Sets innings.captain = "PlayerName" at the innings level
// Works for both batters and DNB players

function getInningsIndex(match, cap) {
  const isTest = match.format === 'Test';
  if (isTest) {
    const group   = cap.inningGroup || 1;
    const baseIdx = (group - 1) * 2;
    return baseIdx + (cap.batInning - 1);
  }
  return cap.batInning - 1;
}

function patchMatches(type, captains) {
  const filePath = path.join(DATA_DIR, `${type}_matches.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${type}_matches.json not found`);
    return;
  }

  const matches  = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let patchCount = 0;
  let notFound   = [];

  for (const cap of captains) {
    const match = matches.find(m =>
      m.season === cap.season && m.matchNum === cap.matchNum
    );

    if (!match) {
      notFound.push(`S${cap.season} M${cap.matchNum} — match not found`);
      continue;
    }

    const inningsIdx = getInningsIndex(match, cap);
    const innings    = match.innings[inningsIdx];

    if (!innings) {
      notFound.push(`S${cap.season} M${cap.matchNum} inningsIdx=${inningsIdx} — innings not found`);
      continue;
    }

    // Set captain at innings level — covers batters AND DNB
    innings.captain = cap.player;
    patchCount++;
    console.log(`   ✅ S${cap.season} M${cap.matchNum} inn${inningsIdx} (${innings.team} batting) → captain: ${cap.player}`);
  }

  fs.writeFileSync(filePath, JSON.stringify(matches, null, 2));
  console.log(`\n✅ ${type}_matches.json — ${patchCount} innings patched`);

  if (notFound.length > 0) {
    console.log(`\n⚠️  Not found:`);
    notFound.forEach(n => console.log(`   • ${n}`));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log('\n🏏 Patching captain data (innings level)...\n');
console.log('BOX:');
patchMatches('box', BOX_CAPTAINS);
console.log('\nCLASSIC:');
patchMatches('classic', CLASSIC_CAPTAINS);
console.log('\n✅ Done. Now run:');
console.log('   node scripts/regenerate_derived.js box');
console.log('   node scripts/regenerate_derived.js classic');
