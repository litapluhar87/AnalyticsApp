import React, { useState, useEffect } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');

const ACCENT = '#0C447C';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initials(name) {
  return (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function aiInsight(runs, wickets, mvpTotal) {
  if (runs > 300 && wickets > 8)
    return `Known for match-winning batting and lethal bowling, one of RACL's most complete players`;
  if (runs > 200)
    return `Known for consistent run-scoring and big-match temperament, one of RACL's most reliable batters`;
  if (wickets > 8)
    return `Known for sharp lines and game-changing wickets, one of RACL's most dangerous bowlers`;
  if (mvpTotal > 100)
    return `Known for all-round contributions and clutch performances, one of RACL's most valuable players`;
  if (wickets > 4)
    return `Known for taking key wickets and controlling the game, one of RACL's most effective bowlers`;
  return `Known for competitive spirit and team contributions, one of RACL's most dedicated players`;
}

export default function Home() {
  const { sportType, format, season, navigateTo } = useApp();
  const sport = sportType.toLowerCase();

  const [snapshot, setSnapshot]     = useState(null);
  const [spotlights, setSpotlights] = useState([]);
  const [recentMatches, setRecent]  = useState([]);
  const [mvpBoard, setMvpBoard]     = useState([]);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    try {
      setSnapshot(engine.getSeasonSnapshot(sport, season, format) || null);
    } catch (_) { setSnapshot(null); }

    try {
      const players = engine.getPlayerList(sport) || [];
      const spots = shuffle(players)
        .map(p => {
          try { return engine.getPlayerSpotlight(sport, p, season); }
          catch (_) { return null; }
        })
        .filter(Boolean);
      setSpotlights(spots);
    } catch (_) { setSpotlights([]); }

    try {
      setRecent(engine.getRecentMatches(sport, 2) || []);
    } catch (_) { setRecent([]); }

    try {
      const filters = {};
      if (season) filters.season = season;
      if (format && format !== 'All') filters.format = format;
      setMvpBoard((engine.getMVPLeaderboard(sport, filters) || []).slice(0, 5));
    } catch (_) { setMvpBoard([]); }

    setSlideIndex(0);
  }, [sport, season, format]);

  const totalSlides = 1 + spotlights.length;

  useEffect(() => {
    if (totalSlides < 2) return;
    const ms = slideIndex === 0 ? 7000 : 4000;
    const t = setTimeout(() => setSlideIndex(i => (i + 1) % totalSlides), ms);
    return () => clearTimeout(t);
  }, [slideIndex, totalSlides]);

  return (
    <div style={S.page}>

      {/* ── CAROUSEL ── */}
      <div style={S.carouselWrap}>
        {slideIndex === 0
          ? <GroupCard snapshot={snapshot} />
          : <PlayerCard spotlight={spotlights[slideIndex - 1]} />}
        <div style={S.dots}>
          {Array.from({ length: Math.min(totalSlides, 20) }).map((_, i) => (
            <button
              key={i}
              onClick={() => setSlideIndex(i)}
              style={{ ...S.dot, background: i === slideIndex ? ACCENT : '#d0d0d0' }}
            />
          ))}
        </div>
      </div>

      {/* ── RECENT MATCHES ── */}
      <Section
        title="Recent Matches"
        linkLabel="View all matches →"
        onLink={() => navigateTo('matches')}
      >
        {recentMatches.length === 0
          ? <Empty />
          : recentMatches.map((m, i) => <MatchTile key={i} match={m} />)}
      </Section>

      {/* ── MVP LEADERBOARD PREVIEW ── */}
      <Section
        title="MVP Leaderboard"
        linkLabel="See full leaderboard →"
        onLink={() => navigateTo('leaderboard')}
      >
        {mvpBoard.length === 0 ? <Empty /> : (
          <div style={S.card}>
            <div style={{ ...S.ldrRow, borderBottom: '0.5px solid #ebebeb' }}>
              <span style={{ ...S.ldrRank, color: '#bbb', fontSize: 11 }}>#</span>
              <span style={{ ...S.ldrName, color: '#bbb', fontSize: 11 }}>Player</span>
              <span style={{ ...S.ldrStat, color: '#bbb', fontSize: 11 }}>MVP</span>
              <span style={{ ...S.ldrStat, color: '#bbb', fontSize: 11 }}>Per Inn</span>
            </div>
            {mvpBoard.map((row, i) => (
              <div
                key={i}
                style={{ ...S.ldrRow, borderTop: i > 0 ? '0.5px solid #f4f4f4' : 'none' }}
              >
                <span style={S.ldrRank}>{i + 1}</span>
                <span style={S.ldrName}>{row.player}</span>
                <span style={{ ...S.ldrStat, fontWeight: 600, color: ACCENT }}>
                  {typeof row.mvpTotal === 'number' ? row.mvpTotal.toFixed(1) : (row.mvpTotal ?? '-')}
                </span>
                <span style={S.ldrStat}>
                  {typeof row.mvpPerInning === 'number' ? row.mvpPerInning.toFixed(1) : '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

    </div>
  );
}

function GroupCard({ snapshot: s }) {
  const bg = `linear-gradient(135deg, ${ACCENT} 0%, #1a6bb5 100%)`;
  if (!s) {
    return (
      <div style={{ ...S.carouselCard, background: bg }}>
        <Empty light />
      </div>
    );
  }
  const mosName = s.manOfSeries?.name ?? null;
  return (
    <div style={{ ...S.carouselCard, background: bg }}>
      <div style={S.eyebrow}>RACL · Season Snapshot</div>
      <div style={S.carouselHeading}>RACL Cricket</div>
      <div style={S.snapGrid}>
        {[
          { val: s.matches   ?? '-', lbl: 'Matches' },
          { val: s.wins      ?? '-', lbl: 'Wins'    },
          { val: s.losses    ?? '-', lbl: 'Losses'  },
          { val: s.totalRuns ?? '-', lbl: 'Runs'    },
        ].map(({ val, lbl }) => (
          <div key={lbl} style={S.snapCell}>
            <div style={S.snapVal}>{val}</div>
            <div style={S.snapLbl}>{lbl}</div>
          </div>
        ))}
      </div>
      {mosName && (
        <div style={S.mosBadge}>
          <span style={S.mosLabel}>Most of Season</span>
          <span style={S.mosName}>{mosName}</span>
        </div>
      )}
    </div>
  );
}

function PlayerCard({ spotlight: s }) {
  if (!s) return null;
  const name     = s.name || '';
  const st       = s.stats || {};
  const runs     = st.runs     ?? 0;
  const wickets  = st.wickets  ?? 0;
  const mvpTotal = st.mvpTotal ?? 0;

  return (
    <div style={{ ...S.carouselCard, background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5986 100%)' }}>
      <div style={S.playerTop}>
        <div style={S.avatarCircle}>{initials(name)}</div>
        <div>
          <div style={S.playerName}>{name}</div>
          <div style={S.playerSub}>RACL Player</div>
        </div>
      </div>
      <div style={S.statRow}>
        {[
          { val: runs,    lbl: 'Runs'    },
          { val: wickets, lbl: 'Wickets' },
          { val: typeof mvpTotal === 'number' ? Math.round(mvpTotal) : mvpTotal, lbl: 'MVP Pts', gold: true },
        ].map(({ val, lbl, gold }) => (
          <div key={lbl} style={S.statBox}>
            <div style={{ ...S.statVal, ...(gold ? { color: '#FFD700' } : {}) }}>{val}</div>
            <div style={S.statLbl}>{lbl}</div>
          </div>
        ))}
      </div>
      <div style={S.insight}>{aiInsight(runs, wickets, mvpTotal)}</div>
    </div>
  );
}

function Section({ title, linkLabel, onLink, children }) {
  return (
    <div style={S.section}>
      <div style={S.secHeader}>
        <span style={S.secTitle}>{title}</span>
        <button style={S.linkBtn} onClick={onLink}>{linkLabel}</button>
      </div>
      {children}
    </div>
  );
}

function MatchTile({ match: m }) {
  const t1Won = m.winner && m.winner === m.team1;
  const t2Won = m.winner && m.winner === m.team2;
  const result = typeof m.result === 'string' ? m.result : (m.result?.text || '');
  return (
    <div style={S.matchTile}>
      <div style={S.matchRow}>
        <div style={S.matchTeam}>
          <div style={{ ...S.teamLabel, fontWeight: t1Won ? 700 : 400, color: t1Won ? ACCENT : '#333' }}>
            {m.team1}
          </div>
          <div style={S.matchScore}>{m.score1 || '-'}</div>
        </div>
        <div style={S.vsCol}>vs</div>
        <div style={{ ...S.matchTeam, alignItems: 'flex-end' }}>
          <div style={{ ...S.teamLabel, fontWeight: t2Won ? 700 : 400, color: t2Won ? ACCENT : '#333' }}>
            {m.team2}
          </div>
          <div style={S.matchScore}>{m.score2 || '-'}</div>
        </div>
      </div>
      {result && <div style={S.resultText}>{result}</div>}
      {m.mom  && <div style={S.momText}>MoM: {m.mom}</div>}
    </div>
  );
}

function Empty({ light }) {
  return (
    <div style={{ ...S.empty, color: light ? 'rgba(255,255,255,0.45)' : '#c0c0c0' }}>
      No data available
    </div>
  );
}

const S = {
  page:            { paddingTop: 8 },
  carouselWrap:    { marginBottom: 6 },
  carouselCard: {
    margin: '0 12px',
    borderRadius: 14,
    padding: '18px 16px',
    minHeight: 180,
  },
  eyebrow:         { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 },
  carouselHeading: { color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 14 },
  snapGrid:        { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 },
  snapCell:        { textAlign: 'center' },
  snapVal:         { color: '#fff', fontSize: 20, fontWeight: 700 },
  snapLbl:         { color: 'rgba(255,255,255,0.58)', fontSize: 10, marginTop: 2 },
  mosBadge: {
    marginTop: 12,
    background: 'rgba(255,255,255,0.14)',
    borderRadius: 8,
    padding: '7px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  mosLabel:        { color: 'rgba(255,255,255,0.62)', fontSize: 11 },
  mosName:         { color: '#fff', fontSize: 13, fontWeight: 600 },
  playerTop:       { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.17)',
    border: '2px solid rgba(255,255,255,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  },
  playerName:      { color: '#fff', fontSize: 18, fontWeight: 700 },
  playerSub:       { color: 'rgba(255,255,255,0.52)', fontSize: 11 },
  statRow:         { display: 'flex', gap: 8, marginBottom: 12 },
  statBox: {
    flex: 1,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '8px 4px',
    textAlign: 'center',
  },
  statVal:         { color: '#fff', fontSize: 19, fontWeight: 700 },
  statLbl:         { color: 'rgba(255,255,255,0.52)', fontSize: 10, marginTop: 2 },
  insight:         { color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 1.55, fontStyle: 'italic' },
  dots:            { display: 'flex', justifyContent: 'center', gap: 5, padding: '8px 0 2px' },
  dot:             { width: 7, height: 7, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 },
  section:         { padding: '2px 12px 12px' },
  secHeader:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 8px' },
  secTitle:        { fontSize: 15, fontWeight: 600, color: '#111' },
  linkBtn: {
    background: 'none',
    border: 'none',
    fontSize: 12,
    color: ACCENT,
    cursor: 'pointer',
    padding: 0,
    fontWeight: 500,
  },
  card: {
    background: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  matchTile: {
    background: '#fff',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 8,
    minHeight: 80,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  matchRow:        { display: 'flex', alignItems: 'flex-start' },
  matchTeam:       { flex: 1, display: 'flex', flexDirection: 'column' },
  teamLabel:       { fontSize: 13 },
  matchScore:      { fontSize: 16, fontWeight: 600, color: '#111', marginTop: 3 },
  vsCol:           { color: '#c0c0c0', fontSize: 12, alignSelf: 'center', padding: '0 10px' },
  resultText:      { marginTop: 7, fontSize: 11, color: '#666' },
  momText:         { marginTop: 2, fontSize: 11, color: '#999' },
  ldrRow:          { display: 'flex', alignItems: 'center', padding: '10px 14px' },
  ldrRank:         { width: 22, fontSize: 13, color: '#888' },
  ldrName:         { flex: 1, fontSize: 13, color: '#222' },
  ldrStat:         { width: 64, textAlign: 'right', fontSize: 13, color: '#555' },
  empty:           { textAlign: 'center', padding: '20px 0', fontSize: 13 },
};
