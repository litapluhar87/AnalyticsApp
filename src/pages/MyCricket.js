import React, { useState, useEffect } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');
const ACCENT = '#534AB7';

const INNINGS_OPTS  = ['All', '1', '2'];
const WINLOSS_OPTS  = ['All', 'Win', 'Loss'];
const POSITION_OPTS = ['All','1','2','3','4','5','6','7','8'];

// Convert decimal overs to cricket notation e.g. 13.5 -> 13.3
function fmtOvers(val) {
  if (!val && val !== 0) return '-';
  const full    = Math.floor(val);
  const balls   = Math.round((val - full) * 10);
  // balls stored as tenths (0.5 = 3 balls out of 6)
  const actualBalls = Math.round(balls * 6 / 10);
  return actualBalls === 0 ? `${full}` : `${full}.${actualBalls}`;
}

// Highlight colors for My Cricket purple theme
const HL = { bg:'#534AB7', border:'#534AB7', text:'#fff' };

export default function MyCricket() {
  const { sportType, season, format, currentUser } = useApp();
  const sport = sportType.toLowerCase();

  const [selectedPlayer, setSelectedPlayer] = useState(currentUser);
  const [playerList,     setPlayerList]     = useState([]);
  const [activeTab,      setActiveTab]      = useState('stats');
  const [grounds,        setGrounds]        = useState(['All']);

  const [ground,    setGround]    = useState('All');
  const [batInning, setBatInning] = useState('All');
  const [batPos,    setBatPos]    = useState('All');
  const [winLoss,   setWinLoss]   = useState('All');
  const [pshipInning, setPshipInning] = useState('All');
  const [pshipWicket, setPshipWicket] = useState('All');
  

  const [stats,        setStats]        = useState(null);
  const [recentForm,   setRecentForm]   = useState([]);
  const [partnerships, setPartnerships] = useState([]);

  const [comparePlayer,  setComparePlayer]  = useState('');
  const [compareSeason1, setCompareSeason1] = useState('All');
  const [compareSeason2, setCompareSeason2] = useState('All');
  const [compareResult,  setCompareResult]  = useState(null);

  useEffect(() => {
    const list = engine.getPlayerList(sport);
    setPlayerList(list);
    if (!list.includes(selectedPlayer)) setSelectedPlayer(list[0] || '');
    const cfg = engine.loadConfig(sport);
    setGrounds(['All', ...(cfg.grounds || [])]);
    setGround('All');
  }, [sport]);

  function buildFilters() {
    const f = {};
    if (season    !== 'All') f.season         = season;
    if (format    !== 'All') f.format          = format;
    if (ground    !== 'All') f.ground          = ground;
    if (batInning !== 'All') f.batInning       = batInning;
    if (batPos    !== 'All') f.battingPosition = batPos;
    if (winLoss   !== 'All') f.winLoss         = winLoss;
    return f;
  }

  useEffect(() => {
    if (!selectedPlayer) return;
    const filters = buildFilters();
    try { setStats(engine.getPlayerStats(sport, selectedPlayer, filters)); }
    catch(_) { setStats(null); }
    try { setRecentForm(engine.getPlayerRecentForm(sport, selectedPlayer, 10)); }
    catch(_) { setRecentForm([]); }
	try {
      const pfilters = {};
      if (season      !== 'All') pfilters.season    = season;
      if (format      !== 'All') pfilters.format    = format;
      if (pshipInning !== 'All') pfilters.batInning = pshipInning;
      if (pshipWicket !== 'All') pfilters.wicket    = pshipWicket;
      const pb = engine.getPartnershipLeaderboard(sport, pfilters, 'runs');
      setPartnerships(pb.filter(p =>
        p.player1 === selectedPlayer || p.player2 === selectedPlayer
      ).slice(0, 10));
    } catch(_) { setPartnerships([]); }
  }, [sport, season, format, selectedPlayer, ground, batInning, batPos, winLoss, pshipInning, pshipWicket]);

  function runCompare() {
    try {
      const f1 = {};
      const f2 = {};
      if (compareSeason1 !== 'All') f1.season = compareSeason1.replace('S','');
      if (compareSeason2 !== 'All') f2.season = compareSeason2.replace('S','');
      const p2 = comparePlayer && comparePlayer !== selectedPlayer
        ? comparePlayer : selectedPlayer;
      setCompareResult({
        label1: `${selectedPlayer}${compareSeason1!=='All'?` (${compareSeason1})`:''}`,
        label2: `${p2}${compareSeason2!=='All'?` (${compareSeason2})`:''}`,
        s1: engine.getPlayerStats(sport, selectedPlayer, f1),
        s2: engine.getPlayerStats(sport, p2, f2),
      });
    } catch(_) { setCompareResult(null); }
  }

  const ini = (v, suffix='') => (v != null && v !== undefined) ? `${v}${suffix}` : '-';

  const hasCaptaincy = stats && stats.captainMatches > 0;
  const hasAwards    = stats && (stats.momCount > 0 || stats.mosCount > 0);

  const TABS_LIST = ['stats','partnerships','compare'];

  return (
    <div style={S.page}>

      <div style={S.selectorBar}>
        <select value={selectedPlayer} onChange={e=>setSelectedPlayer(e.target.value)} style={S.select}>
          {playerList.map(p=>(
            <option key={p} value={p}>{p}{p===currentUser?' (me)':''}</option>
          ))}
        </select>
      </div>

      <div style={S.tabBar}>
        {TABS_LIST.map(t=>(
          <button key={t} onClick={()=>setActiveTab(t)} style={{
            ...S.tab,
            color: activeTab===t ? ACCENT : '#aaa',
            fontWeight: activeTab===t ? 500 : 400,
            borderBottom: activeTab===t ? `2px solid ${ACCENT}` : '2px solid transparent',
          }}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

	  {activeTab === 'stats' && (
        <div style={S.filterBar}>
          <div style={S.filterGrid}>
            <div style={S.filterItem}>
              <div style={S.filterLabel}>Ground</div>
              <select value={ground} onChange={e=>setGround(e.target.value)} style={S.filterSelect}>
                {grounds.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={S.filterItem}>
              <div style={S.filterLabel}>Bat inning</div>
              <select value={batInning} onChange={e=>setBatInning(e.target.value)} style={S.filterSelect}>
                {INNINGS_OPTS.map(o=><option key={o} value={o}>{o==='All'?'All':o==='1'?'1st':'2nd'}</option>)}
              </select>
            </div>
            <div style={S.filterItem}>
              <div style={S.filterLabel}>Position</div>
              <select value={batPos} onChange={e=>setBatPos(e.target.value)} style={S.filterSelect}>
                {POSITION_OPTS.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={S.filterItem}>
              <div style={S.filterLabel}>Result</div>
              <select value={winLoss} onChange={e=>setWinLoss(e.target.value)} style={S.filterSelect}>
                {WINLOSS_OPTS.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── STATS TAB ── */}
      {activeTab==='stats' && (
        <div style={S.body}>
          {!stats ? <Empty/> : <>

            {/* Matches + MVP in one row */}
            <Sec label="Matches · MVP per inning"/>
            <Grid5 items={[
              {n:ini(stats.matches),        l:'Matches'},
              {n:ini(stats.won),            l:'Won',      hl:HL},
              {n:ini(stats.mvpBatPerInn),   l:'MVP Bat'},
              {n:ini(stats.mvpBowlPerInn),  l:'MVP Bowl'},
              {n:ini(stats.mvpMomPerInn),  l:'Total MVP', hl:HL},
            ]}/>

            <Sec label="Batting"/>
            <Grid5 items={[
              {n:ini(stats.innings),    l:'Innings'},
              {n:ini(stats.runs),       l:'Runs',        hl:HL},
              {n:ini(stats.average),    l:'Average'},
              {n:ini(stats.strikeRate), l:'Strike rate'},
              {n:ini(stats.highScore),  l:'High score'},
              {n:ini(stats.notOuts),    l:'Not outs'},
              {n:ini(stats.fours),      l:'Fours'},
              {n:ini(stats.sixes),      l:'Sixes'},
              {n:ini(stats.scores15),   l:'15+ scores'},
              {n:ini(stats.scores30),   l:'30+ scores'},
            ]}/>

            <Sec label="Bowling · Fielding"/>
            <Grid5 items={[
              {n:fmtOvers(stats.oversBowled), l:'Overs'},
              {n:ini(stats.wickets),          l:'Wickets', hl:HL},
              {n:ini(stats.bowlingAvg),       l:'Average'},
              {n:ini(stats.bestFigures),      l:'Best'},
              {n:ini(stats.bowlingSR),        l:'Strike rate'},
              {n:ini(stats.economy),          l:'Economy'},
              {n:ini(stats.twoW),             l:'2W hauls'},
              {n:ini(stats.threeW),           l:'3W hauls'},
              {n:ini(stats.catches),          l:'Catches'},
              {n:ini((stats.runOutsDirect||0)+(stats.runOutsCombo||0)+(stats.stumpings||0)),
               l:'RunOut+St'},
            ]}/>

            {/* Captaincy and Awards — conditional, same row */}
            {(hasCaptaincy || hasAwards) && (() => {
              const captItems = hasCaptaincy ? [
                {n:ini(stats.captainMatches), l:'Matches led'},
                {n:ini(stats.captainWins),    l:'Won', hl:HL},
                {n:stats.captainMatches > 0
                  ? ini(Math.round((stats.captainWins/stats.captainMatches)*100))+'%'
                  : '-',                      l:'Win %'},
              ] : [];

              const awardItems = hasAwards ? [
                {n:ini(stats.momCount),    l:'MoM', hl:HL},
                {n:ini(stats.mosCount||0), l:'MoS', hl:HL},
              ] : [];

              // Only show as many tiles as we have data for
              const allItems = [...captItems, ...awardItems];

              // Calculate flex ratios for section labels
              const captFlex  = captItems.length;
              const awardFlex = awardItems.length;

              return (
                <>
                  <div style={S.dualSecRow}>
                    {hasCaptaincy && (
                      <div style={{
                        ...S.secLabel,
                        flex: captFlex,
                      }}>
                        Captaincy
                      </div>
                    )}
                    {hasAwards && (
                      <div style={{
                        ...S.secLabel,
                        flex: awardFlex,
                        textAlign: 'left',
                        marginLeft: hasCaptaincy ? 4 : 0,
                      }}>
                        Awards
                      </div>
                    )}
                  </div>
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'repeat(5, minmax(0,1fr))',
                    gap:5,
                    marginBottom:4,
                  }}>
                    {Array.from({length:5}).map((_,i) => {
                      const item = allItems[i];
                      if (!item) return <div key={i}/>;
                      return (
                        <div key={i} style={{
                          ...S.statCard,
                          background:  item.hl ? item.hl.bg     : '#fff',
                          borderColor: item.hl ? item.hl.border : '#eee',
                        }}>
                          <div style={{
                            ...S.statNum,
                            color: item.hl ? item.hl.text : '#111',
                          }}>{item.n}</div>
                          <div style={{
                            ...S.statLbl,
                            color: item.hl ? item.hl.text : '#aaa',
                          }}>{item.l}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            <Sec label="Recent form"/>
            <div style={S.card}>
              <div style={S.formDots}>
                {recentForm.map((r,i)=>(
                  <div key={i} style={{
                    ...S.dot,
                    background: r.tied?'#888': r.won?'#3B6D11':'#993C1D',
                    color:'#fff',
                  }}>
                    {r.tied?'T': r.won?'W':'L'}
                  </div>
                ))}
              </div>
              {recentForm.map((r,i)=>(
                <div key={i} style={S.formRow}>
                  <span style={S.formId}>S{r.season} M{r.matchNum}</span>
                  <span style={S.formBat}>
                    {r.runs}{r.notOut?'*':''} ({r.balls})
                    {r.mom && <span style={S.momTrophy}> 🏆</span>}
                  </span>
                  <span style={S.formBowl}>{r.wickets}/{r.runsGiven}</span>
                </div>
              ))}
            </div>
          </>}
        </div>
      )}

	  {/* ── PARTNERSHIPS TAB ── */}
      {activeTab==='partnerships' && (
        <div style={S.body}>

          {/* Partnership filters */}
          <div style={{...S.filterBar, margin:'0 -12px 10px', padding:'8px 12px'}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6}}>
              <div style={S.filterItem}>
                <div style={S.filterLabel}>Bat inning</div>
                <select
                  value={pshipInning}
                  onChange={e=>setPshipInning(e.target.value)}
                  style={S.filterSelect}>
                  <option value="All">All</option>
                  <option value="1">1st innings</option>
                  <option value="2">2nd innings</option>
                </select>
              </div>
              <div style={S.filterItem}>
                <div style={S.filterLabel}>Wicket</div>
                <select
                  value={pshipWicket}
                  onChange={e=>setPshipWicket(e.target.value)}
                  style={S.filterSelect}>
                  <option value="All">All</option>
                  {[1,2,3,4,5,6,7,8,9,10].map(w=>(
                    <option key={w} value={w}>{w}{w===1?'st':w===2?'nd':w===3?'rd':'th'} wicket</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Sec label={`${selectedPlayer}'s partnerships`}/>
          {partnerships.length===0 ? <Empty/> : (
            <div style={S.card}>
              {partnerships.map((p,i)=>{
                const partner   = p.player1===selectedPlayer ? p.player2 : p.player1;
                const maxRuns   = partnerships[0]?.runs || 1;
                const barWidth  = Math.round((p.runs / maxRuns) * 100);
                return (
                  <div key={i} style={S.pshipRow}>
                    <div style={{flex:1}}>
                      <div style={S.pshipName}>{partner}</div>
                      <div style={S.pshipDetail}>
                        {p.count} stand{p.count!==1?'s':''} · {p.balls} balls
                      </div>
                      {/* Bar */}
                      <div style={S.barTrack}>
                        <div style={{
                          ...S.barFill,
                          width: `${barWidth}%`,
                        }}/>
                      </div>
                    </div>
                    <div style={{textAlign:'right', marginLeft:10, flexShrink:0}}>
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

      {/* ── COMPARE TAB ── */}
      {activeTab==='compare' && (
        <div style={S.body}>
          <Sec label="Compare players"/>
          <div style={S.card}>
            <div style={{padding:'10px 14px'}}>
              <div style={S.cmpPlayerRow}>
                <div style={{flex:1}}>
                  <div style={S.filterLabel}>Player 1</div>
                  <select value={selectedPlayer} disabled style={{...S.select,opacity:0.7}}>
                    <option>{selectedPlayer}</option>
                  </select>
                </div>
                <div style={S.cmpVs}>vs</div>
                <div style={{flex:1}}>
                  <div style={S.filterLabel}>Player 2</div>
                  <select value={comparePlayer} onChange={e=>setComparePlayer(e.target.value)} style={S.select}>
                    <option value="">Same (cross-season)</option>
                    {playerList.filter(p=>p!==selectedPlayer).map(p=>(
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={S.cmpPlayerRow}>
                <div style={{flex:1}}>
                  <div style={S.filterLabel}>Season 1</div>
                  <select value={compareSeason1} onChange={e=>setCompareSeason1(e.target.value)} style={S.select}>
                    {['All','3','4','5','6'].map(s=>(
                      <option key={s} value={s}>{s==='All'?'All':`S${s}`}</option>
                    ))}
                  </select>
                </div>
                <div style={S.cmpVs}></div>
                <div style={{flex:1}}>
                  <div style={S.filterLabel}>Season 2</div>
                  <select value={compareSeason2} onChange={e=>setCompareSeason2(e.target.value)} style={S.select}>
                    {['All','3','4','5','6'].map(s=>(
                      <option key={s} value={s}>{s==='All'?'All':`S${s}`}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={runCompare} style={S.cmpBtn}>Compare →</button>
            </div>
          </div>

          {compareResult && (
            <div style={S.card}>
              <div style={S.cmpHeader}>
                <span style={{color:ACCENT,fontWeight:500,fontSize:12}}>{compareResult.label1}</span>
                <span style={{color:'#aaa',fontSize:11}}>vs</span>
                <span style={{color:'#185FA5',fontWeight:500,fontSize:12}}>{compareResult.label2}</span>
              </div>
              {[
                ['Matches',    compareResult.s1?.matches,    compareResult.s2?.matches],
                ['Runs',       compareResult.s1?.runs,       compareResult.s2?.runs],
                ['Average',    compareResult.s1?.average,    compareResult.s2?.average],
                ['Strike rate',compareResult.s1?.strikeRate, compareResult.s2?.strikeRate],
                ['Wickets',    compareResult.s1?.wickets,    compareResult.s2?.wickets],
                ['Economy',    compareResult.s1?.economy,    compareResult.s2?.economy],
                ['MVP total',  compareResult.s1?.mvpTotal,   compareResult.s2?.mvpTotal],
                ['MoM count',  compareResult.s1?.momCount,   compareResult.s2?.momCount],
              ].map(([label,v1,v2])=>(
                <div key={label} style={S.cmpRow}>
                  <span style={{...S.cmpVal,color:ACCENT}}>{v1??'-'}</span>
                  <span style={S.cmpLbl}>{label}</span>
                  <span style={{...S.cmpVal,color:'#185FA5',textAlign:'right'}}>{v2??'-'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Grid5({ items }) {
  return (
    <div style={S.grid5}>
      {items.map((item,i) => item ? (
        <div key={i} style={{
          ...S.statCard,
          background: item.hl ? item.hl.bg   : '#fff',
          borderColor:item.hl ? item.hl.border: '#eee',
        }}>
          <div style={{
            ...S.statNum,
            color: item.hl ? item.hl.text : '#111',
          }}>{item.n}</div>
          <div style={{
            ...S.statLbl,
            color: item.hl ? item.hl.text : '#aaa',
          }}>{item.l}</div>
        </div>
      ) : <div key={i}/>)}
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
  page:        { paddingBottom:16 },
  selectorBar: { padding:'10px 12px 6px', background:'#fff', borderBottom:'0.5px solid #eee' },
  select: {
    width:'100%', padding:'7px 8px', borderRadius:8,
    border:'0.5px solid #ddd', fontSize:12, color:'#222',
    background:'#fafafa',
  },
  tabBar: { display:'flex', background:'#fff', borderBottom:'0.5px solid #eee' },
  tab: {
    flex:1, padding:'9px 0', fontSize:12,
    border:'none', background:'none', cursor:'pointer',
    borderBottom:'2px solid transparent',
  },
  filterBar:   { padding:'8px 12px', background:'#f8f8f8', borderBottom:'0.5px solid #eee' },
  filterGrid:  { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 },
  filterItem:  { display:'flex', flexDirection:'column', gap:2 },
  filterLabel: { fontSize:9, color:'#aaa', fontWeight:500, letterSpacing:0.5, textTransform:'uppercase' },
  filterSelect:{ padding:'4px 4px', borderRadius:6, border:'0.5px solid #ddd', fontSize:11, color:'#333', background:'#fff', width:'100%' },
  body:    { padding:'10px 12px 0' },
  secLabel: {
    fontSize:10, fontWeight:500, color:'#888',
    letterSpacing:0.7, textTransform:'uppercase',
    margin:'12px 0 5px',
  },
  dualSecRow: {
    display:'flex', alignItems:'center',
    margin:'12px 0 5px',
  },
  grid5: {
    display:'grid',
    gridTemplateColumns:'repeat(5,minmax(0,1fr))',
    gap:5, marginBottom:4,
  },
  statCard: {
    borderRadius:8, border:'0.5px solid #eee',
    padding:'7px 4px', textAlign:'center',
    background:'#fff',
  },
  statNum:  { fontSize:14, fontWeight:500, color:'#111', lineHeight:1.2 },
  statLbl:  { fontSize:8, color:'#aaa', marginTop:2, lineHeight:1.2 },
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
  momTrophy:{ fontSize:12 },
  pshipRow: { display:'flex', alignItems:'center', padding:'10px 14px', borderBottom:'0.5px solid #f5f5f5' },
  pshipName:   { fontSize:13, fontWeight:500, color:'#222' },
  pshipDetail: { fontSize:11, color:'#aaa', marginTop:2 },
  pshipRuns:   { fontSize:15, fontWeight:500, color:'#222' },
  pshipSR:     { fontSize:11, color:'#aaa', marginTop:2 },
  barTrack: {
    height: 3,
    background: '#f0f0f0',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    background: ACCENT,
    borderRadius: 2,
    transition: 'width 0.4s ease',
  },
  cmpPlayerRow:{ display:'flex', gap:8, alignItems:'flex-end', marginBottom:10 },
  cmpVs: { fontSize:11, color:'#aaa', paddingBottom:8, flexShrink:0, width:16, textAlign:'center' },
  cmpBtn: {
    width:'100%', marginTop:8, padding:'10px',
    borderRadius:8, border:'none', background:ACCENT,
    color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer',
  },
  cmpHeader: {
    display:'flex', justifyContent:'space-between', alignItems:'center',
    padding:'10px 14px', borderBottom:'0.5px solid #f0f0f0',
  },
  cmpRow: { display:'flex', alignItems:'center', padding:'8px 14px', borderBottom:'0.5px solid #f5f5f5' },
  cmpVal: { width:70, fontSize:13, fontWeight:500 },
  cmpLbl: { flex:1, fontSize:11, color:'#aaa', textAlign:'center' },
  empty: { textAlign:'center', padding:'28px 0', fontSize:13, color:'#ccc' },
};