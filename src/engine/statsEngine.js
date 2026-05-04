// src/engine/statsEngine.js

// ─── Cache & Loaders ─────────────────────────────────────────────────────────

const cache = {};

function loadConfig(sport) {
  if (cache[`cfg_${sport}`]) return cache[`cfg_${sport}`];
  cache[`cfg_${sport}`] = require(`../config/${sport}.config.json`);
  return cache[`cfg_${sport}`];
}

function loadData(sport) {
  if (cache[`data_${sport}`]) return cache[`data_${sport}`];
  cache[`data_${sport}`] = {
    matches:      require(`../../data/json/${sport}_matches.json`),
    players:      require(`../../data/json/${sport}_players.json`),
    partnerships: require(`../../data/json/${sport}_partnerships.json`),
  };
  return cache[`data_${sport}`];
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

function filterMatches(matches, filters = {}) {
  return matches.filter(m => {
    if (filters.season && String(m.season) !== String(filters.season)) return false;
    if (filters.format && filters.format !== 'All' && m.format !== filters.format) return false;
    if (filters.ground && m.ground !== filters.ground) return false;
    return true;
  });
}

function filterPlayers(players, filters = {}) {
  return players.filter(p => {
    if (filters.playerName     && p.player !== filters.playerName)                          return false;
    if (filters.season         && String(p.season) !== String(filters.season))              return false;
    if (filters.format         && filters.format !== 'All' && p.format !== filters.format)  return false;
    if (filters.ground         && p.ground !== filters.ground)                              return false;
    if (filters.batInning && String(p.batting?.innings) !== String(filters.batInning))      return false;
    if (filters.battingPosition && String(p.batting?.position) !== String(filters.battingPosition)) return false;
    if (filters.winLoss === 'Win'  && !p.won)  return false;
    if (filters.winLoss === 'Loss' &&  p.won)  return false;
    return true;
  });
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function aggregatePlayerStats(rows, config, allMatchRows) {
  if (!rows.length) return null;
  const name = rows[0].player;

  const batRows  = rows.filter(r => r.batting && !r.batting.dnb);
  const battedCount = batRows.filter(r => r.batting.balls > 0 || r.batting.runs >= 0).length;
  const bowlRows = rows.filter(r => r.bowling && r.bowling.overs > 0);

  const runs      = batRows.reduce((s, r) => s + (r.batting.runs   || 0), 0);
  const balls     = batRows.reduce((s, r) => s + (r.batting.balls  || 0), 0);
  const fours     = batRows.reduce((s, r) => s + (r.batting.fours  || 0), 0);
  const sixes     = batRows.reduce((s, r) => s + (r.batting.sixes  || 0), 0);
  const notOuts   = batRows.filter(r => r.batting.notOut || r.batting.retired).length;
  const highScore = batRows.length ? Math.max(...batRows.map(r => r.batting.runs || 0)) : 0;
  const highScoreNO = batRows.find(r => (r.batting.runs || 0) === highScore)?.batting?.notOut || false;

  // New batting milestones
  const ducks = batRows.filter(r =>
    (r.batting.runs || 0) === 0 &&
    !r.batting.notOut &&
    !r.batting.retired
  ).length;
  const scores15 = batRows.filter(r => (r.batting.runs || 0) >= 15).length;
  const scores30 = batRows.filter(r => (r.batting.runs || 0) >= 30).length;

  const wickets   = bowlRows.reduce((s, r) => s + (r.bowling.wickets || 0), 0);
  const overs     = bowlRows.reduce((s, r) => s + (r.bowling.oversDcml || r.bowling.overs || 0), 0);
  const runsCon   = bowlRows.reduce((s, r) => s + (r.bowling.runs    || 0), 0);
  const maidens   = bowlRows.reduce((s, r) => s + (r.bowling.maidens || 0), 0);

  // Bowling balls (overs to balls)
  const bowlBalls = bowlRows.reduce((s, r) => {
    const o = r.bowling.oversDcml || r.bowling.overs || 0;
    const fullOvers = Math.floor(o);
    const partial   = Math.round((o - fullOvers) * 10);
    return s + fullOvers * 6 + partial;
  }, 0);

  // Best bowling figures
  let best = null;
  bowlRows.forEach(r => {
    const w = r.bowling.wickets || 0;
    const ru = r.bowling.runs   || 0;
    if (!best || w > best.w || (w === best.w && ru < best.r)) {
      best = { w, r: ru };
    }
  });
  const bestFigures = best ? `${best.w}/${best.r}` : '-';

  // 2W and 3W hauls
  const twoW   = bowlRows.filter(r => (r.bowling.wickets || 0) >= 2).length;
  const threeW = bowlRows.filter(r => (r.bowling.wickets || 0) >= 3).length;

  const catches    = rows.reduce((s, r) => s + (r.fielding?.catches       || 0), 0);
  const stumpings  = rows.reduce((s, r) => s + (r.fielding?.stumpings     || 0), 0);
  const roDirects  = rows.reduce((s, r) => s + (r.fielding?.directRunOuts || 0), 0);
  const roCombos   = rows.reduce((s, r) => s + (r.fielding?.comboRunOuts  || 0), 0);
  const momCount     = rows.filter(r => r.isManOfMatch).length;

  // Captaincy
  const captainRows  = rows.filter(r => r.captain === '1' || r.captain === 1);
  const captainMatches = new Set(
    captainRows.map(r => `${r.season}-${r.matchNum}`)
  ).size;
  const captainWins  = new Set(
    captainRows.filter(r => r.won).map(r => `${r.season}-${r.matchNum}`)
  ).size;

  // Tie detection from match-level data
  const matchKeys = new Set(rows.map(r => `${r.season}-${r.matchNum}`));
  const matches   = matchKeys.size;

  // Won count
  const wonMatches = new Set(
    rows.filter(r => r.won).map(r => `${r.season}-${r.matchNum}`)
  ).size;

  const mvpBat   = rows.reduce((s, r) => s + (r.mvp?.bat   || 0), 0);
  const mvpBowl  = rows.reduce((s, r) => s + (r.mvp?.bowl  || 0), 0);
  const mvpField = rows.reduce((s, r) => s + (r.mvp?.field || 0), 0);
  const mvpTotal = rows.reduce((s, r) => s + (r.mvp?.total || 0), 0);
  const mvpMomTotal = rows.reduce((s, r) => s + (r.mvp?.mom || 0), 0);

  const innings  = batRows.length;
  const outs     = innings - notOuts;

  // Bowling SR = balls per wicket
  const bowlingSR = wickets > 0
    ? Math.round((bowlBalls / wickets) * 10) / 10
    : null;

  return {
    player:        name,
    matches,
    won:      wonMatches,
    batted:   battedCount,
    innings,
    runs,
    balls,
    fours,
    sixes,
    notOuts,
    ducks,
    scores15,
    scores30,
    highScore:     highScoreNO ? `${highScore}*` : `${highScore}`,
    wickets,
    oversBowled:   Math.round(overs * 10) / 10,
    bowlBalls,
    runsConceded:  runsCon,
    maidens,
    bestFigures,
    twoW,
    threeW,
    catches,
    stumpings,
    runOutsDirect: roDirects,
    runOutsCombo:  roCombos,
    totalFielding: catches + stumpings + roDirects + roCombos,
    momCount,
    mvpBat:        Math.round(mvpBat      * 10) / 10,
    mvpBowl:       Math.round(mvpBowl     * 10) / 10,
    mvpField:      Math.round(mvpField    * 10) / 10,
    mvpMom:        Math.round(mvpMomTotal * 10) / 10,
    mvpTotal:      Math.round(mvpTotal    * 10) / 10,
    mvpPerInning:  innings > 0
      ? Math.round((mvpTotal / innings) * 10) / 10
      : 0,
    mvpBatPerInn:  innings > 0
      ? Math.round((mvpBat      / innings) * 10) / 10 : 0,
    mvpBowlPerInn: innings > 0
      ? Math.round((mvpBowl     / innings) * 10) / 10 : 0,
    mvpFieldPerInn:innings > 0
      ? Math.round((mvpField    / innings) * 10) / 10 : 0,
    mvpMomPerInn:  innings > 0
      ? Math.round((mvpMomTotal / innings) * 10) / 10 : 0,
    captainMatches,
    captainWins,
    average:       outs > 0
      ? Math.round((runs / outs) * 10) / 10
      : runs,
    strikeRate:    balls > 0
      ? Math.round((runs / balls) * 1000) / 10
      : 0,
    economy:       overs > 0
      ? Math.round((runsCon / overs) * 10) / 10
      : 0,
    bowlingAvg:    wickets > 0
      ? Math.round((runsCon / wickets) * 10) / 10
      : null,
    bowlingSR,
  };
}

// ─── Match functions ──────────────────────────────────────────────────────────

function getMatches(sport, filters = {}) {
  const { matches, players } = loadData(sport);

  // Fill null dates from players data (needed for Test matches)
  const enriched = matches.map(m => {
    if (m.date) return m;
    const firstPlayer = players.find(p =>
      String(p.season)   === String(m.season) &&
      String(p.matchNum) === String(m.matchNum) &&
      p.date
    );
    return { ...m, date: firstPlayer?.date || null };
  });

  return filterMatches(enriched, filters)
    .sort((a, b) => {
      if (Number(b.season) !== Number(a.season)) return Number(b.season) - Number(a.season);
      return Number(b.matchNum) - Number(a.matchNum);
    });
}

function getMatchById(sport, season, matchNum) {
  const { matches } = loadData(sport);
  return matches.find(m =>
    String(m.season) === String(season) &&
    String(m.matchNum) === String(matchNum)
  ) || null;
}

function getPointsTable(sport, filters = {}) {
  const matches = getMatches(sport, filters);
  const table = {};

  matches.forEach(m => {
    [m.team1, m.team2].forEach(team => {
      if (team && !table[team]) {
        table[team] = { team, played: 0, won: 0, lost: 0, tied: 0, points: 0 };
      }
    });

    if (!m.team1 || !m.team2) return;
    table[m.team1].played++;
    table[m.team2].played++;

    if (m.result === 'Tie') {
      table[m.team1].tied++;
      table[m.team2].tied++;
      table[m.team1].points += 1;
      table[m.team2].points += 1;
    } else if (m.winner && m.winner !== 'Tie' && table[m.winner]) {
      table[m.winner].won++;
      table[m.winner].points += 2;
      const loser = m.winner === m.team1 ? m.team2 : m.team1;
      if (table[loser]) table[loser].lost++;
    }
  });

  return Object.values(table).sort((a, b) =>
    b.points - a.points || b.won - a.won
  );
}

// ─── Player functions ─────────────────────────────────────────────────────────

function getPlayerList(sport) {
  return loadConfig(sport).players || [];
}

function getPlayerStats(sport, playerName, filters = {}) {
  const { players } = loadData(sport);
  const config = loadConfig(sport);
  const rows = filterPlayers(players, { ...filters, playerName });
  return aggregatePlayerStats(rows, config);
}

function getPlayerRecentForm(sport, playerName, n = 7) {
  const { players, matches } = loadData(sport);
  const rows = players
    .filter(p => p.player === playerName)
    .sort((a, b) => {
      if (Number(b.season) !== Number(a.season)) return Number(b.season) - Number(a.season);
      return Number(b.matchNum) - Number(a.matchNum);
    })
    .slice(0, n);

  return rows.map(r => {
    const match = matches.find(m =>
      String(m.season)   === String(r.season) &&
      String(m.matchNum) === String(r.matchNum)
    );

    // Detect tie from match result
    const isTie = match?.result === 'Tie' ||
                  match?.winner === 'Tie' ||
                  match?.result?.toLowerCase().includes('tie');

    return {
      season:    r.season,
      matchNum:  r.matchNum,
      format:    r.format,
      ground:    r.ground,
      runs:      r.batting?.runs    || 0,
      balls:     r.batting?.balls   || 0,
      notOut:    r.batting?.notOut  || false,
      wickets:   r.bowling?.wickets || 0,
      runsGiven: r.bowling?.runs    || 0,
      mom:       r.isManOfMatch     || false,
      won:       r.won              || false,
      tied:      isTie              || false,
      mvpTotal:  r.mvp?.total       || 0,
      opponent:  match
        ? (match.team1 === r.team ? match.team2 : match.team1)
        : '',
    };
  });
}

// ─── Leaderboard functions ────────────────────────────────────────────────────

function buildPlayerMap(sport, filters) {
  const { players } = loadData(sport);
  const config = loadConfig(sport);
  const byPlayer = {};
  filterPlayers(players, filters).forEach(row => {
    if (!byPlayer[row.player]) byPlayer[row.player] = [];
    byPlayer[row.player].push(row);
  });
  return { byPlayer, config };
}

function getBattingLeaderboard(sport, filters = {}, sortBy = 'runs') {
  const { byPlayer, config } = buildPlayerMap(sport, filters);
  const min = config.leaderboardConfig.minInningsForBatting;
  const sortFns = {
    runs:       (a, b) => b.runs       - a.runs,
    average:    (a, b) => b.average    - a.average,
    strikeRate: (a, b) => b.strikeRate - a.strikeRate,
    fours:      (a, b) => b.fours      - a.fours,
    sixes:      (a, b) => b.sixes      - a.sixes,
    highScore:  (a, b) => parseInt(b.highScore) - parseInt(a.highScore),
  };
  return Object.values(byPlayer)
    .map(rows => aggregatePlayerStats(rows, config))
    .filter(p => p && p.innings >= min)
    .sort(sortFns[sortBy] || sortFns.runs)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

function getBowlingLeaderboard(sport, filters = {}, sortBy = 'wickets') {
  const { byPlayer, config } = buildPlayerMap(sport, filters);
  const min = config.leaderboardConfig.minInningsForBowling;
  const sortFns = {
    wickets:  (a, b) => b.wickets    - a.wickets,
    economy:  (a, b) => a.economy    - b.economy,
    average:  (a, b) => (a.bowlingAvg || 999) - (b.bowlingAvg || 999),
  };
  return Object.values(byPlayer)
    .map(rows => aggregatePlayerStats(rows, config))
    .filter(p => p && p.innings >= min && p.wickets > 0)
    .sort(sortFns[sortBy] || sortFns.wickets)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

function getFieldingLeaderboard(sport, filters = {}, sortBy = 'total') {
  const { byPlayer, config } = buildPlayerMap(sport, filters);
  const sortFns = {
    total:     (a, b) => b.totalFielding - a.totalFielding,
    catches:   (a, b) => b.catches       - a.catches,
    stumpings: (a, b) => b.stumpings     - a.stumpings,
    runOuts:   (a, b) => (b.runOutsDirect + b.runOutsCombo) - (a.runOutsDirect + a.runOutsCombo),
  };
  return Object.values(byPlayer)
    .map(rows => aggregatePlayerStats(rows, config))
    .filter(p => p && p.totalFielding > 0)
    .sort(sortFns[sortBy] || sortFns.total)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

function getMVPLeaderboard(sport, filters = {}, sortBy = 'totalPoints') {
  const { byPlayer, config } = buildPlayerMap(sport, filters);
  const min = config.leaderboardConfig.minMatchesForMVP;
  const sortFns = {
    totalPoints: (a, b) => b.mvpTotal     - a.mvpTotal,
    batPoints:   (a, b) => b.mvpBat       - a.mvpBat,
    bowlPoints:  (a, b) => b.mvpBowl      - a.mvpBowl,
    fieldPoints: (a, b) => b.mvpField     - a.mvpField,
    momCount:    (a, b) => b.momCount     - a.momCount,
    perInning:   (a, b) => b.mvpPerInning - a.mvpPerInning,
  };
  return Object.values(byPlayer)
    .map(rows => aggregatePlayerStats(rows, config))
    .filter(p => p && p.matches >= min)
    .sort(sortFns[sortBy] || sortFns.totalPoints)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

function getPartnershipLeaderboard(sport, filters = {}, sortBy = 'runs') {
  const { partnerships } = loadData(sport);
  const filtered = partnerships.filter(p => {
    if (filters.season && String(p.season) !== String(filters.season)) return false;
    if (filters.format && filters.format !== 'All' && p.format !== filters.format) return false;
    if (filters.ground && p.ground !== filters.ground) return false;
    return true;
  });

  const byPair = {};
  filtered.forEach(p => {
    const key = [p.player1, p.player2].sort().join('|');
    if (!byPair[key]) byPair[key] = {
      player1: key.split('|')[0],
      player2: key.split('|')[1],
      runs: 0, balls: 0, count: 0
    };
    byPair[key].runs  += Number(p.runs  || 0);
    byPair[key].balls += Number(p.balls || 0);
    byPair[key].count++;
  });

  const sortFns = {
    runs:       (a, b) => b.runs       - a.runs,
    strikeRate: (a, b) => b.strikeRate - a.strikeRate,
    count:      (a, b) => b.count      - a.count,
  };

  return Object.values(byPair)
    .map(pair => ({
      ...pair,
      strikeRate: pair.balls > 0
        ? Math.round((pair.runs / pair.balls) * 1000) / 10
        : 0,
    }))
    .sort(sortFns[sortBy] || sortFns.runs)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

// ─── Comparison functions ─────────────────────────────────────────────────────

function comparePlayers(sport, player1, player2, filters = {}) {
  return {
    player1: getPlayerStats(sport, player1, filters),
    player2: getPlayerStats(sport, player2, filters),
  };
}

function comparePlayerSeasons(sport, playerName, season1, season2) {
  return {
    season1: getPlayerStats(sport, playerName, { season: season1 }),
    season2: getPlayerStats(sport, playerName, { season: season2 }),
  };
}

// ─── Home functions ───────────────────────────────────────────────────────────

function getSeasonSnapshot(sport, season, format) {
  const filters = { season };
  if (format && format !== 'All') filters.format = format;
  const matches  = getMatches(sport, filters);
  const { players } = loadData(sport);
  const config   = loadConfig(sport);
  const pRows    = filterPlayers(players, filters);
  const totalRuns = pRows.reduce((s, r) => s + (r.batting?.runs || 0), 0);
  const totalWkts = pRows.reduce((s, r) => s + (r.bowling?.wickets || 0), 0);
  const mvpBoard  = getMVPLeaderboard(sport, filters, 'totalPoints');
  const wins      = matches.filter(m => m.winner && m.winner !== 'Tie').length;
  const ties      = matches.filter(m => m.result === 'Tie').length;

  return {
    matches:         matches.length,
    wins,
    losses:          matches.length - wins - ties,
    ties,
    totalRuns,
    avgRunsPerMatch: matches.length
      ? Math.round(totalRuns / matches.length)
      : 0,
    totalWickets:    totalWkts,
    manOfSeries:     mvpBoard[0]
      ? { name: mvpBoard[0].player, points: mvpBoard[0].mvpTotal }
      : null,
  };
}

function getRecentMatches(sport, n = 5) {
  return getMatches(sport, {}).slice(0, n);
}

// ─── Carousel functions ───────────────────────────────────────────────────────

function getPlayerSpotlight(sport, playerName, season) {
  const filters  = season ? { season } : {};
  const stats    = getPlayerStats(sport, playerName, filters);
  if (!stats) return null;
  const mvpBoard  = getMVPLeaderboard(sport,     filters, 'totalPoints');
  const batBoard  = getBattingLeaderboard(sport, filters, 'runs');
  const bowlBoard = getBowlingLeaderboard(sport, filters, 'wickets');
  return {
    name:      playerName,
    season:    season || 'all',
    stats,
    mvpRank:   (mvpBoard.findIndex(p => p.player === playerName)  + 1) || null,
    batRank:   (batBoard.findIndex(p => p.player === playerName)  + 1) || null,
    bowlRank:  (bowlBoard.findIndex(p => p.player === playerName) + 1) || null,
  };
}

// ─── Scorecard function ───────────────────────────────────────────────────────

function getScorecard(sport, season, matchNum) {
  const { matches, players } = loadData(sport);

  const match = matches.find(m =>
    String(m.season)   === String(season) &&
    String(m.matchNum) === String(matchNum)
  );
  if (!match) return null;

  // Use innings data from matches JSON if available (has dismissals + FOW)
  if (match.innings && match.innings.length > 0) {

    // Get bowling data from players JSON (not in scorecard rows)
    const matchPlayers = players.filter(p =>
      String(p.season)   === String(season) &&
      String(p.matchNum) === String(matchNum)
    );

    const innings = match.innings.map(inn => {
      // Get bowlers from the opposing team's player records
      const bowlingTeam = matchPlayers.filter(p => p.team !== inn.team);
      const bowlers = bowlingTeam
        .filter(p => p.bowling && p.bowling.overs > 0)
        .sort((a, b) => (b.bowling.wickets || 0) - (a.bowling.wickets || 0))
        .map(p => ({
          player:  p.player,
          overs:   p.bowling.overs   || 0,
          maidens: p.bowling.maidens || 0,
          runs:    p.bowling.runs    || 0,
          wickets: p.bowling.wickets || 0,
          economy: p.bowling.economy || 0,
        }));

      // Get fielding from batting team's player records
      const battingTeamPlayers = matchPlayers.filter(p => p.team === inn.team);
      // Fielding contributions from the bowling team
      const fielding = bowlingTeam
        .filter(p =>
          (p.fielding?.catches       || 0) > 0 ||
          (p.fielding?.stumpings     || 0) > 0 ||
          (p.fielding?.directRunOuts || 0) > 0 ||
          (p.fielding?.comboRunOuts  || 0) > 0
        )
        .map(p => ({
          player:       p.player,
          catches:      p.fielding.catches       || 0,
          stumpings:    p.fielding.stumpings     || 0,
          directRunOut: p.fielding.directRunOuts || 0,
          comboRunOut:  p.fielding.comboRunOuts  || 0,
        }));

      // Enrich batters with SR calculated fresh
	  const batters = inn.batters.map(b => ({
        ...b,
        sr: b.balls > 0
          ? Math.round((b.runs / b.balls) * 1000) / 10
          : 0,
        notOut: b.dismissType === 'not out' ||
                b.dismissType === 'retired' ||
                b.dismissType === '',
      }));

      return {
        team:    inn.team,
        score:   inn.score,
        overs:   inn.overs,
        batters,
        bowlers,
        fielding,
        fow:     inn.fow || [],
      };
    });

    return { match, innings };
  }

  // Fallback: reconstruct from players JSON (older data without innings)
  const matchRows = players.filter(p =>
    String(p.season)   === String(season) &&
    String(p.matchNum) === String(matchNum)
  );

  const team1Rows = matchRows.filter(p => p.team === match.team1);
  const team2Rows = matchRows.filter(p => p.team === match.team2);

  function buildInnings(rows, battingTeam, bowlingTeamRows) {
    const batters = rows
      .filter(r => r.batting && !r.batting.dnb)
      .sort((a, b) => (a.batting.position || 99) - (b.batting.position || 99))
      .map(r => ({
        player:      r.player,
        runs:        r.batting.runs   || 0,
        balls:       r.batting.balls  || 0,
        fours:       r.batting.fours  || 0,
        sixes:       r.batting.sixes  || 0,
        sr:          r.batting.sr     || 0,
        notOut:      r.batting.notOut || false,
        dismissal:   r.batting.dismissalType || 'not out',
        dismissType: r.batting.dismissalType || '',
        fielder:     r.batting.fielder || '',
        bowler:      r.batting.dismissedBy || '',
      }));

    const bowlers = bowlingTeamRows
      .filter(r => r.bowling && r.bowling.overs > 0)
      .sort((a, b) => (b.bowling.wickets || 0) - (a.bowling.wickets || 0))
      .map(r => ({
        player:  r.player,
        overs:   r.bowling.overs   || 0,
        maidens: r.bowling.maidens || 0,
        runs:    r.bowling.runs    || 0,
        wickets: r.bowling.wickets || 0,
        economy: r.bowling.economy || 0,
      }));

    const fielding = bowlingTeamRows
      .filter(r =>
        (r.fielding?.catches       || 0) > 0 ||
        (r.fielding?.stumpings     || 0) > 0 ||
        (r.fielding?.directRunOuts || 0) > 0 ||
        (r.fielding?.comboRunOuts  || 0) > 0
      )
      .map(r => ({
        player:       r.player,
        catches:      r.fielding.catches       || 0,
        stumpings:    r.fielding.stumpings     || 0,
        directRunOut: r.fielding.directRunOuts || 0,
        comboRunOut:  r.fielding.comboRunOuts  || 0,
      }));

    return { team: battingTeam, batters, bowlers, fielding, fow: [] };
  }

  const team1BatFirst = match.batFirst === match.team1;
  const innings1 = team1BatFirst
    ? buildInnings(team1Rows, match.team1, team2Rows)
    : buildInnings(team2Rows, match.team2, team1Rows);
  const innings2 = team1BatFirst
    ? buildInnings(team2Rows, match.team2, team1Rows)
    : buildInnings(team1Rows, match.team1, team2Rows);

  return { match, innings: [innings1, innings2] };
}
// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  loadData,
  loadConfig,
  getMatches,
  getMatchById,
  getScorecard,
  getPointsTable,
  getPlayerList,
  getPlayerStats,
  getPlayerRecentForm,
  getBattingLeaderboard,
  getBowlingLeaderboard,
  getFieldingLeaderboard,
  getMVPLeaderboard,
  getPartnershipLeaderboard,
  comparePlayers,
  comparePlayerSeasons,
  getSeasonSnapshot,
  getRecentMatches,
  getPlayerSpotlight,
};