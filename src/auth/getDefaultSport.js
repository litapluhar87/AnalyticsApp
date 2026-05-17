const boxConfig     = require('../config/box.config.json');
const classicConfig = require('../config/classic.config.json');

const BOX_PLAYERS     = new Set(boxConfig.players     || []);
const CLASSIC_PLAYERS = new Set(classicConfig.players || []);

export function getDefaultSport(playerName) {
  const inBox     = BOX_PLAYERS.has(playerName);
  const inClassic = CLASSIC_PLAYERS.has(playerName);

  if (inBox && inClassic) return 'Box';
  if (inBox)              return 'Box';
  if (inClassic)          return 'Classic';
  return 'Box';
}