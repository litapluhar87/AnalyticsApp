import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');

const INSIGHTS = [
  (p, s) => `A consistent performer across ${s.matches} matches, contributing with bat, ball and in the field.`,
  (p, s) => `One of RACL's reliable all-rounders, ${p} brings energy and match-winning ability every game.`,
  (p, s) => `With ${s.runs} runs and ${s.wickets} wickets, ${p} is a genuine match-winner for the side.`,
  (p, s) => `${p} leads by example — always giving 100% whether batting, bowling or fielding.`,
  (p, s) => `A key contributor to RACL's success, ${p} has played ${s.matches} matches with distinction.`,
];

function getInsight(playerName, stats) {
  const idx = playerName.charCodeAt(0) % INSIGHTS.length;
  return INSIGHTS[idx](playerName, stats || { matches:0, runs:0, wickets:0 });
}

export default function Home() {
  const { sportType, season, format, navigateTo } = useApp();
  const sport = sportType.toLowerCase();

  const [snapshot,     setSnapshot]     = useState(null);
  const [playerList,   setPlayerList]   = useState([]);
  const [recentMatches,setRecentMatches]= useState([]);
  const [mvpBoard,     setMvpBoard]     = useState([]);
  const [slideIndex,   setSlideIndex]   = useState(0);
  const [playerStats,  setPlayerStats]  = useState({});
  const timerRef  = useRef(null);
  const touchStartX = useRef(null);

  const filters = {};
  if (season !== 'All') filters.season = season;
  if (format !== 'All') filters.format = format;

  useEffect(() => {
    try {
      const snap = engine.getSeasonSnapshot(
        sport,
        season !== 'All' ? season : undefined,
        format !== 'All' ? format : undefined
      );
      setSnapshot(snap);
    } catch(_) { setSnapshot(null); }

    try {
      const players = engine.getPlayerList(sport);
      setPlayerList(players);
      const statsMap = {};
      players.forEach(p => {
        try {
          statsMap[p] = engine.getPlayerStats(sport, p, filters);
        } catch(_) {}
      });
      setPlayerStats(statsMap);
    } catch(_) {}

    try {
      const allMatches = engine.getMatches(sport, filters);
      setRecentMatches(allMatches.slice(0, 2));
    } catch(_) { setRecentMatches([]); }

    try {
      setMvpBoard(engine.getMVPLeaderboard(sport, filters, 'totalPoints').slice(0, 5));
    } catch(_) { setMvpBoard([]); }

    setSlideIndex(0);
  }, [sport, season, format]);

  // Total slides = 1 group card + all players
  const totalSlides = 1 + playerList.length;

  // Auto-rotate
  useEffect(() => {
    clearTimeout(timerRef.current);
    const duration = slideIndex === 0 ? 7000 : 4000;
    timerRef.current = setTimeout(() => {
      setSlideIndex(i => (i + 1) % totalSlides);
    }, duration);
    return () => clearTimeout(timerRef.current);
  }, [slideIndex, totalSlides]);

  function goTo(i) {
    setSlideIndex((i + totalSlides) % totalSlides);
  }

  // Swipe handlers
  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      dx < 0 ? goTo(slideIndex + 1) : goTo(slideIndex - 1);
    }
    touchStartX.current = null;
  }

  const currentPlayer = slideIndex > 0 ? playerList[slideIndex - 1] : null;
  const currentStats  = currentPlayer ? playerStats[currentPlayer] : null;

  return (
    <div style={S.page}>

      {/* ── CAROUSEL ── */}
      <div
        style={S.carousel}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}>

        {slideIndex === 0 ? (
          /* Group card */
          <div style={S.slide}>
            <div style={S.groupAvatar}>RACL</div>
            <div style={S.groupName}>RACL</div>
            <div style={S.groupGrid}>
              <div style={S.groupStat}>
                <div style={S.groupStatN}>
                  {snapshot?.matches ?? '-'}
                </div>
                <div style={S.groupStatL}>Matches</div>
              </div>
              <div style={S.groupStat}>
                <div style={S.groupStatN}>
                  {snapshot?.totalRuns ?? '-'}
                </div>
                <div style={S.groupStatL}>Runs</div>
              </div>
              <div style={S.groupStat}>
                <div style={S.groupStatN}>
                  {snapshot?.totalWickets ?? '-'}
                </div>
                <div style={S.groupStatL}>Wickets</div>
              </div>
              <div style={S.groupStat}>
                <div style={S.groupStatN}>
                  {season !== 'All'
                    ? 1
                    : engine.loadConfig(sport).seasons?.length ?? '-'}
                </div>
                <div style={S.groupStatL}>Seasons</div>
              </div>
            </div>
          </div>
        ) : (
          /* Player card */
          <div style={S.slide}>
            <div style={S.playerAvatar}>
              {currentPlayer?.slice(0,2).toUpperCase()}
            </div>
            <div style={S.playerName}>{currentPlayer}</div>
            <div style={S.playerGrid}>
              <div style={S.playerStat}>
                <div style={S.playerStatN}>{currentStats?.matches ?? '-'}</div>
                <div style={S.playerStatL}>Matches</div>
              </div>
              <div style={S.playerStat}>
                <div style={S.playerStatN}>{currentStats?.runs ?? '-'}</div>
                <div style={S.playerStatL}>Runs</div>
              </div>
              <div style={S.playerStat}>
                <div style={S.playerStatN}>{currentStats?.wickets ?? '-'}</div>
                <div style={S.playerStatL}>Wickets</div>
              </div>
              <div style={S.playerStat}>
                <div style={S.playerStatN}>{currentStats?.mvpTotal ?? '-'}</div>
                <div style={S.playerStatL}>MVP Pts</div>
              </div>
            </div>
            <div style={S.insight}>
              {getInsight(currentPlayer, currentStats)}
            </div>
          </div>
        )}

        {/* Prev / Next arrows */}
        <button style={S.arrowL} onClick={() => goTo(slideIndex - 1)}>‹</button>
        <button style={S.arrowR} onClick={() => goTo(slideIndex + 1)}>›</button>

        {/* Dot indicators */}
        <div style={S.dots}>
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              onClick={() => goTo(i)}
              style={{
                ...S.dot,
                background: i === slideIndex
                  ? '#fff'
                  : 'rgba(255,255,255,0.35)',
                width: i === slideIndex ? 14 : 6,
              }}
            />
          ))}
        </div>
      </div>

      <div style={S.body}>
		<SeriesLeader sport={sport} filters={filters}/>
		
        {/* ── RECENT MATCHES ── */}
        <div style={S.secRow}>
          <div style={S.secLabel}>Recent matches</div>
        </div>

        {recentMatches.length === 0
          ? <Empty/>
          : recentMatches.map((m, i) => (
            <div
              key={i}
              style={S.matchTile}
              onClick={() => navigateTo('matches')}>
              <div style={S.matchTop}>
                <div style={S.matchBadge}>
                  S{m.season} · M{m.matchNum} · {m.ground}
                </div>
                <div style={S.matchDate}>
                  {m.date ? new Date(m.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : m.format}
                </div>
              </div>
              <div style={S.matchTeams}>
                <div style={S.matchTeam}>
                  <div style={{
                    ...S.matchTeamName,
                    fontWeight: m.winner === m.team1 ? 600 : 400,
                  }}>
                    {m.team1}
                  </div>
                  <div style={{
                    ...S.matchScore,
                    color: m.winner === m.team1 ? '#0C447C' : '#555',
                  }}>
                    {m.score1}
                  </div>
                </div>
                <div style={S.matchVs}>vs</div>
                <div style={{ ...S.matchTeam, alignItems:'flex-end' }}>
                  <div style={{
                    ...S.matchTeamName,
                    fontWeight: m.winner === m.team2 ? 600 : 400,
                  }}>
                    {m.team2}
                  </div>
                  <div style={{
                    ...S.matchScore,
                    color: m.winner === m.team2 ? '#0C447C' : '#555',
                  }}>
                    {m.score2}
                  </div>
                </div>
              </div>
              <div style={S.matchFoot}>
                {m.result} · MoM: <strong>{m.mom}</strong>
              </div>
            </div>
          ))}

        <button style={S.viewAll} onClick={() => navigateTo('matches')}>
          View all matches →
        </button>

        {/* ── MVP LEADERBOARD ── */}
        <div
          style={S.secRow}
          onClick={() => navigateTo('leaderboard')}
        >
          <div style={S.secLabel}>MVP</div>
          <div style={S.secLink}>See all →</div>
        </div>

        <div
          style={S.lbCard}
          onClick={() => navigateTo('leaderboard')}>
          {mvpBoard.length === 0
            ? <Empty/>
            : mvpBoard.map((p, i) => (
              <div key={i} style={S.lbRow}>
                <div style={{
                  ...S.lbRank,
                  color: i===0?'#BA7517': i===1?'#5F5E5A': i===2?'#854F0B':'#aaa',
                  fontWeight: i < 3 ? 600 : 400,
                }}>
                  {i + 1}
                </div>
                <div style={S.lbName}>{p.player}</div>
                <div style={S.lbRight}>
                  <div style={S.lbVal}>{p.mvpMomPerInn ?? p.mvpPerInning}</div>
                  <div style={S.lbSub}>per inn</div>
                </div>
              </div>
            ))}
        </div>

      </div>
    </div>
  );
}

