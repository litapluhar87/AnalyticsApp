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
    if (filters.batInning      && String(p.inning) !== String(filters.batInning))           return false;
    if (filters.battingPosition && String(p.batting?.position) !== String(filters.battingPosition)) return false;
    if (filters.winLoss === 'Win'  && !p.won)  return false;
    if (filters.winLoss === 'Loss' &&  p.won)  return false;
    return true;
  });
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function aggregatePlayerStats(rows, config) {
  if (!rows.length) return null;
  const name = rows[0].player;

  // Only count batting innings where player actually batted
  const batRows  = rows.filter(r => r.batting && !r.batting.dnb);
  const bowlRows = rows.filter(r => r.bowling && r.bowling.overs > 0);

  const runs        = batRows.reduce((s, r)  => s + (r.batting.runs   || 0), 0);
  const balls       = batRows.reduce((s, r)  => s + (r.batting.balls  || 0), 0);
  const fours       = batRows.reduce((s, r)  => s + (r.batting.fours  || 0), 0);
  const sixes       = batRows.reduce((s, r)  => s + (r.batting.sixes  || 0), 0);
  const notOuts     = batRows.filter(r => r.batting.notOut || r.batting.retired).length;
  const highScore   = batRows.length ? Math.max(...batRows.map(r => r.batting.runs || 0)) : 0;
  const highScoreNO = batRows.find(r => (r.batting.runs || 0) === highScore)?.batting?.notOut || false;

  const wickets     = bowlRows.reduce((s, r) => s + (r.bowling.wickets || 0), 0);
  const overs       = bowlRows.reduce((s, r) => s + (r.bowling.oversDcml || r.bowling.overs || 0), 0);
  const runsCon     = bowlRows.reduce((s, r) => s + (r.bowling.runs    || 0), 0);
  const maidens     = bowlRows.reduce((s, r) => s + (r.bowling.maidens || 0), 0);

  const catches     = rows.reduce((s, r) => s + (r.fielding?.catches      || 0), 0);
  const stumpings   = rows.reduce((s, r) => s + (r.fielding?.stumpings    || 0), 0);
  const roDirects   = rows.reduce((s, r) => s + (r.fielding?.directRunOuts|| 0), 0);
  const roCombos    = rows.reduce((s, r) => s + (r.fielding?.comboRunOuts || 0), 0);
  const momCount    = rows.filter(r => r.isManOfMatch).length;

  // Read pre-calculated MVP from migration output
  const mvpBat   = rows.reduce((s, r) => s + (r.mvp?.bat   || 0), 0);
  const mvpBowl  = rows.reduce((s, r) => s + (r.mvp?.bowl  || 0), 0);
  const mvpField = rows.reduce((s, r) => s + (r.mvp?.field || 0), 0);
  const mvpTotal = rows.reduce((s, r) => s + (r.mvp?.total || 0), 0);

  const innings  = batRows.length;
  const outs     = innings - notOuts;
  const matches  = new Set(rows.map(r => r.seasonMatch || `${r.season}-${r.matchNum}`)).size;

  return {
    player:        name,
    matches,
    innings,
    runs,
    balls,
    fours,
    sixes,
    notOuts,
    highScore:     highScoreNO ? `${highScore}*` : `${highScore}`,
    wickets,
    oversBowled:   Math.round(overs * 10) / 10,
    runsConceded:  runsCon,
    maidens,
    catches,
    stumpings,
    runOutsDirect: roDirects,
    runOutsCombo:  roCombos,
    totalFielding: catches + stumpings + roDirects + roCombos,
    momCount,
    mvpBat:        Math.round(mvpBat   * 10) / 10,
    mvpBowl:       Math.round(mvpBowl  * 10) / 10,
    mvpField:      Math.round(mvpField * 10) / 10,
    mvpTotal:      Math.round(mvpTotal * 10) / 10,
    mvpPerInning:  innings > 0 ? Math.round((mvpTotal / innings) * 10) / 10 : 0,
    average:       outs > 0 ? Math.round((runs / outs) * 10) / 10 : runs,
    strikeRate:    balls > 0 ? Math.round((runs / balls) * 1000) / 10 : 0,
    economy:       overs > 0 ? Math.round((runsCon / overs) * 10) / 10 : 0,
    bowlingAvg:    wickets > 0 ? Math.round((runsCon / wickets) * 10) / 10 : null,
  };
}

// ─── Match functions ──────────────────────────────────────────────────────────

function getMatches(sport, filters = {}) {
  const { matches } = loadData(sport);
  return filterMatches(matches, filters)
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
      String(m.season) === String(r.season) &&
      String(m.matchNum) === String(r.matchNum)
    );
    return {
      season:    r.season,
      matchNum:  r.matchNum,
      format:    r.format,
      ground:    r.ground,
      runs:      r.batting?.runs    || 0,
      balls:     r.batting?.balls   || 0,
      notOut:    r.batting?.notOut  || false,
      wickets:   r.bowling?.wickets || 0,
      overs:     r.bowling?.overs   || 0,
      economy:   r.bowling?.economy || 0,
      mom:       r.isManOfMatch     || false,
      won:       r.won              || false,
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
  const { players, matches } = loadData(sport);

  const match = matches.find(m =>
    String(m.season)   === String(season) &&
    String(m.matchNum) === String(matchNum)
  );
  if (!match) return null;

  // Get all player rows for this match
  const matchRows = players.filter(p =>
    String(p.season)   === String(season) &&
    String(p.matchNum) === String(matchNum)
  );

  // Split into two teams
  const team1Rows = matchRows.filter(p => p.team === match.team1);
  const team2Rows = matchRows.filter(p => p.team === match.team2);

  function buildInnings(rows, battingTeam, bowlingTeam) {
    // Batting — rows where this team batted
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
        dismissal:   r.batting.dismissalType || '',
        dismissedBy: r.batting.dismissedBy   || '',
      }));

    // Bowling — get bowling figures from opposition rows
    const allRows = matchRows.filter(p => p.team === bowlingTeam);
    const bowlers = allRows
      .filter(r => r.bowling && r.bowling.overs > 0)
      .sort((a, b) => (b.bowling.wickets || 0) - (a.bowling.wickets || 0))
      .map(r => ({
        player:  r.player,
        overs:   r.bowling.overs   || 0,
        runs:    r.bowling.runs    || 0,
        wickets: r.bowling.wickets || 0,
        economy: r.bowling.economy || 0,
        maidens: r.bowling.maidens || 0,
      }));

    // Fielding — from opposition rows
    const fielding = allRows
      .filter(r =>
        (r.fielding?.catches       || 0) > 0 ||
        (r.fielding?.stumpings     || 0) > 0 ||
        (r.fielding?.directRunOuts || 0) > 0 ||
        (r.fielding?.comboRunOuts  || 0) > 0
      )
      .map(r => ({
        player:      r.player,
        catches:     r.fielding.catches       || 0,
        stumpings:   r.fielding.stumpings     || 0,
        directRunOut:r.fielding.directRunOuts || 0,
        comboRunOut: r.fielding.comboRunOuts  || 0,
      }));

    return { team: battingTeam, batters, bowlers, fielding };
  }

  // Determine batting order from batFirst field
  const team1BatFirst = match.batFirst === match.team1;

  const innings1 = team1BatFirst
    ? buildInnings(team1Rows, match.team1, match.team2)
    : buildInnings(team2Rows, match.team2, match.team1);

  const innings2 = team1BatFirst
    ? buildInnings(team2Rows, match.team2, match.team1)
    : buildInnings(team1Rows, match.team1, match.team2);

  return {
    match,
    innings: [innings1, innings2],
  };
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