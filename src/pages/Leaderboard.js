import React, { useState, useEffect } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');
const ACCENT = '#7A2948';

const MVP_SORTS = [
  {v:'totalPoints', l:'Total MVP'},
  {v:'batPoints',   l:'MVP Bat'},
  {v:'bowlPoints',  l:'MVP Bowl'},
  {v:'fieldPoints', l:'MVP Field'},
  {v:'momCount',    l:'MoM count'},
  {v:'mosCount',    l:'MoS count'},
];
const BAT_SORTS = [
  {v:'runs',       l:'Runs'},
  {v:'average',    l:'Average'},
  {v:'strikeRate', l:'Strike rate'},
  {v:'fours',      l:'Fours'},
  {v:'sixes',      l:'Sixes'},
  {v:'highScore',  l:'High score'},
];
const BOWL_SORTS = [
  {v:'wickets',   l:'Wickets'},
  {v:'economy',   l:'Economy'},
  {v:'average',   l:'Average'},
  {v:'bowlingSR', l:'Strike rate'},
  {v:'maidens',   l:'Maidens'},
];
const FIELD_SORTS = [
  {v:'total',      l:'Total'},
  {v:'catches',    l:'Catches'},
  {v:'runOuts',    l:'Run outs'},
  {v:'fieldPoints',l:'MVP Field'},
];
const PSHIP_SORTS = [
  {v:'runs',       l:'Runs'},
  {v:'strikeRate', l:'Strike rate'},
];

const INDIVIDUAL_TABS = [
  {id:'mvp',     label:'MVP'},
  {id:'batting', label:'Batting'},
  {id:'bowling', label:'Bowling'},
  {id:'fielding',label:'Fielding'},
];

const PODIUM = {
  1: {
    row: {
	  background:'#F3F0FF',
      borderLeft:'3px solid #6C4DFF',
      boxSizing:'border-box',
      paddingLeft:9,
    },
    rank:'#4B32C3', primary:'#24165A', secondary:'#6C63A3',
    label:'#7C74B2', badgeBg:'rgba(108,77,255,0.14)', badgeText:'#4B32C3',
  },
    
  2: {
    row: {
      background:'#FFF5F2',
      borderLeft:'3px solid #A56A5F',
      boxSizing:'border-box',
      paddingLeft:9,
    },
    rank:'#8A4E44', primary:'#432521', secondary:'#7B5A53',
    label:'#8A6A63', badgeBg:'rgba(165,106,95,0.12)', badgeText:'#7A463D',
  },	
  3: {
    row: {
      background:'#FFF1F5',
      borderLeft:'3px solid #B0446B',
      boxSizing:'border-box',
      paddingLeft:9,
    },
    rank:'#7A2948', primary:'#1F1B3D', secondary:'#6D668A',
    label:'#7D7599', badgeBg:'rgba(176,68,107,0.12)', badgeText:'#7A2948',
  },
};

function podiumFor(rank, dimmed=false) {
  if (dimmed) return null;
  return PODIUM[Number(rank)] || null;
}

function playerRowStyle(i, rank, dimmed=false) {
  const podium = podiumFor(rank, dimmed);
  return {
    ...S.playerRow,
    opacity: dimmed ? 0.55 : 1,
    background: i%2===0 ? '#fafafa' : '#fff',
    ...(podium ? podium.row : null),
  };
}

