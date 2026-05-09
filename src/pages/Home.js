import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../App';

const engine       = require('../engine/statsEngine');
const awardsEngine = require('../engine/awardsEngine');

export default function Home() {
  const { sportType, season, format, navigateTo } = useApp();
  const sport = sportType.toLowerCase();

  const [snapshot,      setSnapshot]      = useState(null);
  const [carouselItems, setCarouselItems] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [mvpBoard,      setMvpBoard]      = useState([]);
  const [slideIndex,    setSlideIndex]    = useState(0);
  const timerRef    = useRef(null);
  const touchStartX = useRef(null);

  const filters = {};
  if (season !== 'All') filters.season = season;
  if (format !== 'All') filters.format = format;

  useEffect(() => {
    // Snapshot
    try {
      setSnapshot(engine.getSeasonSnapshot(
        sport,
        season !== 'All' ? season : undefined,
        format !== 'All' ? format : undefined
      ));
    } catch(_) { setSnapshot(null); }

    // Recent matches
    try {
      setRecentMatches(engine.getMatches(sport, filters).slice(0, 2));
    } catch(_) { setRecentMatches([]); }

    // MVP leaderboard
    try {
      const mvp = engine.getMVPLeaderboardEnhanced
        ? engine.getMVPLeaderboardEnhanced(sport, filters, 'totalPoints')
        : engine.getMVPLeaderboard(sport, filters, 'totalPoints');
      const flat = mvp?.group1
        ? [...(mvp.group1||[]), ...(mvp.group2||[])]
        : (Array.isArray(mvp) ? mvp : []);
      setMvpBoard(flat.slice(0, 5));
    } catch(_) { setMvpBoard([]); }

    // Build carousel
    buildCarousel();
    setSlideIndex(0);
  }, [sport, season, format]);

  function buildCarousel() {
    try {
      const allMatches = engine.getMatches(sport, filters);
      const totalMatches = allMatches.length;
      const threshold25 = Math.ceil(totalMatches * 0.25);

      const players = engine.getPlayerList(sport);

      // Get stats and awards for each player
      const playerData = players.map(p => {
        const st = engine.getPlayerStats(sport, p, filters);
        if (!st || st.matches < threshold25) return null;

        // Get awards
        const momCount = st.momCount || 0;
        let mosCount = 0, orangeCapCount = 0, purpleCapCount = 0;

        try {
          if (season !== 'All' && format !== 'All') {
            const mos = awardsEngine.getMoS(sport, season, format);
            if (mos === p) mosCount = 1;
            const oc  = awardsEngine.getOrangeCap(sport, season, format);
            if (oc === p) orangeCapCount = 1;
            const pc  = awardsEngine.getPurpleCap(sport, season, format);
            if (pc === p) purpleCapCount = 1;
          } else {
            const counts = awardsEngine.getPlayerAwardCounts(sport, p);
            mosCount       = counts.mosCount;
            orangeCapCount = counts.orangeCapCount;
            purpleCapCount = counts.purpleCapCount;
          }
        } catch(_) {}

        const totalAchievements = momCount + mosCount + orangeCapCount + purpleCapCount;

        return {
          player:         p,
          stats:          st,
          momCount,
          mosCount,
          orangeCapCount,
          purpleCapCount,
          totalAchievements,
          runs:           st.runs || 0,
        };
      }).filter(Boolean);

      // Sort: achievements desc, then runs desc
      playerData.sort((a, b) => {
        if (b.totalAchievements !== a.totalAchievements) {
          return b.totalAchievements - a.totalAchievements;
        }
        return b.runs - a.runs;
      });

      setCarouselItems(playerData);
    } catch(_) { setCarouselItems([]); }
  }

  const totalSlides = 1 + carouselItems.length;

  // Auto-rotate
  useEffect(() => {
    clearTimeout(timerRef.current);
    const duration = slideIndex === 0 ? 7000 : 4000;
    timerRef.current = setTimeout(() => {
      setSlideIndex(i => (i + 1) % totalSlides);
    }, duration);
    return () => clearTimeout(timerRef.current);
  }, [slideIndex, totalSlides]);

  function goTo(i) { setSlideIndex((i + totalSlides) % totalSlides); }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? goTo(slideIndex+1) : goTo(slideIndex-1);
    touchStartX.current = null;
  }

  const currentItem = slideIndex > 0 ? carouselItems[slideIndex - 1] : null;

  return (
    <div style={S.page}>

      {/* ── CAROUSEL ── */}
      <div
        style={S.carousel}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}>

        {slideIndex === 0 ? (
          <GroupCard snapshot={snapshot} sport={sport} seasons={
            engine.loadConfig(sport).seasons || []
          }/>
        ) : currentItem ? (
          <PlayerCard item={currentItem}/>
        ) : null}

        <button style={S.arrowL} onClick={() => goTo(slideIndex-1)}>‹</button>
        <button style={S.arrowR} onClick={() => goTo(slideIndex+1)}>›</button>

        <div style={S.dots}>
          {Array.from({length: totalSlides}).map((_,i) => (
            <div key={i} onClick={() => goTo(i)} style={{
              ...S.dot,
              background: i===slideIndex ? '#fff' : 'rgba(255,255,255,0.35)',
              width: i===slideIndex ? 14 : 6,
            }}/>
          ))}
        </div>
      </div>

      <div style={S.body}>

        {/* ── LEAGUE STANDING ── */}
        <LeagueStanding sport={sport} filters={filters}/>

        {/* ── RECENT MATCHES ── */}
        <div style={S.secRow}>
          <div style={S.secLabel}>Recent matches</div>
        </div>

        {recentMatches.length === 0 ? <Empty/> : recentMatches.map((m,i) => (
          <div key={i} style={S.matchTile} onClick={() => navigateTo('matches')}>
            <div style={S.matchTop}>
              <div style={S.matchBadge}>
                S{m.season} · M{m.matchNum} · {m.ground}
              </div>
              <div style={S.matchDate}>
                {m.date
                  ? new Date(m.date).toLocaleDateString('en-IN',
                      {day:'numeric', month:'short', year:'numeric'})
                  : m.format}
              </div>
            </div>
            <div style={S.matchTeams}>
              <div style={S.matchTeam}>
                <div style={{...S.matchTeamName, fontWeight: m.winner===m.team1?600:400}}>
                  {m.team1}
                </div>
                <div style={{...S.matchScore, color: m.winner===m.team1?'#0C447C':'#555'}}>
                  {m.score1}
                </div>
              </div>
              <div style={S.matchVs}>vs</div>
              <div style={{...S.matchTeam, alignItems:'flex-end'}}>
                <div style={{...S.matchTeamName, fontWeight: m.winner===m.team2?600:400}}>
                  {m.team2}
                </div>
                <div style={{...S.matchScore, color: m.winner===m.team2?'#0C447C':'#555'}}>
                  {m.score2}
                </div>
              </div>
            </div>
            <div style={S.matchFoot}>
              {m.result} · Man of the Match: <strong>{m.mom}</strong>
            </div>
          </div>
        ))}

        <button style={S.viewAll} onClick={() => navigateTo('matches')}>
          View all matches →
        </button>

        {/* ── MVP LEADERBOARD ── */}
        <div style={S.secRow} onClick={() => navigateTo('leaderboard')}>
          <div style={S.secLabel}>MVP</div>
          <div style={S.secLink}>See all →</div>
        </div>

        <div style={S.lbCard} onClick={() => navigateTo('leaderboard')}>
          {mvpBoard.length === 0 ? <Empty/> : mvpBoard.map((p,i) => (
            <div key={i} style={S.lbRow}>
              <div style={{
                ...S.lbRank,
                color: i===0?'#BA7517': i===1?'#5F5E5A': i===2?'#854F0B':'#aaa',
                fontWeight: i<3?600:400,
              }}>
                {i+1}
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

// ── Group card ────────────────────────────────────────────────────────────────
function GroupCard({ snapshot, sport, seasons }) {
  const cfg = engine.loadConfig(sport);
  return (
    <div style={C.groupCard}>
      <div style={C.groupAvatar}>RACL</div>
      <div style={C.groupName}>RACL</div>
      <div style={C.groupGrid}>
        <StatBox n={seasons.length}           l="Seasons"/>
        <StatBox n={snapshot?.matches ?? '-'} l="Matches"/>
        <StatBox n={snapshot?.totalRuns ?? '-'} l="Runs"/>
        <StatBox n={snapshot?.totalWickets ?? '-'} l="Wickets"/>
      </div>
    </div>
  );
}

function StatBox({ n, l }) {
  return (
    <div style={C.statBox}>
      <div style={C.statN}>{n}</div>
      <div style={C.statL}>{l}</div>
    </div>
  );
}

// ── Player card ───────────────────────────────────────────────────────────────
function PlayerCard({ item }) {
  const { player, stats, momCount, mosCount, orangeCapCount, purpleCapCount } = item;

  const achievements = [
    mosCount        > 0 && `⭐ MoS ${mosCount}`,
    momCount        > 0 && `🏆 MoM ${momCount}`,
    orangeCapCount  > 0 && `🟠 Orange Cap ${orangeCapCount}`,
    purpleCapCount  > 0 && `🟣 Purple Cap ${purpleCapCount}`,
  ].filter(Boolean);

  return (
    <div style={C.playerCard}>
      <div style={C.playerAvatar}>
        {player.slice(0,2).toUpperCase()}
      </div>
      <div style={C.playerName}>{player}</div>
      <div style={C.playerGrid}>
        <StatBox n={stats.matches}  l="Matches"/>
        <StatBox n={stats.runs}     l="Runs"/>
        <StatBox n={stats.wickets}  l="Wickets"/>
        <StatBox n={stats.mvpTotal} l="MVP Pts"/>
      </div>
      {achievements.length > 0 && (
        <div style={C.achievementRow}>
          {achievements.map((a,i) => (
            <span key={i} style={C.achievementBadge}>{a}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── League Standing ───────────────────────────────────────────────────────────
function LeagueStanding({ sport, filters }) {
  const [leader, setLeader] = useState(null);

  useEffect(() => {
    try {
      const matches = engine.getMatches(sport, filters);
      if (!matches.length) { setLeader(null); return; }

      const recentMatch = matches[0];
      const activeFilters = { ...filters };
      if (!activeFilters.season) activeFilters.season = recentMatch.season;

      const table = engine.getPointsTable(sport, activeFilters);
      if (table.length < 2) { setLeader(null); return; }

      const top    = table[0];
      const second = table[1];

      // Build season-format label
      const sn  = activeFilters.season || recentMatch.season;
      const fmt = activeFilters.format || recentMatch.format || '';
      const seasonLabel = `Season${sn}${fmt ? `-${fmt}` : ''}`;

      setLeader({ team1:top.team, wins1:top.won, team2:second.team, wins2:second.won, seasonLabel });
    } catch(_) { setLeader(null); }
  }, [sport, JSON.stringify(filters)]);

  if (!leader) return null;

  const tied = leader.wins1 === leader.wins2;

  return (
    <div style={LS.box}>
      <div style={LS.title}>League Standing</div>
      <div style={LS.row}>
        <div style={LS.teamLeft}>
          <div style={LS.tname}>{leader.team1}</div>
          <div style={LS.score}>{leader.wins1}</div>
        </div>
        <div style={LS.middle}>
          <div style={LS.seasonLabel}>{leader.seasonLabel}</div>
          <div style={LS.vs}>{tied ? 'Tied' : 'vs'}</div>
        </div>
        <div style={LS.teamRight}>
          <div style={LS.tname}>{leader.team2}</div>
          <div style={LS.score}>{leader.wins2}</div>
        </div>
      </div>
    </div>
  );
}

function Empty() {
  return <div style={S.empty}>No data available</div>;
}

// ── Carousel styles ───────────────────────────────────────────────────────────
const C = {
  groupAvatar: {
    width:56, height:56, borderRadius:'50%',
    background:'rgba(255,255,255,0.2)',
    border:'2px solid rgba(255,255,255,0.4)',
    margin:'0 auto 8px',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:14, fontWeight:700, color:'#fff', letterSpacing:1,
  },
  groupName: { fontSize:18, fontWeight:600, color:'#fff', marginBottom:12 },
  groupGrid: { display:'grid', gridTemplateColumns:'repeat(4,60px)', gap:6, justifyContent: 'center' },
  playerCard: {
    padding:'12px 12px 24px',
    textAlign:'center',
  },
  groupCard: {
    padding:'12px 12px 24px',
    textAlign:'center',
  },
  playerAvatar: {
    width:56, height:56, borderRadius:'50%',
    background:'rgba(255,255,255,0.2)',
    border:'2px solid rgba(255,255,255,0.4)',
    margin:'0 auto 8px',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:14, fontWeight:600, color:'#fff',
  },
  playerName: { fontSize:20, fontWeight:600, color:'#fff', marginBottom:8 },
  playerGrid: { display:'grid', gridTemplateColumns:'repeat(4,60px)', gap:6, justifyContent: 'center' },
  statBox: {
    background:'rgba(255,255,255,0.12)',
    borderRadius:8, padding:'6px 4px',
    border:'0.5px solid rgba(255,255,255,0.15)',
  },
  statN: { fontSize:14, fontWeight:600, color:'#fff' },
  statL: { fontSize:9,  color:'rgba(255,255,255,0.7)', marginTop:1 },
  achievementRow: {
    display:'flex', flexWrap:'wrap', justifyContent:'center',
    gap:10, marginTop:8,
  },
  achievementBadge: {
    fontSize:12, color:'rgba(255,255,255,0.9)',
    background:'none', border:'none', padding:0,
  },
};

// ── League Standing styles ────────────────────────────────────────────────────
const LS = {
  box: {
    background:'#1D64AC', borderRadius:10,
    border:'none', padding:'10px 14px',
    marginBottom:10,
  },
  title: {
    fontSize:12, fontWeight:500, color:'rgba(255,255,255,0.7)',
    letterSpacing:0.7, textTransform:'uppercase',
    textAlign:'center', marginBottom:8,
  },
  row: { display:'flex', alignItems:'center' },
  teamLeft:  { flex:1 },
  teamRight: { flex:1, textAlign:'right' },
  tname: { fontSize:16, fontWeight:600, color:'rgba(255,255,255,0.85)' },
  score: { fontSize:24, fontWeight:700, color:'#fff', marginTop:2 },
  middle: {
    display:'flex', flexDirection:'column',
    alignItems:'center', padding:'0 10px', flexShrink:0,
  },
  seasonLabel: {
    fontSize:11, fontWeight:500, color:'#fff',
    background:'rgba(255,255,255,0.2)', padding:'2px 8px',
    borderRadius:8, marginBottom:4,
  },
  vs: { fontSize:11, color:'rgba(255,255,255,0.6)' },
};

// ── Main styles ───────────────────────────────────────────────────────────────
const S = {
  page:     { paddingBottom:16 },
  carousel: {
    position:'relative',
    background:'linear-gradient(160deg, #0C447C 0%, #185FA5 100%)',
    userSelect:'none',
  },
  arrowL: {
    position:'absolute', left:6, top:'50%',
    transform:'translateY(-60%)',
    background:'rgba(255,255,255,0.15)',
    border:'none', color:'#fff',
    fontSize:22, width:30, height:30,
    borderRadius:'50%', cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
  },
  arrowR: {
    position:'absolute', right:6, top:'50%',
    transform:'translateY(-60%)',
    background:'rgba(255,255,255,0.15)',
    border:'none', color:'#fff',
    fontSize:22, width:30, height:30,
    borderRadius:'50%', cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
  },
  dots: {
    position:'absolute', bottom:8,
    left:'50%', transform:'translateX(-50%)',
    display:'flex', gap:5, alignItems:'center',
  },
  dot: { height:6, borderRadius:3, cursor:'pointer', transition:'all 0.3s', flexShrink:0 },
  body:    { padding:'12px 12px 0' },
  secRow: {
    display:'flex', justifyContent:'space-between',
    alignItems:'center', marginBottom:8, cursor:'pointer',
  },
  secLabel: {
    fontSize:10, fontWeight:500, color:'#888',
    letterSpacing:0.7, textTransform:'uppercase',
  },
  secLink: { fontSize:12, color:'#0C447C' },
  matchTile: {
    background:'#fff', borderRadius:10,
    border:'0.5px solid #eee', padding:'12px 14px',
    marginBottom:8, cursor:'pointer',
    boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
  },
  matchTop: { display:'flex', justifyContent:'space-between', marginBottom:8 },
  matchBadge: {
    fontSize:10, background:'#E6F1FB',
    color:'#0C447C', padding:'2px 8px',
    borderRadius:8, fontWeight:500,
  },
  matchDate:    { fontSize:10, color:'#aaa' },
  matchTeams:   { display:'flex', alignItems:'flex-start', gap:6 },
  matchTeam:    { flex:1, display:'flex', flexDirection:'column' },
  matchTeamName:{ fontSize:12, color:'#222' },
  matchScore:   { fontSize:16, fontWeight:600, marginTop:2 },
  matchVs:      { fontSize:11, color:'#ccc', paddingTop:14, flexShrink:0 },
  matchFoot: {
    fontSize:11, color:'#aaa', marginTop:8,
    paddingTop:6, borderTop:'0.5px solid #f5f5f5',
  },
  viewAll: {
    display:'block', width:'100%', padding:'9px',
    borderRadius:10, border:'0.5px solid #B5D4F4',
    background:'#E6F1FB', color:'#0C447C',
    fontSize:12, fontWeight:500, cursor:'pointer',
    marginBottom:16, textAlign:'center',
  },
  lbCard: {
    background:'#fff', borderRadius:10,
    border:'0.5px solid #eee', overflow:'hidden',
    cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
  },
  lbRow: {
    display:'flex', alignItems:'center',
    padding:'10px 14px', borderBottom:'0.5px solid #f5f5f5',
  },
  lbRank:  { width:20, fontSize:12, flexShrink:0 },
  lbName:  { flex:1, fontSize:13, fontWeight:500, color:'#222' },
  lbRight: { textAlign:'right' },
  lbVal:   { fontSize:13, fontWeight:500, color:'#222' },
  lbSub:   { fontSize:10, color:'#aaa', marginTop:1 },
  empty: { textAlign:'center', padding:'20px 0', fontSize:13, color:'#ccc' },
};