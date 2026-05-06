import React, { useState, useEffect } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');
const ACCENT = '#27500A';

const MVP_COLS = [
  { key:'mvpMomPerInn',  label:'Total', sort:'totalPoints' },
  { key:'mvpBatPerInn',  label:'Bat',   sort:'batPoints'   },
  { key:'mvpBowlPerInn', label:'Bowl',  sort:'bowlPoints'  },
  { key:'momCount',      label:'MoM',   sort:'momCount'    },
  { key:'mosCount',      label:'MoS',   sort:'mosCount'    },
];

const BAT_COLS = [
  { key:'runs',       label:'Runs', sort:'runs'       },
  { key:'average',    label:'Avg',  sort:'average'    },
  { key:'strikeRate', label:'SR',   sort:'strikeRate' },
  { key:'fours',      label:'4s',   sort:'fours'      },
  { key:'sixes',      label:'6s',   sort:'sixes'      },
  { key:'highScore',  label:'HS',   sort:'highScore'  },
];

const BOWL_COLS = [
  { key:'wickets',    label:'Wkts', sort:'wickets'   },
  { key:'economy',    label:'Eco',  sort:'economy'   },
  { key:'bowlingAvg', label:'Avg',  sort:'average'   },
  { key:'bowlingSR',  label:'SR',   sort:'bowlingSR' },
  { key:'maidens',    label:'Mdn',  sort:'maidens'   },
];

const FIELD_COLS = [
  { key:'totalFielding',  label:'Total',  sort:'total'      },
  { key:'catches',        label:'Catch',  sort:'catches'    },
  { key:'_roSt',          label:'RunOut', sort:'runOuts'    },
  { key:'mvpFieldPerInn', label:'MVP',    sort:'fieldPoints'},
];

const PSHIP_COLS = [
  { key:'runs',        label:'Runs',   sort:'runs'       },
  { key:'strikeRate',  label:'SR',     sort:'strikeRate' },
  { key:'count',       label:'Stands', sort:'count'      },
];

const INDIVIDUAL_TABS = [
  {id:'mvp',     label:'MVP'},
  {id:'batting', label:'Batting'},
  {id:'bowling', label:'Bowling'},
  {id:'fielding',label:'Fielding'},
];

