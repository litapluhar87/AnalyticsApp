// src/engine/awardsEngine.js
// Centralized awards data — MoS, Orange Cap, Purple Cap
// MoM is computed from match data, not stored here

const awards = require('../config/awards.config.json');

// ─── Key builder ──────────────────────────────────────────────────────────────

function makeKey(season, format) {
  return `${season}-${format}`;
}

// ─── MoS ─────────────────────────────────────────────────────────────────────

function getMoS(sport, season, format) {
  return awards.mos?.[sport]?.[makeKey(season, format)] || null;
}

function getAllMoS(sport) {
  const entries = awards.mos?.[sport] || {};
  return Object.entries(entries).map(([key, player]) => {
    const [season, format] = key.split('-');
    return { season: Number(season), format, player };
  }).sort((a,b) => a.season - b.season);
}

function getMoSCount(sport, playerName, filterSeason, filterFormat) {
  const entries = awards.mos?.[sport] || {};
  return Object.entries(entries).filter(([key, player]) => {
    if (player !== playerName) return false;
    if (filterSeason && filterFormat) {
      return key === makeKey(filterSeason, filterFormat);
    }
    if (filterSeason) return key.startsWith(`${filterSeason}-`);
    return true;
  }).length;
}

// ─── Orange Cap ───────────────────────────────────────────────────────────────

function getOrangeCap(sport, season, format) {
  return awards.orangeCap?.[sport]?.[makeKey(season, format)] || null;
}

function getAllOrangeCaps(sport) {
  const entries = awards.orangeCap?.[sport] || {};
  return Object.entries(entries).map(([key, player]) => {
    const [season, format] = key.split('-');
    return { season: Number(season), format, player };
  }).sort((a,b) => a.season - b.season);
}

function getOrangeCapCount(sport, playerName) {
  const entries = awards.orangeCap?.[sport] || {};
  return Object.values(entries).filter(p => p === playerName).length;
}

// ─── Purple Cap ───────────────────────────────────────────────────────────────

function getPurpleCap(sport, season, format) {
  return awards.purpleCap?.[sport]?.[makeKey(season, format)] || null;
}

function getAllPurpleCaps(sport) {
  const entries = awards.purpleCap?.[sport] || {};
  return Object.entries(entries).map(([key, player]) => {
    const [season, format] = key.split('-');
    return { season: Number(season), format, player };
  }).sort((a,b) => a.season - b.season);
}

function getPurpleCapCount(sport, playerName) {
  const entries = awards.purpleCap?.[sport] || {};
  return Object.values(entries).filter(p => p === playerName).length;
}

// ─── Combined player awards ───────────────────────────────────────────────────

function getPlayerAwards(sport, playerName, season, format) {
  const mos        = season && format ? getMoS(sport, season, format) === playerName
                   : getAllMoS(sport).some(a => a.player === playerName);
  const orangeCap  = season && format ? getOrangeCap(sport, season, format) === playerName
                   : getAllOrangeCaps(sport).some(a => a.player === playerName);
  const purpleCap  = season && format ? getPurpleCap(sport, season, format) === playerName
                   : getAllPurpleCaps(sport).some(a => a.player === playerName);
  return { mos, orangeCap, purpleCap };
}

function getPlayerAwardCounts(sport, playerName) {
  return {
    mosCount:        getMoSCount(sport, playerName),
    orangeCapCount:  getOrangeCapCount(sport, playerName),
    purpleCapCount:  getPurpleCapCount(sport, playerName),
  };
}

// ─── Season awards summary ────────────────────────────────────────────────────

function getSeasonAwards(sport, season, format) {
  return {
    mos:       getMoS(sport, season, format),
    orangeCap: getOrangeCap(sport, season, format),
    purpleCap: getPurpleCap(sport, season, format),
  };
}

// ─── All awards for display in Settings ──────────────────────────────────────

function getAllAwards(sport) {
  const seasons = new Set([
    ...Object.keys(awards.mos?.[sport]       || {}),
    ...Object.keys(awards.orangeCap?.[sport] || {}),
    ...Object.keys(awards.purpleCap?.[sport] || {}),
  ]);

  return [...seasons].sort().map(key => {
    const [season, format] = key.split('-');
    return {
      key,
      season:    Number(season),
      format,
      mos:       awards.mos?.[sport]?.[key]        || null,
      orangeCap: awards.orangeCap?.[sport]?.[key]  || null,
      purpleCap: awards.purpleCap?.[sport]?.[key]  || null,
    };
  });
}

module.exports = {
  getMoS,
  getAllMoS,
  getMoSCount,
  getOrangeCap,
  getAllOrangeCaps,
  getOrangeCapCount,
  getPurpleCap,
  getAllPurpleCaps,
  getPurpleCapCount,
  getPlayerAwards,
  getPlayerAwardCounts,
  getSeasonAwards,
  getAllAwards,
};