// src/auth/getDefaultSport.js
// Determines default sport for a player by reading latest match dates
// from match data files — no hardcoding needed, auto-updates each season.

const boxMatches     = require('../data/json/box_matches.json');
const classicMatches = require('../data/json/classic_matches.json');

// Find the latest match date across all matches in a format
function getLatestDate(matches) {
  const dates = matches.map(m => m.date).filter(Boolean);
  if (!dates.length) return null;
  return dates.reduce((a, b) => (a > b ? a : b));
}

// Collect all player names who appeared in any match (batting or bowling)
function getPlayersInMatches(matches) {
  const players = new Set();
  matches.forEach(match => {
    (match.innings || []).forEach(innings => {
      (innings.batters || []).forEach(b => b.player && players.add(b.player));
      (innings.bowlers || []).forEach(b => b.player && players.add(b.player));
    });
  });
  return players;
}

const BOX_PLAYERS     = getPlayersInMatches(boxMatches);
const CLASSIC_PLAYERS = getPlayersInMatches(classicMatches);

const BOX_LATEST     = getLatestDate(boxMatches);     // e.g. "2026-05-10"
const CLASSIC_LATEST = getLatestDate(classicMatches); // e.g. "2026-01-11"

export function getDefaultSport(playerName) {
  const inBox     = BOX_PLAYERS.has(playerName);
  const inClassic = CLASSIC_PLAYERS.has(playerName);

  if (inBox && inClassic) {
    // Both formats — pick whichever had the most recent match overall
    return BOX_LATEST >= CLASSIC_LATEST ? 'Box' : 'Classic';
  }
  if (inBox)     return 'Box';
  if (inClassic) return 'Classic';
  return 'Box'; // fallback for brand new players not yet in any match
}