export default function Leaderboard() {
  const { sportType, season, format } = useApp();
  const sport = sportType.toLowerCase();

  const [mode,    setMode]    = useState('individual');
  const [indTab,  setIndTab]  = useState('mvp');
  const [sortBy,  setSortBy]  = useState('totalPoints');
  const [sortDir, setSortDir] = useState('desc');
  const [data,    setData]    = useState(null);

  // Individual filters
  const [ground,    setGround]    = useState('All');
  const [team,      setTeam]      = useState('All');
  const [matchNum,  setMatchNum]  = useState('All');
  const [batInning, setBatInning] = useState('All');
  const [batPos,    setBatPos]    = useState('All');
  const [winLoss,   setWinLoss]   = useState('All');

  // Partnership filters
  const [pshipBatInning, setPshipBatInning] = useState('All');
  const [pshipWicket,    setPshipWicket]    = useState('All');
  const [pshipMatchNum,  setPshipMatchNum]  = useState('All');
  const [pshipTeam,      setPshipTeam]      = useState('All');
  const [pshipPlayer,    setPshipPlayer]    = useState('All');

  // Config options
  const [grounds,    setGrounds]    = useState(['All']);
  const [teams,      setTeams]      = useState(['All']);
  const [matchNums,  setMatchNums]  = useState(['All']);
  const [playerList, setPlayerList] = useState([]);

  useEffect(() => {
    const cfg  = engine.loadConfig(sport);
    setGrounds(['All', ...(cfg.grounds || [])]);
    setPlayerList(engine.getPlayerList(sport));
    try {
      setTeams(engine.getAllTeams(sport));
    } catch(_) { setTeams(['All']); }
    try {
      const matches = engine.getMatches(sport, season !== 'All' ? {season} : {});
      const nums = [...new Set(matches.map(m => String(m.matchNum)))]
        .sort((a,b) => Number(a)-Number(b));
      setMatchNums(['All', ...nums]);
    } catch(_) { setMatchNums(['All']); }
  }, [sport, season]);

  useEffect(() => {
    setSortBy(defaultSort(indTab));
    setSortDir('desc');
  }, [indTab]);

  useEffect(() => { loadLeaderboard(); },
    [sport, season, format, mode, indTab, sortBy,
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

  function handleColSort(sortKey) {
    if (sortBy === sortKey) {
      setSortDir(d => d==='desc'?'asc':'desc');
    } else {
      setSortBy(sortKey);
      setSortDir('desc');
    }
  }

  function SortIcon({ sortKey }) {
    if (sortBy !== sortKey) return null;
    return <span style={{color:ACCENT,fontSize:9}}>{sortDir==='desc'?' ↓':' ↑'}</span>;
  }

  const currentCols = mode==='partnership' ? PSHIP_COLS
    : indTab==='mvp'      ? MVP_COLS
    : indTab==='batting'  ? BAT_COLS
    : indTab==='bowling'  ? BOWL_COLS
    : FIELD_COLS;

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
            <FilterCell label="Bat inn"  value={pshipBatInning} set={setPshipBatInning} opts={['All','1','2']}/>
            <FilterCell label="Wicket"   value={pshipWicket}    set={setPshipWicket}
              opts={['All','1','2','3','4','5','6','7','8','9','10']}/>
            <FilterCell label="Match"    value={pshipMatchNum}  set={setPshipMatchNum}  opts={matchNums}/>
            <FilterCell label="Team"     value={pshipTeam}      set={setPshipTeam}      opts={teams}/>
            <FilterCell label="Player"   value={pshipPlayer}    set={setPshipPlayer}
              opts={['All', ...playerList]}/>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={S.body}>
        {!data
          ? <Empty/>
          : mode==='partnership'
            ? <PshipTable
                data={Array.isArray(data)?data:[]}
                highlightPlayer={pshipPlayer}
                cols={PSHIP_COLS}
                sortBy={sortBy}
                onSort={handleColSort}
                SortIcon={SortIcon}
              />
            : indTab==='mvp'
              ? <MVPTable
                  data={data}
                  cols={MVP_COLS}
                  sortBy={sortBy}
                  onSort={handleColSort}
                  SortIcon={SortIcon}
                />
              : <GenericTable
                  data={Array.isArray(data)?data:[]}
                  cols={currentCols}
                  sortBy={sortBy}
                  onSort={handleColSort}
                  SortIcon={SortIcon}
                  indTab={indTab}
                />
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

// ── MVP table ─────────────────────────────────────────────────────────────────
function MVPTable({ data, cols, sortBy, onSort, SortIcon }) {
  if (!data) return <Empty/>;
  const { group1=[], group2=[], totalMatches, threshold60 } = data;

  function MVPRow({ p, i, dimmed }) {
    return (
      <div style={{...S.tblRow, opacity:dimmed?0.55:1, background:i%2===0?'#fafafa':'#fff'}}>
        <span style={{...S.rankCol, color:i===0&&!dimmed?'#BA7517':i===1&&!dimmed?'#5F5E5A':i===2&&!dimmed?'#854F0B':'#bbb', fontWeight:i<3&&!dimmed?600:400}}>
          {p.rank}
        </span>
        <div style={{flex:1, minWidth:0}}>
          <div style={S.playerName}>{p.player}</div>
          <div style={S.playerSub}>{p.matches} matches</div>
        </div>
        {cols.map(col => (
          <span key={col.key} style={S.numCol}>
            {p[col.key]??'-'}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div style={S.card}>
      <div style={S.tblHead}>
        <span style={S.rankCol}>#</span>
        <span style={{flex:1}}>Player</span>
        {cols.map(col => (
          <span key={col.key} style={{...S.numCol, cursor:'pointer'}}
            onClick={() => onSort(col.sort)}>
            {col.label}<SortIcon sortKey={col.sort}/>
          </span>
        ))}
      </div>
      {group1.map((p,i) => <MVPRow key={p.player} p={p} i={i} dimmed={false}/>)}
      {group2.length > 0 && (
        <>
          <div style={S.groupDivider}>
            Below 60% threshold ({threshold60} of {totalMatches} matches)
          </div>
          {group2.map((p,i) => <MVPRow key={p.player} p={p} i={i} dimmed={true}/>)}
        </>
      )}
    </div>
  );
}

// ── Generic table (batting, bowling, fielding) ────────────────────────────────
function GenericTable({ data, cols, sortBy, onSort, SortIcon, indTab }) {
  if (!data?.length) return <Empty/>;
  return (
    <div style={S.card}>
      <div style={S.tblHead}>
        <span style={S.rankCol}>#</span>
        <span style={{flex:1}}>Player</span>
        {cols.map(col => (
          <span key={col.key} style={{...S.numCol, cursor:'pointer'}}
            onClick={() => onSort(col.sort)}>
            {col.label}<SortIcon sortKey={col.sort}/>
          </span>
        ))}
      </div>
      {data.map((p,i) => {
        const subLabel = indTab==='batting'
          ? `${p.innings} innings`
          : indTab==='bowling'
            ? `${p.oversBowled} overs`
            : `${p.matches} matches`;
        return (
          <div key={i} style={{...S.tblRow, background:i%2===0?'#fafafa':'#fff'}}>
            <span style={{...S.rankCol,
              color:i===0?'#BA7517':i===1?'#5F5E5A':i===2?'#854F0B':'#bbb',
              fontWeight:i<3?600:400}}>
              {p.rank}
            </span>
            <div style={{flex:1, minWidth:0}}>
              <div style={S.playerName}>{p.player}</div>
              <div style={S.playerSub}>{subLabel}</div>
            </div>
            {cols.map(col => {
              let val;
              if (col.key === '_roSt') {
                val = ((p.runOutsDirect||0)+(p.runOutsCombo||0)+(p.stumpings||0));
              } else {
                val = p[col.key];
              }
              return (
                <span key={col.key} style={S.numCol}>{val??'-'}</span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Partnership table ─────────────────────────────────────────────────────────
function PshipTable({ data, highlightPlayer, cols, sortBy, onSort, SortIcon }) {
  if (!data?.length) return <Empty/>;
  const maxRuns = data[0]?.runs || 1;
  return (
    <div style={S.card}>
      <div style={S.tblHead}>
        <span style={S.rankCol}>#</span>
        <span style={{flex:1}}>Partnership</span>
        {cols.map(col => (
          <span key={col.key} style={{...S.numCol, cursor:'pointer'}}
            onClick={() => onSort(col.sort)}>
            {col.label}<SortIcon sortKey={col.sort}/>
          </span>
        ))}
      </div>
      {data.map((p,i) => {
        const p1hl = highlightPlayer!=='All' && p.player1===highlightPlayer;
        const p2hl = highlightPlayer!=='All' && p.player2===highlightPlayer;
        const barW = Math.round((p.runs/maxRuns)*100);
        return (
          <div key={i} style={{...S.tblRow, background:i%2===0?'#fafafa':'#fff', alignItems:'flex-start'}}>
            <span style={{...S.rankCol, paddingTop:2,
              color:i===0?'#BA7517':i===1?'#5F5E5A':i===2?'#854F0B':'#bbb',
              fontWeight:i<3?600:400}}>
              {i+1}
            </span>
            <div style={{flex:1, minWidth:0}}>
              <div style={S.pshipPair}>
                <span style={{
                  ...S.pshipName,
                  color: p1hl ? ACCENT : '#222',
                  fontWeight: p1hl ? 600 : 500,
                }}>{p.player1}</span>
                <span style={S.pshipAmp}>&amp;</span>
                <span style={{
                  ...S.pshipName,
                  color: p2hl ? ACCENT : '#222',
                  fontWeight: p2hl ? 600 : 500,
                }}>{p.player2}</span>
              </div>
              <div style={S.pshipDetail}>
                {p.count} stand{p.count!==1?'s':''}
              </div>
              <div style={S.barTrack}>
                <div style={{...S.barFill, width:`${barW}%`}}/>
              </div>
            </div>
            {cols.map(col => (
              <span key={col.key} style={{...S.numCol, paddingTop:2}}>
                {p[col.key]??'-'}
              </span>
            ))}
          </div>
        );
      })}
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
    flex:1, padding:'8px 0', fontSize:11,
    color:'#888', border:'none', background:'none',
    borderBottom:'2px solid transparent', cursor:'pointer',
  },
  subTabOn: {
    flex:1, padding:'8px 0', fontSize:11, fontWeight:500,
    color:ACCENT, border:'none', background:'none',
    borderBottom:`2px solid ${ACCENT}`, cursor:'pointer',
  },
  filterBar: {
    padding:'8px 12px', background:'#f8f8f8',
    borderBottom:'0.5px solid #eee',
  },
  filterGrid: {
    display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6,
  },
  filterItem:  { display:'flex', flexDirection:'column', gap:2 },
  filterLabel: {
    fontSize:9, color:'#aaa', fontWeight:500,
    letterSpacing:0.5, textTransform:'uppercase',
  },
  filterSelect: {
    padding:'5px 4px', borderRadius:6,
    border:'0.5px solid #ddd', fontSize:11,
    color:'#333', background:'#fff', width:'100%',
  },
  body: { padding:'10px 12px 0' },
  card: {
    background:'#fff', borderRadius:10,
    border:'0.5px solid #eee', overflow:'hidden',
  },
  tblHead: {
    display:'flex', padding:'8px 12px',
    background:'#f5f5f5', borderBottom:'0.5px solid #eee',
    alignItems:'center',
  },
  tblRow: {
    display:'flex', padding:'9px 12px',
    borderBottom:'0.5px solid #f5f5f5', alignItems:'center',
  },
  rankCol:    { width:22, fontSize:12, flexShrink:0 },
  numCol:     { width:48, textAlign:'right', fontSize:11, color:'#555', flexShrink:0 },
  playerName: { fontSize:13, fontWeight:500, color:'#222' },
  playerSub:  { fontSize:10, color:'#aaa', marginTop:1 },
  groupDivider: {
    padding:'6px 12px', fontSize:10, color:'#aaa',
    background:'#fafafa', borderBottom:'0.5px solid #f0f0f0',
    fontStyle:'italic',
  },
  pshipPair:   { display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' },
  pshipName:   { fontSize:13, color:'#222' },
  pshipAmp:    { fontSize:11, color:'#aaa' },
  pshipDetail: { fontSize:10, color:'#aaa', marginTop:2 },
  barTrack: {
    height:3, background:'#f0f0f0',
    borderRadius:2, marginTop:5, overflow:'hidden',
  },
  barFill: {
    height:3, background:ACCENT, borderRadius:2,
    transition:'width 0.3s ease',
  },
  empty: { textAlign:'center', padding:'28px 0', fontSize:13, color:'#ccc' },
};