export default function Leaderboard() {
  const { sportType, season, format } = useApp();
  const sport = sportType.toLowerCase();

  const [mode,    setMode]    = useState('individual');
  const [indTab,  setIndTab]  = useState('mvp');
  const [sortBy,  setSortBy]  = useState('totalPoints');
  const [data,    setData]    = useState(null);

  const [ground,    setGround]    = useState('All');
  const [team,      setTeam]      = useState('All');
  const [matchNum,  setMatchNum]  = useState('All');
  const [batInning, setBatInning] = useState('All');
  const [batPos,    setBatPos]    = useState('All');
  const [winLoss,   setWinLoss]   = useState('All');

  const [pshipBatInning, setPshipBatInning] = useState('All');
  const [pshipWicket,    setPshipWicket]    = useState('All');
  const [pshipMatchNum,  setPshipMatchNum]  = useState('All');
  const [pshipTeam,      setPshipTeam]      = useState('All');
  const [pshipPlayer,    setPshipPlayer]    = useState('All');

  const [grounds,    setGrounds]    = useState(['All']);
  const [teams,      setTeams]      = useState(['All']);
  const [matchNums,  setMatchNums]  = useState(['All']);
  const [playerList, setPlayerList] = useState([]);

  useEffect(() => {
    const cfg = engine.loadConfig(sport);
    setGrounds(['All', ...(cfg.grounds || [])]);
    setPlayerList(engine.getPlayerList(sport));
    try { setTeams(engine.getAllTeams(sport)); } catch(_) { setTeams(['All']); }
    try {
      const matches = engine.getMatches(sport, season !== 'All' ? {season} : {});
      const nums = [...new Set(matches.map(m => String(m.matchNum)))]
        .sort((a,b) => Number(a)-Number(b));
      setMatchNums(['All', ...nums]);
    } catch(_) { setMatchNums(['All']); }
  }, [sport, season]);

  useEffect(() => {
    setSortBy(defaultSort(indTab));
  }, [indTab]);

  useEffect(() => {
    loadLeaderboard();
  }, [sport, season, format, mode, indTab, sortBy,
      ground, team, matchNum, batInning, batPos, winLoss,
      pshipBatInning, pshipWicket, pshipMatchNum, pshipTeam, pshipPlayer]);

  function defaultSort(tab) {
    if (tab==='mvp')      return 'totalPoints';
    if (tab==='batting')  return 'runs';
    if (tab==='bowling')  return 'wickets';
    if (tab==='fielding') return 'total';
    return 'runs';
  }

  function buildFilters() {
    const f = {};
    if (season    !== 'All') f.season         = season;
    if (format    !== 'All') f.format          = format;
    if (ground    !== 'All') f.ground          = ground;
    if (team      !== 'All') f.team            = team;
    if (matchNum  !== 'All') f.matchNum        = matchNum;
    if (batInning !== 'All') f.batInning       = batInning;
    if (batPos    !== 'All') f.battingPosition = batPos;
    if (winLoss   !== 'All') f.winLoss         = winLoss;
    return f;
  }

  function buildPshipFilters() {
    const f = {};
    if (season         !== 'All') f.season    = season;
    if (format         !== 'All') f.format    = format;
    if (pshipBatInning !== 'All') f.batInning = pshipBatInning;
    if (pshipWicket    !== 'All') f.wicket    = pshipWicket;
    if (pshipMatchNum  !== 'All') f.matchNum  = pshipMatchNum;
    if (pshipTeam      !== 'All') f.team      = pshipTeam;
    return f;
  }

  function loadLeaderboard() {
    try {
      if (mode === 'individual') {
        if (indTab==='mvp') {
          setData(engine.getMVPLeaderboardEnhanced(sport, buildFilters(), sortBy));
        } else if (indTab==='batting') {
          setData(engine.getBattingLeaderboard(sport, buildFilters(), sortBy));
        } else if (indTab==='bowling') {
          setData(engine.getBowlingLeaderboard(sport, buildFilters(), sortBy));
        } else if (indTab==='fielding') {
          setData(engine.getFieldingLeaderboard(sport, buildFilters(), sortBy));
        }
      } else {
        let rows = engine.getPartnershipLeaderboard(sport, buildPshipFilters(), sortBy);
        if (pshipPlayer !== 'All') {
          rows = rows.filter(p => p.player1===pshipPlayer || p.player2===pshipPlayer);
        }
        setData(rows);
      }
    } catch(_) { setData(null); }
  }

  const currentSorts = mode==='partnership' ? PSHIP_SORTS
    : indTab==='mvp'      ? MVP_SORTS
    : indTab==='batting'  ? BAT_SORTS
    : indTab==='bowling'  ? BOWL_SORTS
    : FIELD_SORTS;

  return (
    <div style={S.page}>

      {/* Mode toggle */}
      <div style={S.modeBar}>
        {['individual','partnership'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={mode===m ? S.modeOn : S.modeOff}>
            {m.charAt(0).toUpperCase()+m.slice(1)}
          </button>
        ))}
      </div>

      {/* Individual sub-tabs */}
      {mode==='individual' && (
        <div style={S.subTabBar}>
          {INDIVIDUAL_TABS.map(t => (
            <button key={t.id} onClick={() => setIndTab(t.id)}
              style={indTab===t.id ? S.subTabOn : S.subTab}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Filters — Individual */}
      {mode==='individual' && (
        <div style={S.filterBar}>
          <div style={S.filterGrid}>
            <FilterCell label="Ground"   value={ground}    set={setGround}    opts={grounds}/>
            <FilterCell label="Team"     value={team}      set={setTeam}      opts={teams}/>
            <FilterCell label="Match"    value={matchNum}  set={setMatchNum}  opts={matchNums}/>
            <FilterCell label="Bat inn"  value={batInning} set={setBatInning} opts={['All','1','2']}/>
            <FilterCell label="Position" value={batPos}    set={setBatPos}    opts={['All','1','2','3','4','5','6','7','8']}/>
            <FilterCell label="Result"   value={winLoss}   set={setWinLoss}   opts={['All','Win','Loss']}/>
          </div>
        </div>
      )}

      {/* Filters — Partnership */}
      {mode==='partnership' && (
        <div style={S.filterBar}>
          <div style={S.filterGrid}>
            <FilterCell label="Bat inn" value={pshipBatInning} set={setPshipBatInning} opts={['All','1','2']}/>
            <FilterCell label="Wicket"  value={pshipWicket}    set={setPshipWicket}
              opts={['All','1','2','3','4','5','6','7','8','9','10']}/>
            <FilterCell label="Match"   value={pshipMatchNum}  set={setPshipMatchNum}  opts={matchNums}/>
            <FilterCell label="Team"    value={pshipTeam}      set={setPshipTeam}      opts={teams}/>
            <FilterCell label="Player"  value={pshipPlayer}    set={setPshipPlayer}    opts={['All',...playerList]}/>
          </div>
        </div>
      )}

      {/* Sort by dropdown */}
      <div style={S.sortBar}>
        <span style={S.sortLabel}>Sort by</span>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={S.sortSelect}>
          {currentSorts.map(s => (
            <option key={s.v} value={s.v}>{s.l}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div style={S.body}>
        {!data ? <Empty/>
          : mode==='partnership'
            ? <PshipTable data={Array.isArray(data)?data:[]} highlightPlayer={pshipPlayer}/>
            : indTab==='mvp'
              ? <MVPTable data={data}/>
              : indTab==='batting'
                ? <BatTable data={Array.isArray(data)?data:[]}/>
                : indTab==='bowling'
                  ? <BowlTable data={Array.isArray(data)?data:[]}/>
                  : <FieldTable data={Array.isArray(data)?data:[]}/>
        }
      </div>
    </div>
  );
}

// ── Filter cell ───────────────────────────────────────────────────────────────
function FilterCell({ label, value, set, opts }) {
  return (
    <div style={S.filterItem}>
      <div style={S.filterLabel}>{label}</div>
      <select value={value} onChange={e=>set(e.target.value)} style={S.filterSelect}>
        {opts.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ── Rank badge ────────────────────────────────────────────────────────────────
function Rank({ rank, i, dimmed }) {
  const podium = podiumFor(rank, dimmed);
  const color = dimmed ? '#ccc'
    : podium ? podium.rank
    : i===0 ? '#BA7517'
    : i===1 ? '#5F5E5A'
    : i===2 ? '#854F0B'
    : '#bbb';
  return (
    <span style={{...S.rankCol, color, fontWeight: podium || (i<3&&!dimmed) ? 600 : 400}}>
      {rank}
    </span>
  );
}

// ── MVP Table ─────────────────────────────────────────────────────────────────
function MVPTable({ data }) {
  if (!data) return <Empty/>;
  const { group1=[], group2=[], totalMatches, threshold60, mvpThreshold=0.6 } = data;

  function Row({ p, i, dimmed }) {
    const showMoM = (p.momCount||0) > 0;
    const showMoS = (p.mosCount||0) > 0;
    const podium = podiumFor(p.rank, dimmed);
    return (
      <div style={playerRowStyle(i, p.rank, dimmed)}>
        <div style={S.rowMain}>
          <Rank rank={p.rank} i={i} dimmed={dimmed}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{...S.playerName, color:podium?.primary || S.playerName.color}}>{p.player}</div>
          </div>
          <div style={S.statGroup}>
            <StatVal label="Total" val={p.mvpMomPerInn} podium={podium}/>
            <StatVal label="Bat"   val={p.mvpBatPerInn} podium={podium}/>
            <StatVal label="Bowl"  val={p.mvpBowlPerInn} podium={podium}/>
          </div>
        </div>
        <div style={S.rowSub}>
          <span style={{...S.subItem, color:podium?.secondary || S.subItem.color}}>{p.matches} matches</span>
          {showMoM && <span style={{...S.subBadge, color:podium?.badgeText || S.subBadge.color, background:podium?.badgeBg || S.subBadge.background}}>MoM:{p.momCount}</span>}
          {showMoS && <span style={{...S.subBadge, color:podium?.badgeText || S.subBadge.color, background:podium?.badgeBg || S.subBadge.background}}>MoS:{p.mosCount}</span>}
        </div>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <div style={S.tableHeader}>
        <span style={S.rankCol}>#</span>
        <span style={{flex:1}}>Player</span>
        <span style={S.headerGroup}>Total · Bat · Bowl</span>
      </div>
      {group1.map((p,i) => <Row key={p.player} p={p} i={i} dimmed={false}/>)}
      {group2.length > 0 && (
        <>
          <div style={S.divider}>
            Below {Math.round((mvpThreshold || 0.6) * 100)}% threshold ({threshold60} of {totalMatches} matches)
          </div>
          {group2.map((p,i) => <Row key={p.player} p={p} i={i} dimmed={true}/>)}
        </>
      )}
    </div>
  );
}

// ── Batting Table ─────────────────────────────────────────────────────────────
function BatTable({ data }) {
  if (!data?.length) return <Empty/>;
  return (
    <div style={S.card}>
      <div style={S.tableHeader}>
        <span style={S.rankCol}>#</span>
        <span style={{flex:1}}>Player</span>
        <span style={S.headerGroup}>Runs · Avg · SR</span>
      </div>
      {data.map((p,i) => {
        const show4s = (p.fours||0) > 0;
        const show6s = (p.sixes||0) > 0;
        const podium = podiumFor(p.rank);
        return (
          <div key={i} style={playerRowStyle(i, p.rank)}>
            <div style={S.rowMain}>
              <Rank rank={p.rank} i={i}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{...S.playerName, color:podium?.primary || S.playerName.color}}>{p.player}</div>
              </div>
              <div style={S.statGroup}>
                <StatVal label="Runs" val={p.runs} podium={podium}/>
                <StatVal label="Avg" val={p.average ?? '-'} podium={podium}/>
                <StatVal label="SR"   val={p.strikeRate} podium={podium}/>
              </div>
            </div>
            <div style={S.rowSub}>
              <span style={{...S.subItem, color:podium?.secondary || S.subItem.color}}>{p.innings} inn · HS {p.highScore}</span>
              {show4s && <span style={{...S.subBadge, color:podium?.badgeText || S.subBadge.color, background:podium?.badgeBg || S.subBadge.background}}>4s:{p.fours}</span>}
              {show6s && <span style={{...S.subBadge, color:podium?.badgeText || S.subBadge.color, background:podium?.badgeBg || S.subBadge.background}}>6s:{p.sixes}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Bowling Table ─────────────────────────────────────────────────────────────
function BowlTable({ data }) {
  if (!data?.length) return <Empty/>;
  return (
    <div style={S.card}>
      <div style={S.tableHeader}>
        <span style={S.rankCol}>#</span>
        <span style={{flex:1}}>Player</span>
        <span style={S.headerGroup}>Wkts · Avg · Eco</span>
      </div>
      {data.map((p,i) => {
        const showSR  = (p.bowlingSR||0) > 0;
        const showMdn = (p.maidens||0)   > 0;
        const podium = podiumFor(p.rank);
        return (
          <div key={i} style={playerRowStyle(i, p.rank)}>
            <div style={S.rowMain}>
              <Rank rank={p.rank} i={i}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{...S.playerName, color:podium?.primary || S.playerName.color}}>{p.player}</div>
              </div>
              <div style={S.statGroup}>
                <StatVal label="Wkts" val={p.wickets} podium={podium}/>
                <StatVal label="Avg"  val={p.bowlingAvg??'-'} podium={podium}/>
                <StatVal label="Eco"  val={p.economy} podium={podium}/>
              </div>
            </div>
            <div style={S.rowSub}>
              <span style={{...S.subItem, color:podium?.secondary || S.subItem.color}}>{p.oversBowled} ov · Best {p.bestFigures}</span>
              {showSR  && <span style={{...S.subBadge, color:podium?.badgeText || S.subBadge.color, background:podium?.badgeBg || S.subBadge.background}}>SR:{p.bowlingSR}</span>}
              {showMdn && <span style={{...S.subBadge, color:podium?.badgeText || S.subBadge.color, background:podium?.badgeBg || S.subBadge.background}}>Mdn:{p.maidens}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Fielding Table ────────────────────────────────────────────────────────────
function FieldTable({ data }) {
  if (!data?.length) return <Empty/>;
  return (
    <div style={S.card}>
      <div style={S.tableHeader}>
        <span style={S.rankCol}>#</span>
        <span style={{flex:1}}>Player</span>
        <span style={S.headerGroup}>Catch · RO+St</span>
      </div>
      {data.map((p,i) => {
        const roSt = (p.runOutsDirect||0)+(p.runOutsCombo||0)+(p.stumpings||0);
        const podium = podiumFor(p.rank);
        return (
          <div key={i} style={playerRowStyle(i, p.rank)}>
            <div style={S.rowMain}>
              <Rank rank={p.rank} i={i}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{...S.playerName, color:podium?.primary || S.playerName.color}}>{p.player}</div>
              </div>
              <div style={S.statGroup}>
                <StatVal label="Catch" val={p.catches} podium={podium}/>
                <StatVal label="RO+St" val={roSt} podium={podium}/>
              </div>
            </div>
            <div style={S.rowSub}>
              <span style={{...S.subItem, color:podium?.secondary || S.subItem.color}}>Total: {p.totalFielding}</span>
              <span style={{...S.subBadge, color:podium?.badgeText || S.subBadge.color, background:podium?.badgeBg || S.subBadge.background}}>MVP: {p.mvpFieldPerInn??'-'}/inn</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Partnership Table ─────────────────────────────────────────────────────────
function PshipTable({ data, highlightPlayer }) {
  if (!data?.length) return <Empty/>;
  const maxRuns = data[0]?.runs || 1;
  return (
    <div style={S.card}>
      <div style={S.tableHeader}>
        <span style={S.rankCol}>#</span>
        <span style={{flex:1}}>Partnership</span>
        <span style={S.headerGroup}>Runs · SR</span>
      </div>
      {data.map((p,i) => {
        const p1hl = highlightPlayer!=='All' && p.player1===highlightPlayer;
        const p2hl = highlightPlayer!=='All' && p.player2===highlightPlayer;
        const barW = Math.round((p.runs/maxRuns)*100);
        const podium = podiumFor(i+1);
        return (
          <div key={i} style={playerRowStyle(i, i+1)}>
            <div style={S.rowMain}>
              <Rank rank={i+1} i={i}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={S.pshipPair}>
                  <span style={{...S.pshipName, color:podium?.primary || (p1hl?ACCENT:S.pshipName.color), fontWeight:p1hl?600:500}}>
                    {p.player1}
                  </span>
                  <span style={{...S.pshipAmp, color:podium?.secondary || S.pshipAmp.color}}>&amp;</span>
                  <span style={{...S.pshipName, color:podium?.primary || (p2hl?ACCENT:S.pshipName.color), fontWeight:p2hl?600:500}}>
                    {p.player2}
                  </span>
                </div>
                <div style={S.barTrack}>
                  <div style={{...S.barFill, width:`${barW}%`}}/>
                </div>
              </div>
              <div style={S.statGroup}>
                <StatVal label="Runs" val={p.runs} podium={podium}/>
                <StatVal label="SR"   val={p.strikeRate} podium={podium}/>
              </div>
            </div>
            <div style={S.rowSub}>
              <span style={{...S.subItem, color:podium?.secondary || S.subItem.color}}>{p.count} stand{p.count!==1?'s':''}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Stat value display ────────────────────────────────────────────────────────
function StatVal({ label, val, podium }) {
  return (
    <div style={S.statVal}>
      <div style={{...S.statNum, color:podium?.primary || S.statNum.color}}>{val??'-'}</div>
      <div style={{...S.statLbl, color:podium?.label || S.statLbl.color}}>{label}</div>
    </div>
  );
}

function Empty() {
  return <div style={S.empty}>No data available</div>;
}

const S = {
  page:    { paddingBottom:16 },
  modeBar: {
    display:'flex', background:'#fff',
    borderBottom:'0.5px solid #eee', padding:'0 12px',
  },
  modeOn: {
    flex:1, padding:'10px 0', fontSize:12, fontWeight:500,
    color:ACCENT, border:'none', background:'none',
    borderBottom:`2px solid ${ACCENT}`, cursor:'pointer',
  },
  modeOff: {
    flex:1, padding:'10px 0', fontSize:12, color:'#aaa',
    border:'none', background:'none',
    borderBottom:'2px solid transparent', cursor:'pointer',
  },
  subTabBar: {
    display:'flex', background:'#f8f8f8',
    borderBottom:'0.5px solid #eee',
  },
  subTab: {
    flex:1, padding:'8px 0', fontSize:11, color:'#888',
    border:'none', background:'none',
    borderBottom:'2px solid transparent', cursor:'pointer',
  },
  subTabOn: {
    flex:1, padding:'8px 0', fontSize:11, fontWeight:500,
    color:ACCENT, border:'none', background:'none',
    borderBottom:`2px solid ${ACCENT}`, cursor:'pointer',
  },
  sortBar: {
    display:'flex',
    alignItems:'center',
    justifyContent:'flex-end',
    gap:8,
    padding:'7px 12px',
    background:'#fff',
    borderBottom:'0.5px solid #eee',
  },
  sortLabel:  { fontSize:12, color:'#aaa', flexShrink:0 },
  sortSelect: {
    width:'40%',
    padding:'5px 6px',
    borderRadius:6,
    border:'0.5px solid #ddd',
    fontSize:12,
    color:'#333',
    background:'#fafafa',
  },
  filterBar: {
    padding:'8px 12px', background:'#f8f8f8',
    borderBottom:'0.5px solid #eee',
  },
  filterGrid: {
    display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6,
  },
  filterItem:   { display:'flex', flexDirection:'column', gap:2 },
  filterLabel:  {
    fontSize:9, color:'#aaa', fontWeight:500,
    letterSpacing:0.5, textTransform:'uppercase',
  },
  filterSelect: {
    padding:'5px 4px', borderRadius:6,
    border:'0.5px solid #ddd', fontSize:11,
    color:'#333', background:'#fff', width:'100%',
  },
  body:  { padding:'10px 12px 0' },
  card: {
    background:'#fff', borderRadius:10,
    border:'0.5px solid #eee', overflow:'hidden',
  },
  tableHeader: {
    display:'flex', alignItems:'center',
    padding:'7px 12px', background:'#f5f5f5',
    borderBottom:'0.5px solid #eee',
  },
  headerGroup: { fontSize:10, color:'#aaa', textAlign:'right', flexShrink:0 },
  playerRow: {
    borderBottom:'0.5px solid #f5f5f5',
    padding:'8px 12px',
  },
  rowMain: {
    display:'flex', alignItems:'center', gap:6,
  },
  rowSub: {
    display:'flex', alignItems:'center', gap:6,
    paddingLeft:22, marginTop:3, flexWrap:'wrap',
  },
  rankCol:    { width:22, fontSize:12, flexShrink:0, textAlign:'center' },
  playerName: { fontSize:13, fontWeight:500, color:'#222' },
  statGroup: {
    display:'flex', gap:8, flexShrink:0,
  },
  statVal:   { textAlign:'right', minWidth:36 },
  statNum:   { fontSize:13, fontWeight:500, color:'#222' },
  statLbl:   { fontSize:9,  color:'#aaa',   marginTop:1  },
  subItem:   { fontSize:11, color:'#aaa' },
  subBadge: {
    fontSize:10, color:'#534AB7',
    background:'#EEEDFE', padding:'1px 6px',
    borderRadius:8, fontWeight:500,
  },
  divider: {
    padding:'5px 12px', fontSize:10, color:'#aaa',
    background:'#fafafa', borderBottom:'0.5px solid #f0f0f0',
    fontStyle:'italic',
  },
  pshipPair:   { display:'flex', alignItems:'center', gap:5 },
  pshipName:   { fontSize:13, color:'#222' },
  pshipAmp:    { fontSize:11, color:'#aaa' },
  barTrack: {
    height:3, background:'#f0f0f0',
    borderRadius:2, marginTop:4, overflow:'hidden',
  },
  barFill: {
    height:3, background:ACCENT, borderRadius:2,
  },
  empty: { textAlign:'center', padding:'28px 0', fontSize:13, color:'#ccc' },
};