function Empty() {
  return <div style={S.empty}>No data available</div>;
}

const CAROUSEL_BG = '#0C447C';

const S = {
  page: { paddingBottom: 16 },
  carousel: {
    position: 'relative',
    background: `linear-gradient(160deg, #0C447C 0%, #185FA5 100%)`,
    padding: '20px 48px 36px',
    textAlign: 'center',
    userSelect: 'none',
  },
  slide: { minHeight: 160 },

  // Group card
  groupAvatar: {
    width: 64, height: 64, borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    border: '2px solid rgba(255,255,255,0.4)',
    margin: '0 auto 8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 700, color: '#fff',
    letterSpacing: 1,
  },
  groupName: {
    fontSize: 20, fontWeight: 600, color: '#fff',
    marginBottom: 14, letterSpacing: 1,
  },
  groupGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8,
  },
  groupStat: {
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '8px 4px',
  },
  groupStatN: { fontSize: 17, fontWeight: 600, color: '#fff' },
  groupStatL: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Player card
  playerAvatar: {
    width: 72, height: 72, borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    border: '2px solid rgba(255,255,255,0.4)',
    margin: '0 auto 8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, fontWeight: 600, color: '#fff',
  },
  playerName: {
    fontSize: 22, fontWeight: 600, color: '#fff',
    marginBottom: 12,
  },
  playerGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8,
    marginBottom: 12,
  },
  playerStat: {
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '8px 4px',
  },
  playerStatN: { fontSize: 16, fontWeight: 600, color: '#fff' },
  playerStatL: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  insight: {
    fontSize: 12, color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.5, fontStyle: 'italic',
    padding: '0 4px',
  },

  // Arrows
  arrowL: {
    position: 'absolute', left: 8, top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.15)',
    border: 'none', color: '#fff',
    fontSize: 22, width: 32, height: 32,
    borderRadius: '50%', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  },
  arrowR: {
    position: 'absolute', right: 8, top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.15)',
    border: 'none', color: '#fff',
    fontSize: 22, width: 32, height: 32,
    borderRadius: '50%', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  },

  // Dots
  dots: {
    position: 'absolute', bottom: 10,
    left: '50%', transform: 'translateX(-50%)',
    display: 'flex', gap: 5, alignItems: 'center',
  },
  dot: {
    height: 6, borderRadius: 3,
    cursor: 'pointer',
    transition: 'all 0.3s',
  },

  // Body
  body: { padding: '12px 12px 0' },
  secRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
    cursor: 'pointer',
  },
  secLabel: {
    fontSize: 11, fontWeight: 500,
    color: '#888', letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  secLink: { fontSize: 12, color: '#0C447C' },

  // Match tiles
  matchTile: {
    background: '#fff', borderRadius: 10,
    border: '0.5px solid #eee', padding: '12px 14px',
    marginBottom: 8, cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  matchTop: {
    display: 'flex', justifyContent: 'space-between',
    marginBottom: 8,
  },
  matchBadge: {
    fontSize: 10, background: '#E6F1FB',
    color: '#0C447C', padding: '2px 8px',
    borderRadius: 8, fontWeight: 500,
  },
  matchDate: { fontSize: 10, color: '#aaa' },
  matchTeams: {
    display: 'flex', alignItems: 'flex-start', gap: 6,
  },
  matchTeam: { flex: 1, display: 'flex', flexDirection: 'column' },
  matchTeamName: { fontSize: 12, color: '#222' },
  matchScore: { fontSize: 16, fontWeight: 600, marginTop: 2 },
  matchVs: {
    fontSize: 11, color: '#ccc',
    paddingTop: 14, flexShrink: 0,
  },
  matchFoot: {
    fontSize: 11, color: '#aaa',
    marginTop: 8, paddingTop: 6,
    borderTop: '0.5px solid #f5f5f5',
  },
  viewAll: {
    display: 'block', width: '100%',
    padding: '9px', borderRadius: 10,
    border: '0.5px solid #B5D4F4',
    background: '#E6F1FB', color: '#0C447C',
    fontSize: 12, fontWeight: 500,
    cursor: 'pointer', marginBottom: 16,
    textAlign: 'center',
  },

  // MVP leaderboard
  lbCard: {
    background: '#fff', borderRadius: 10,
    border: '0.5px solid #eee', overflow: 'hidden',
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  lbRow: {
    display: 'flex', alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '0.5px solid #f5f5f5',
  },
  lbRank: { width: 20, fontSize: 12, flexShrink: 0 },
  lbName: { flex: 1, fontSize: 13, fontWeight: 500, color: '#222' },
  lbRight: { textAlign: 'right' },
  lbVal:  { fontSize: 13, fontWeight: 500, color: '#222' },
  lbSub:  { fontSize: 10, color: '#aaa', marginTop: 1 },

  empty: {
    textAlign: 'center', padding: '20px 0',
    fontSize: 13, color: '#ccc',
  },
}
function SeriesLeader({ sport, filters }) {
  const [leader, setLeader] = React.useState(null);

  React.useEffect(() => {
    try {
      // Get most recent match to determine current season/format
      const matches = engine.getMatches(sport, filters);
      if (!matches.length) { setLeader(null); return; }

      // Use filters or derive from most recent match
      const recentMatch = matches[0];
      const activeFilters = { ...filters };
      if (!activeFilters.season) activeFilters.season = recentMatch.season;
      if (!activeFilters.format && recentMatch.format !== 'All') {
        activeFilters.format = recentMatch.format;
      }

      const table = engine.getPointsTable(sport, activeFilters);
      if (!table.length) { setLeader(null); return; }

      const top = table[0];
      const second = table[1];
      if (!second) { setLeader(null); return; }

      setLeader({
        team1:  top.team,
        wins1:  top.won,
        team2:  second.team,
        wins2:  second.won,
        season: activeFilters.season,
        format: activeFilters.format,
      });
    } catch(_) { setLeader(null); }
  }, [sport, JSON.stringify(filters)]);

  if (!leader) return null;

  const margin = leader.wins1 - leader.wins2;
  const tied   = margin === 0;

  return (
    <div style={SL.box}>
      <div style={SL.label}>Series standing</div>
      <div style={SL.row}>
        <div style={SL.team1}>
          <div style={SL.tname}>{leader.team1}</div>
          <div style={SL.score}>{leader.wins1}</div>
        </div>
        <div style={SL.vs}>
          {tied ? 'Tied' : `leads by ${margin}`}
        </div>
        <div style={SL.team2}>
          <div style={SL.tname}>{leader.team2}</div>
          <div style={SL.score}>{leader.wins2}</div>
        </div>
      </div>
    </div>
  );
}

const SL = {
  box: {
    background: '#fff',
    borderRadius: 10,
    border: '0.5px solid #eee',
    padding: '10px 14px',
    marginBottom: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  label: {
    fontSize: 10, fontWeight: 500, color: '#aaa',
    letterSpacing: 0.7, textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    display: 'flex', alignItems: 'center',
  },
  team1: { flex: 1 },
  team2: { flex: 1, textAlign: 'right' },
  tname: { fontSize: 12, fontWeight: 500, color: '#222' },
  score: { fontSize: 22, fontWeight: 600, color: '#0C447C', marginTop: 2 },
  vs: {
    fontSize: 11, color: '#aaa',
    padding: '0 10px', textAlign: 'center',
    flexShrink: 0,
  },
};
