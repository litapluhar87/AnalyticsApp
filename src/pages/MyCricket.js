import React, { useState, useEffect } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');
const ACCENT = '#534AB7';

const SEASONS  = ['All','S1','S2','S3','S4','S5','S6'];
const FORMATS  = ['All','T12','Test'];
const INNINGS  = ['All','1','2'];
const WINLOSS  = ['All','Win','Loss'];
const POSITIONS= ['All','1','2','3','4','5','6','7','8'];

export default function MyCricket() {
  const { sportType, currentUser } = useApp();
  const sport = sportType.toLowerCase();

  const [selectedPlayer, setSelectedPlayer] = useState(currentUser);
  const [playerList,     setPlayerList]     = useState([]);
  const [activeTab,      setActiveTab]      = useState('stats');

  // Filters
  const [season,   setSeason]   = useState('All');
  const [format,   setFormat]   = useState('All');
  const [ground,   setGround]   = useState('All');
  const [batInning,setBatInning]= useState('All');
  const [batPos,   setBatPos]   = useState('All');
  const [winLoss,  setWinLoss]  = useState('All');

  // Data
  const [stats,      setStats]      = useState(null);
  const [recentForm, setRecentForm] = useState([]);
  const [grounds,    setGrounds]    = useState(['All']);

  // Compare
  const [comparePlayer,  setComparePlayer]  = useState('');
  const [compareSeason1, setCompareSeason1] = useState('All');
  const [compareSeason2, setCompareSeason2] = useState('All');
  const [compareResult,  setCompareResult]  = useState(null);

  // Partnerships
  const [partnerships, setPartnerships] = useState([]);

  useEffect(() => {
    const list = engine.getPlayerList(sport);
    setPlayerList(list);
    if (!list.includes(selectedPlayer)) setSelectedPlayer(list[0] || '');
    const cfg = engine.loadConfig(sport);
    setGrounds(['All', ...(cfg.grounds || [])]);
  }, [sport]);

  useEffect(() => {
    if (!selectedPlayer) return;
    const filters = buildFilters();
    try { setStats(engine.getPlayerStats(sport, selectedPlayer, filters)); }
    catch(_) { setStats(null); }
    try { setRecentForm(engine.getPlayerRecentForm(sport, selectedPlayer, 7)); }
    catch(_) { setRecentForm([]); }
    try {
      const pb = engine.getPartnershipLeaderboard(sport, filters, 'runs');
      setPartnerships(pb.filter(p =>
        p.player1 === selectedPlayer || p.player2 === selectedPlayer
      ).slice(0, 10));
    } catch(_) { setPartnerships([]); }
  }, [sport, selectedPlayer, season, format, ground, batInning, batPos, winLoss]);

  function buildFilters() {
    const f = {};
    if (season    !== 'All') f.season           = season.replace('S','');
    if (format    !== 'All') f.format            = format;
    if (ground    !== 'All') f.ground            = ground;
    if (batInning !== 'All') f.batInning         = batInning;
    if (batPos    !== 'All') f.battingPosition   = batPos;
    if (winLoss   !== 'All') f.winLoss           = winLoss;
    return f;
  }

  function runCompare() {
    try {
      const f1 = compareSeason1 !== 'All' ? { season: compareSeason1.replace('S','') } : {};
      const f2 = compareSeason2 !== 'All' ? { season: compareSeason2.replace('S','') } : {};
      if (comparePlayer && comparePlayer !== selectedPlayer) {
        setCompareResult({
          label1: `${selectedPlayer} (${compareSeason1})`,
          label2: `${comparePlayer} (${compareSeason2})`,
          s1: engine.getPlayerStats(sport, selectedPlayer, f1),
          s2: engine.getPlayerStats(sport, comparePlayer,  f2),
        });
      } else {
        setCompareResult({
          label1: `${selectedPlayer} (${compareSeason1})`,
          label2: `${selectedPlayer} (${compareSeason2})`,
          s1: engine.getPlayerStats(sport, selectedPlayer, f1),
          s2: engine.getPlayerStats(sport, selectedPlayer, f2),
        });
      }
    } catch(_) { setCompareResult(null); }
  }

  const ini = (v, suffix='') => v != null ? `${v}${suffix}` : '-';

  return (
    <div style={S.page}>

      {/* Player selector */}
      <div style={S.selectorBar}>
        <select
          value={selectedPlayer}
          onChange={e => setSelectedPlayer(e.target.value)}
          style={S.select}>
          {playerList.map(p => (
            <option key={p} value={p}>{p}{p === currentUser ? ' (me)' : ''}</option>
          ))}
        </select>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {['stats','compare','partnerships'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ ...S.tab, ...(activeTab===t ? S.tabOn : {}) }}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'stats' && (
        <>
          {/* Filters */}
          <div style={S.filterBar}>
            <FilterRow label="Season"   items={SEASONS}   active={season}    set={setSeason}/>
            <FilterRow label="Format"   items={FORMATS}   active={format}    set={setFormat}/>
            <FilterRow label="Ground"   items={grounds}   active={ground}    set={setGround}/>
            <FilterRow label="Inning"   items={INNINGS}   active={batInning} set={setBatInning}/>
            <FilterRow label="Position" items={POSITIONS} active={batPos}    set={setBatPos}/>
            <FilterRow label="Result"   items={WINLOSS}   active={winLoss}   set={setWinLoss}/>
          </div>

          {!stats ? <Empty/> : (
            <div style={S.body}>
              <Sec label="Batting"/>
              <Grid4
                items={[
                  {n: ini(stats.runs),       l:'Runs'},
                  {n: ini(stats.average),    l:'Average'},
                  {n: ini(stats.strikeRate), l:'Strike rate'},
                  {n: ini(stats.highScore),  l:'High score'},
                  {n: ini(stats.fours),      l:'Fours'},
                  {n: ini(stats.sixes),      l:'Sixes'},
                  {n: ini(stats.innings),    l:'Innings'},
                  {n: ini(stats.notOuts),    l:'Not outs'},
                ]}/>

              <Sec label="Bowling"/>
              <Grid4
                items={[
                  {n: ini(stats.wickets),    l:'Wickets'},
                  {n: ini(stats.economy),    l:'Economy'},
                  {n: ini(stats.bowlingAvg), l:'Bowl avg'},
                  {n: ini(stats.oversBowled),l:'Overs'},
                ]}/>

              <Sec label="Fielding"/>
              <Grid4
                items={[
                  {n: ini(stats.catches),        l:'Catches'},
                  {n: ini(stats.stumpings),      l:'Stumpings'},
                  {n: ini(stats.runOutsDirect),  l:'Direct RO'},
                  {n: ini(stats.totalFielding),  l:'Total'},
                ]}/>

              <Sec label="MVP"/>
              <Grid4
                items={[
                  {n: ini(stats.mvpTotal),     l:'Total pts'},
                  {n: ini(stats.mvpPerInning), l:'Per inning'},
                  {n: ini(stats.mvpBat),       l:'Bat pts'},
                  {n: ini(stats.mvpBowl),      l:'Bowl pts'},
                  {n: ini(stats.mvpField),     l:'Field pts'},
                  {n: ini(stats.momCount),     l:'MoM count'},
                ]}/>

              <Sec label="Recent form"/>
              <div style={S.card}>
                <div style={S.formDots}>
                  {recentForm.map((r,i) => (
                    <div key={i} style={{
                      ...S.dot,
                      background: r.won ? '#3B6D11' : '#993C1D',
                      color:'#fff'
                    }}>
                      {r.won ? 'W' : 'L'}
                    </div>
                  ))}
                </div>
                {recentForm.map((r,i) => (
                  <div key={i} style={S.formRow}>
                    <span style={S.formId}>S{r.season} M{r.matchNum}</span>
                    <span style={S.formBat}>
                      {r.runs}{r.notOut?'*':''} ({r.balls}b)
                      {r.mom && <span style={S.momDot}>●</span>}
                    </span>
                    <span style={S.formBowl}>
                      {r.wickets}/{r.overs}ov
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'compare' && (
        <div style={S.body}>
          <Sec label="Compare players"/>
          <div style={S.card}>
            <div style={{padding:'10px 14px'}}>
              <div style={S.cmpLabel}>Player 1</div>
              <select value={selectedPlayer} disabled style={S.select}>
                <option>{selectedPlayer}</option>
              </select>
              <div style={{...S.cmpLabel, marginTop:8}}>Season</div>
              <PillRow items={SEASONS} active={compareSeason1} set={setCompareSeason1}/>

              <div style={{...S.cmpLabel, marginTop:12}}>Player 2</div>
              <select
                value={comparePlayer}
                onChange={e => setComparePlayer(e.target.value)}
                style={S.select}>
                <option value="">Same player (cross-season)</option>
                {playerList.filter(p=>p!==selectedPlayer).map(p=>(
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <div style={{...S.cmpLabel, marginTop:8}}>Season</div>
              <PillRow items={SEASONS} active={compareSeason2} set={setCompareSeason2}/>

              <button onClick={runCompare} style={S.cmpBtn}>Compare →</button>
            </div>
          </div>

          {compareResult && (
            <div style={S.card}>
              <div style={S.cmpHeader}>
                <span style={{color:ACCENT,fontWeight:500}}>{compareResult.label1}</span>
                <span style={{color:'#888',fontSize:11}}>vs</span>
                <span style={{color:'#185FA5',fontWeight:500}}>{compareResult.label2}</span>
              </div>
              {[
                ['Runs',       compareResult.s1?.runs,        compareResult.s2?.runs],
                ['Average',    compareResult.s1?.average,     compareResult.s2?.average],
                ['Strike rate',compareResult.s1?.strikeRate,  compareResult.s2?.strikeRate],
                ['Wickets',    compareResult.s1?.wickets,     compareResult.s2?.wickets],
                ['Economy',    compareResult.s1?.economy,     compareResult.s2?.economy],
                ['MVP total',  compareResult.s1?.mvpTotal,    compareResult.s2?.mvpTotal],
                ['MoM count',  compareResult.s1?.momCount,    compareResult.s2?.momCount],
              ].map(([label, v1, v2]) => (
                <div key={label} style={S.cmpRow}>
                  <span style={{...S.cmpVal, color:ACCENT}}>{v1 ?? '-'}</span>
                  <span style={S.cmpLbl}>{label}</span>
                  <span style={{...S.cmpVal, color:'#185FA5', textAlign:'right'}}>{v2 ?? '-'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'partnerships' && (
        <div style={S.body}>
          <Sec label={`${selectedPlayer}'s partnerships`}/>
          {partnerships.length === 0 ? <Empty/> : (
            <div style={S.card}>
              {partnerships.map((p,i) => {
                const partner = p.player1 === selectedPlayer ? p.player2 : p.player1;
                return (
                  <div key={i} style={S.pshipRow}>
                    <div style={{flex:1}}>
                      <div style={S.pshipName}>{partner}</div>
                      <div style={S.pshipDetail}>
                        {p.count} stand{p.count!==1?'s':''} · {p.balls} balls
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={S.pshipRuns}>{p.runs}</div>
                      <div style={S.pshipSR}>SR {p.strikeRate}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterRow({ label, items, active, set }) {
  return (
    <div style={{marginBottom:6}}>
      <div style={S.filterLabel}>{label}</div>
      <PillRow items={items} active={active} set={set}/>
    </div>
  );
}

function PillRow({ items, active, set }) {
  return (
    <div style={S.pillRow}>
      {items.map(item => (
        <button key={item} onClick={() => set(item)}
          style={active===item ? S.pillOn : S.pillOff}>
          {item}
        </button>
      ))}
    </div>
  );
}

function Grid4({ items }) {
  return (
    <div style={S.grid}>
      {items.map((item,i) => (
        <div key={i} style={S.statCard}>
          <div style={S.statNum}>{item.n}</div>
          <div style={S.statLbl}>{item.l}</div>
        </div>
      ))}
    </div>
  );
}

function Sec({ label }) {
  return <div style={S.secLabel}>{label}</div>;
}

function Empty() {
  return <div style={S.empty}>No data available</div>;
}

const S = {
  page:        { paddingBottom: 16 },
  selectorBar: { padding:'10px 12px 6px', background:'#fff', borderBottom:'0.5px solid #eee' },
  select: {
    width:'100%', padding:'8px 10px', borderRadius:8,
    border:'0.5px solid #ddd', fontSize:13, color:'#222',
    background:'#fafafa', marginTop:4,
  },
  tabBar: {
    display:'flex', background:'#fff',
    borderBottom:'0.5px solid #eee',
  },
  tab: {
    flex:1, padding:'9px 0', fontSize:12,
    color:'#888', border:'none', background:'none',
    cursor:'pointer', borderBottom:'2px solid transparent',
  },
  tabOn: { color:ACCENT, fontWeight:500, borderBottomColor:ACCENT },
  filterBar: { padding:'10px 12px 4px', background:'#f8f8f8', borderBottom:'0.5px solid #eee' },
  filterLabel:{ fontSize:10, color:'#aaa', fontWeight:500, letterSpacing:0.5,
                textTransform:'uppercase', marginBottom:4 },
  pillRow:    { display:'flex', flexWrap:'wrap', gap:5, marginBottom:2 },
  pillOn: {
    padding:'4px 11px', borderRadius:14, fontSize:11, fontWeight:500,
    background:ACCENT, color:'#fff', border:'none', cursor:'pointer', minHeight:28,
  },
  pillOff: {
    padding:'4px 11px', borderRadius:14, fontSize:11,
    background:'#efefef', color:'#666', border:'none', cursor:'pointer', minHeight:28,
  },
  body:       { padding:'10px 12px 0' },
  secLabel: {
    fontSize:10, fontWeight:500, color:'#aaa',
    letterSpacing:0.7, textTransform:'uppercase', margin:'12px 0 6px',
  },
  grid: { display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginBottom:4 },
  statCard: {
    background:'#fff', borderRadius:10,
    border:'0.5px solid #eee', padding:'10px 12px',
  },
  statNum:  { fontSize:19, fontWeight:500, color:'#111' },
  statLbl:  { fontSize:11, color:'#aaa', marginTop:2 },
  card: {
    background:'#fff', borderRadius:10,
    border:'0.5px solid #eee', overflow:'hidden', marginBottom:8,
  },
  formDots: { display:'flex', gap:5, padding:'10px 14px 6px', flexWrap:'wrap' },
  dot: {
    width:24, height:24, borderRadius:'50%',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:10, fontWeight:500,
  },
  formRow: {
    display:'flex', alignItems:'center', padding:'7px 14px',
    borderTop:'0.5px solid #f5f5f5', gap:8,
  },
  formId:   { fontSize:11, color:'#bbb', width:52, flexShrink:0 },
  formBat:  { flex:1, fontSize:12, fontWeight:500, color:'#222' },
  formBowl: { fontSize:11, color:'#888' },
  momDot:   { color:'#BA7517', fontSize:8, marginLeft:3 },
  cmpLabel: { fontSize:11, color:'#aaa', fontWeight:500, marginBottom:4 },
  cmpBtn: {
    width:'100%', marginTop:14, padding:'10px',
    borderRadius:8, border:'none', background:ACCENT,
    color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer',
  },
  cmpHeader: {
    display:'flex', justifyContent:'space-between', alignItems:'center',
    padding:'10px 14px', borderBottom:'0.5px solid #f0f0f0',
    fontSize:12,
  },
  cmpRow: {
    display:'flex', alignItems:'center', padding:'8px 14px',
    borderBottom:'0.5px solid #f5f5f5',
  },
  cmpVal: { width:70, fontSize:13, fontWeight:500 },
  cmpLbl: { flex:1, fontSize:11, color:'#aaa', textAlign:'center' },
  pshipRow: {
    display:'flex', alignItems:'center', padding:'10px 14px',
    borderBottom:'0.5px solid #f5f5f5',
  },
  pshipName:   { fontSize:13, fontWeight:500, color:'#222' },
  pshipDetail: { fontSize:11, color:'#aaa', marginTop:2 },
  pshipRuns:   { fontSize:15, fontWeight:500, color:'#222' },
  pshipSR:     { fontSize:11, color:'#aaa', marginTop:2 },
  empty: { textAlign:'center', padding:'28px 0', fontSize:13, color:'#ccc' },
};