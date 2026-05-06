import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');
const ACCENT = '#534AB7';

const INNINGS_OPTS  = ['All', '1', '2'];
const WINLOSS_OPTS  = ['All', 'Win', 'Loss'];
const POSITION_OPTS = ['All','1','2','3','4','5','6','7','8'];

const FILTER_CRITERIA = ['All','Season','Format','Ground','Bat Inning','Position','Result'];

function fmtOvers(val) {
  if (!val && val !== 0) return '-';
  const full  = Math.floor(val);
  const balls = Math.round((val - full) * 10);
  const actualBalls = Math.round(balls * 6 / 10);
  return actualBalls === 0 ? `${full}` : `${full}.${actualBalls}`;
}

const HL = { bg:'#534AB7', border:'#534AB7', text:'#fff' };

export default function MyCricket() {
  const { sportType, season, format, currentUser } = useApp();
  const sport = sportType.toLowerCase();

  const [selectedPlayer, setSelectedPlayer] = useState(currentUser);
  const [playerList,     setPlayerList]     = useState([]);
  const [activeTab,      setActiveTab]      = useState('stats');
  const [grounds,        setGrounds]        = useState(['All']);
  const [seasons,        setSeasons]        = useState(['All']);

  // Stats filters
  const [ground,    setGround]    = useState('All');
  const [batInning, setBatInning] = useState('All');
  const [batPos,    setBatPos]    = useState('All');
  const [winLoss,   setWinLoss]   = useState('All');

  // Data
  const [stats,        setStats]        = useState(null);
  const [recentForm,   setRecentForm]   = useState([]);
  const [partnerships, setPartnerships] = useState([]);

  // Partnership filters
  const [pshipInning, setPshipInning] = useState('All');
  const [pshipWicket, setPshipWicket] = useState('All');

  // Compare
  const [comparePlayer1, setComparePlayer1] = useState('');
  const [comparePlayer2, setComparePlayer2] = useState('');
  const [cmpCriteria1, setCmpCriteria1] = useState('All');
  const [cmpValue1,    setCmpValue1]    = useState('All');
  const [cmpCriteria2, setCmpCriteria2] = useState('All');
  const [cmpValue2,    setCmpValue2]    = useState('All');
  const [cmpStats1,      setCmpStats1]      = useState(null);
  const [cmpStats2,      setCmpStats2]      = useState(null);

  useEffect(() => {
    const list = engine.getPlayerList(sport);
    setPlayerList(list);
    if (!list.includes(selectedPlayer)) setSelectedPlayer(list[0] || '');
    const cfg = engine.loadConfig(sport);
    setGrounds(['All', ...(cfg.grounds || [])]);
    setSeasons(['All', ...(cfg.seasons || []).map(s => String(s))]);
    setGround('All');
  }, [sport]);

  // Reset compare value when criteria changes
  useEffect(() => { setCmpValue1('All'); }, [cmpCriteria1]);
  useEffect(() => { setCmpValue2('All'); }, [cmpCriteria2]);

function buildStatFilters() {
    const f = {};
    if (season    !== 'All') f.season          = season;
    if (format    !== 'All') f.format          = format;
    if (ground    !== 'All') f.ground          = ground;
    if (batInning !== 'All') f.batInning       = batInning;
    if (batPos    !== 'All') f.battingPosition = batPos;
    if (winLoss   !== 'All') f.winLoss         = winLoss;
    return f;
  }

  function buildCmpFilter1() {
    const f = {};
    if (cmpCriteria1 === 'Season'     && cmpValue1 !== 'All') f.season         = cmpValue1;
    if (cmpCriteria1 === 'Format'     && cmpValue1 !== 'All') f.format         = cmpValue1;
    if (cmpCriteria1 === 'Ground'     && cmpValue1 !== 'All') f.ground         = cmpValue1;
    if (cmpCriteria1 === 'Bat Inning' && cmpValue1 !== 'All') f.batInning      = cmpValue1;
    if (cmpCriteria1 === 'Position'   && cmpValue1 !== 'All') f.battingPosition= cmpValue1;
    if (cmpCriteria1 === 'Result'     && cmpValue1 !== 'All') f.winLoss        = cmpValue1;
    return f;
  }

  function buildCmpFilter2() {
    const f = {};
    if (cmpCriteria2 === 'Season'     && cmpValue2 !== 'All') f.season         = cmpValue2;
    if (cmpCriteria2 === 'Format'     && cmpValue2 !== 'All') f.format         = cmpValue2;
    if (cmpCriteria2 === 'Ground'     && cmpValue2 !== 'All') f.ground         = cmpValue2;
    if (cmpCriteria2 === 'Bat Inning' && cmpValue2 !== 'All') f.batInning      = cmpValue2;
    if (cmpCriteria2 === 'Position'   && cmpValue2 !== 'All') f.battingPosition= cmpValue2;
    if (cmpCriteria2 === 'Result'     && cmpValue2 !== 'All') f.winLoss        = cmpValue2;
    return f;
  }

  // Dynamic filter value options based on criteria
  function getValueOpts(criteria) {
    switch(criteria) {
      case 'Season':     return ['All', ...seasons.filter(s=>s!=='All')];
      case 'Format':     return ['All', 'T12', 'Test'];
      case 'Ground':     return ['All', ...grounds.filter(g=>g!=='All')];
      case 'Bat Inning': return ['All', '1', '2'];
      case 'Position':   return POSITION_OPTS;
      case 'Result':     return WINLOSS_OPTS;
      default:           return ['All'];
    }
  }
  const cmpValueOptions1 = useMemo(() => getValueOpts(cmpCriteria1), [cmpCriteria1, seasons, grounds]);
  const cmpValueOptions2 = useMemo(() => getValueOpts(cmpCriteria2), [cmpCriteria2, seasons, grounds]);

  useEffect(() => {
    if (!selectedPlayer) return;
    const filters = buildStatFilters();
    try { setStats(engine.getPlayerStats(sport, selectedPlayer, filters)); }
    catch(_) { setStats(null); }
    try { setRecentForm(engine.getPlayerRecentForm(sport, selectedPlayer, 10)); }
    catch(_) { setRecentForm([]); }
    try {
      const pfilters = {};
      if (statSeason  !== 'All') pfilters.season    = statSeason;
      if (statFormat  !== 'All') pfilters.format    = statFormat;
      if (pshipInning !== 'All') pfilters.batInning = pshipInning;
      if (pshipWicket !== 'All') pfilters.wicket    = pshipWicket;
      const pb = engine.getPartnershipLeaderboard(sport, pfilters, 'runs');
      setPartnerships(pb.filter(p =>
        p.player1 === selectedPlayer || p.player2 === selectedPlayer
      ).slice(0, 10));
    } catch(_) { setPartnerships([]); }
  }, [sport, season, format, selectedPlayer, ground, batInning, batPos, winLoss, pshipInning, pshipWicket]);

  // Auto-compare whenever players or filter changes
  useEffect(() => {
    const p1 = comparePlayer1 || selectedPlayer;
    const p2 = comparePlayer2 || selectedPlayer;
    try { setCmpStats1(engine.getPlayerStats(sport, p1, buildCmpFilter1())); } catch(_) { setCmpStats1(null); }
    try { setCmpStats2(engine.getPlayerStats(sport, p2, buildCmpFilter2())); } catch(_) { setCmpStats2(null); }
  }, [sport, comparePlayer1, comparePlayer2, selectedPlayer, cmpCriteria1, cmpValue1, cmpCriteria2, cmpValue2]);

  const ini = (v, suffix='') => (v != null && v !== undefined) ? `${v}${suffix}` : '-';
  const hasCaptaincy = stats && stats.captainMatches > 0;
  const hasAwards    = stats && (stats.momCount > 0 || (stats.mosCount||0) > 0);
  const TABS_LIST    = ['stats','partnerships','compare'];

  // Compare metrics
  const cmpMetrics = [
    { label:'Matches',    k1:'matches',    k2:'matches' },
    { label:'Runs',       k1:'runs',       k2:'runs' },
    { label:'Average',    k1:'average',    k2:'average' },
    { label:'Strike rate',k1:'strikeRate', k2:'strikeRate' },
    { label:'High score', k1:'highScore',  k2:'highScore', parse:true },
    { label:'Wickets',    k1:'wickets',    k2:'wickets' },
    { label:'Economy',    k1:'economy',    k2:'economy', lower:true },
    { label:'MVP total',  k1:'mvpTotal',   k2:'mvpTotal' },
    { label:'MoM awards', k1:'momCount',   k2:'momCount' },
  ];

  return (
    <div style={S.page}>

      {/* Player selector */}
      <div style={S.selectorBar}>
        <select
          value={selectedPlayer}
          onChange={e => setSelectedPlayer(e.target.value)}
          style={S.selectBlue}>
          {playerList.map(p => (
            <option key={p} value={p}>{p}{p===currentUser?' (me)':''}</option>
          ))}
        </select>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS_LIST.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            ...S.tab,
            color:       activeTab===t ? ACCENT : '#aaa',
            fontWeight:  activeTab===t ? 500 : 400,
            borderBottom:activeTab===t ? `2px solid ${ACCENT}` : '2px solid transparent',
          }}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* Stats filters */}
      {activeTab === 'stats' && (
        <div style={S.filterBar}>
          <div style={{...S.filterGrid, gridTemplateColumns:'repeat(4,1fr)'}}>
            <div style={S.filterItem}>
              <div style={S.filterLabel}>Ground</div>
              <select value={ground} onChange={e=>setGround(e.target.value)} style={S.filterSelect}>
                {grounds.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={S.filterItem}>
              <div style={S.filterLabel}>Bat inn</div>
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

            <Sec label="Matches · MVP per inning"/>
            <Grid5 items={[
              {n:ini(stats.matches),       l:'Matches'},
              {n:ini(stats.won),           l:'Won',      hl:HL},
              {n:ini(stats.mvpBatPerInn),  l:'MVP Bat'},
              {n:ini(stats.mvpBowlPerInn), l:'MVP Bowl'},
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
              {n:ini(stats.wickets),           l:'Wickets', hl:HL},
              {n:ini(stats.bowlingAvg),        l:'Average'},
              {n:ini(stats.bestFigures),       l:'Best'},
              {n:ini(stats.bowlingSR),         l:'Strike rate'},
              {n:ini(stats.economy),           l:'Economy'},
              {n:ini(stats.twoW),              l:'2W hauls'},
              {n:ini(stats.threeW),            l:'3W hauls'},
              {n:ini(stats.catches),           l:'Catches'},
              {n:ini((stats.runOutsDirect||0)+(stats.runOutsCombo||0)+(stats.stumpings||0)),
               l:'RunOut+St'},
            ]}/>

            {(hasCaptaincy || hasAwards) && (() => {
              const captItems = hasCaptaincy ? [
                {n:ini(stats.captainMatches), l:'Matches led'},
                {n:ini(stats.captainWins),    l:'Won', hl:(stats.captainWins||0)>0 ? HL : null},
                {n:stats.captainMatches > 0
                  ? ini(Math.round((stats.captainWins/stats.captainMatches)*100))+'%'
                  : '-',                      l:'Win %'},
              ] : [];
              const awardItems = hasAwards ? [
                {n:ini(stats.momCount),    l:'MoM', hl:(stats.momCount||0)>0    ? HL : null},
                {n:ini(stats.mosCount||0), l:'MoS', hl:(stats.mosCount||0)>0    ? HL : null},
              ] : [];
              const allItems = [...captItems, ...awardItems];
              const captFlex  = captItems.length;
              const awardFlex = awardItems.length;
              return (
                <>
                  <div style={S.dualSecRow}>
                    {hasCaptaincy && <div style={{...S.secLabel, flex:captFlex}}>Captaincy</div>}
                    {hasAwards && <div style={{...S.secLabel, flex:awardFlex, marginLeft:hasCaptaincy?4:0}}>Awards</div>}
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(5,minmax(0,1fr))', gap:5, marginBottom:4}}>
                    {Array.from({length:5}).map((_,i) => {
                      const item = allItems[i];
                      if (!item) return <div key={i}/>;
                      return (
                        <div key={i} style={{...S.statCard, background:item.hl?item.hl.bg:'#fff', borderColor:item.hl?item.hl.border:'#eee'}}>
                          <div style={{...S.statNum, color:item.hl?item.hl.text:'#111'}}>{item.n}</div>
                          <div style={{...S.statLbl, color:item.hl?item.hl.text:'#aaa'}}>{item.l}</div>
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
                {recentForm.map((r,i) => (
                  <div key={i} style={{
                    ...S.dot,
                    background: r.tied?'#888': r.won?'#3B6D11':'#993C1D',
                    color:'#fff',
                  }}>
                    {r.tied?'T': r.won?'W':'L'}
                  </div>
                ))}
              </div>
              {recentForm.map((r,i) => (
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
          <div style={S.inlineFilterBar}>
            <div style={S.filterItem}>
              <div style={S.filterLabel}>Bat inning</div>
              <select value={pshipInning} onChange={e=>setPshipInning(e.target.value)} style={S.filterSelect}>
                <option value="All">All</option>
                <option value="1">1st innings</option>
                <option value="2">2nd innings</option>
              </select>
            </div>
            <div style={S.filterItem}>
              <div style={S.filterLabel}>Wicket</div>
              <select value={pshipWicket} onChange={e=>setPshipWicket(e.target.value)} style={S.filterSelect}>
                <option value="All">All</option>
                {[1,2,3,4,5,6,7,8,9,10].map(w=>(
                  <option key={w} value={w}>{w}{w===1?'st':w===2?'nd':w===3?'rd':'th'} wicket</option>
                ))}
              </select>
            </div>
          </div>

          <Sec label={`${selectedPlayer}'s partnerships`}/>
          {partnerships.length===0 ? <Empty/> : (
            <div style={S.card}>
              {partnerships.map((p,i) => {
                const partner  = p.player1===selectedPlayer ? p.player2 : p.player1;
                const maxRuns  = partnerships[0]?.runs || 1;
                const barWidth = Math.round((p.runs / maxRuns) * 100);
                return (
                  <div key={i} style={S.pshipRow}>
                    <div style={{flex:1}}>
                      <div style={S.pshipName}>{partner}</div>
                      <div style={S.pshipDetail}>
                        {p.count} stand{p.count!==1?'s':''} · {p.balls} balls
                      </div>
                      <div style={S.barTrack}>
                        <div style={{...S.barFill, width:`${barWidth}%`}}/>
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

          {/* Player selectors */}
          <div style={S.cmpPlayerRow}>
            <div style={{flex:1}}>
              <div style={S.filterLabel}>Player 1</div>
              <select
                value={comparePlayer1 || selectedPlayer}
                onChange={e => setComparePlayer1(e.target.value)}
                style={S.select}>
                {playerList.map(p=>(
                  <option key={p} value={p}>{p}{p===currentUser?' (me)':''}</option>
                ))}
              </select>
            </div>
            <div style={S.cmpVs}>vs</div>
            <div style={{flex:1}}>
              <div style={S.filterLabel}>Player 2</div>
              <select
                value={comparePlayer2 || selectedPlayer}
                onChange={e => setComparePlayer2(e.target.value)}
                style={S.select}>
                {playerList.map(p=>(
                  <option key={p} value={p}>{p}{p===currentUser?' (me)':''}</option>
                ))}
              </select>
            </div>
          </div>

		  {/* Compare by — single criteria, individual values */}
          <div style={{marginBottom:10}}>
            <div style={S.filterLabel}>Compare by</div>
            <select
              value={cmpCriteria1}
              onChange={e => { setCmpCriteria1(e.target.value); setCmpCriteria2(e.target.value); }}
              style={{...S.filterSelect, width:'100%', marginBottom:8}}>
              {FILTER_CRITERIA.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            {cmpCriteria1 !== 'All' && (
              <div style={S.cmpPlayerRow}>
                <div style={{flex:1}}>
                  <div style={S.filterLabel}>P1 value</div>
                  <select
                    value={cmpValue1}
                    onChange={e=>setCmpValue1(e.target.value)}
                    style={S.filterSelect}>
                    {cmpValueOptions1.map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div style={{width:8}}/>
                <div style={{flex:1}}>
                  <div style={S.filterLabel}>P2 value</div>
                  <select
                    value={cmpValue2}
                    onChange={e=>setCmpValue2(e.target.value)}
                    style={S.filterSelect}>
                    {cmpValueOptions2.map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Compare results — auto updates */}
          <div style={S.card}>
            {/* Header row */}
            <div style={S.cmpHeader}>
              <span style={{color:ACCENT, fontWeight:500, fontSize:12}}>
                {comparePlayer1 || selectedPlayer}
              </span>
              <span style={{color:'#ccc', fontSize:10}}>vs</span>
              <span style={{color:'#185FA5', fontWeight:500, fontSize:12}}>
                {comparePlayer2 || selectedPlayer}
              </span>
            </div>

            {/* Metric rows with bars */}
            {cmpMetrics.map(({label, k1, k2, lower, parse}) => {
              const raw1 = cmpStats1?.[k1];
              const raw2 = cmpStats2?.[k2];
              const v1   = parse ? parseInt(raw1) || 0 : Number(raw1) || 0;
              const v2   = parse ? parseInt(raw2) || 0 : Number(raw2) || 0;
              const max  = Math.max(v1, v2, 0.001);
              // For lower-is-better (economy), flip bar logic
              const bar1 = lower
                ? (v2 > 0 ? Math.round((v2/max)*100) : 100)
                : Math.round((v1/max)*100);
              const bar2 = lower
                ? (v1 > 0 ? Math.round((v1/max)*100) : 100)
                : Math.round((v2/max)*100);
              const win1 = lower ? v1 < v2 : v1 > v2;
              const win2 = lower ? v2 < v1 : v2 > v1;

              return (
                <div key={label} style={S.cmpMetricRow}>
                  {/* Left side — value then bar below */}
                  <div style={S.cmpSide}>
                    <div style={S.cmpValLeft}>{raw1??'-'}</div>
                    <div style={S.cmpBarTrackLeft}>
                      <div style={{...S.cmpBarLeft, width:`${bar1}%`, background:ACCENT}}/>
                    </div>
                  </div>

                  {/* Label */}
                  <div style={S.cmpMetricLabel}>{label}</div>

                  {/* Right side — value then bar below */}
                  <div style={S.cmpSideRight}>
                    <div style={S.cmpValRight}>{raw2??'-'}</div>
                    <div style={S.cmpBarTrackRight}>
                      <div style={{...S.cmpBarRight, width:`${bar2}%`, background:'#185FA5'}}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Grid5({ items }) {
  return (
    <div style={S.grid5}>
      {items.map((item,i) => (
        <div key={i} style={{
          ...S.statCard,
          background:  item.hl ? item.hl.bg     : '#fff',
          borderColor: item.hl ? item.hl.border : '#eee',
        }}>
          <div style={{...S.statNum, color:item.hl?item.hl.text:'#111'}}>{item.n}</div>
          <div style={{...S.statLbl, color:item.hl?item.hl.text:'#aaa'}}>{item.l}</div>
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
  page:        { paddingBottom:16 },
  selectorBar: { padding:'10px 12px 6px', background:'#fff', borderBottom:'0.5px solid #eee' },
  select: {
    width:'100%', padding:'7px 8px', borderRadius:8,
    border:'0.5px solid #ddd', fontSize:12, color:'#222', background:'#fafafa',
  },
  selectBlue: {
    width:'100%', padding:'7px 8px', borderRadius:8,
    border:'1.5px solid #534AB7', fontSize:13, color:'#534AB7',
    background:'#EEEDFE', fontWeight:500,
  },
  tabBar: { display:'flex', background:'#fff', borderBottom:'0.5px solid #eee' },
  tab: {
    flex:1, padding:'9px 0', fontSize:12,
    border:'none', background:'none', cursor:'pointer',
    borderBottom:'2px solid transparent',
  },
  filterBar: {
    padding:'8px 12px', background:'#f8f8f8',
    borderBottom:'0.5px solid #eee',
  },
  inlineFilterBar: {
    display:'grid', gridTemplateColumns:'1fr 1fr',
    gap:6, padding:'8px 0 10px',
  },
  filterGrid: {
    display:'grid',
    gridTemplateColumns:'repeat(3,1fr)',
    gap:6,
  },
  filterItem:   { display:'flex', flexDirection:'column', gap:2 },
  filterLabel:  { fontSize:9, color:'#aaa', fontWeight:500, letterSpacing:0.5, textTransform:'uppercase' },
  filterSelect: {
    padding:'5px 4px', borderRadius:6,
    border:'0.5px solid #ddd', fontSize:11,
    color:'#333', background:'#fff', width:'100%',
  },
  body:    { padding:'10px 12px 0' },
  secLabel: {
    fontSize:10, fontWeight:500, color:'#888',
    letterSpacing:0.7, textTransform:'uppercase',
    margin:'12px 0 5px',
  },
  dualSecRow: { display:'flex', alignItems:'center', margin:'12px 0 5px' },
  grid5: {
    display:'grid',
    gridTemplateColumns:'repeat(5,minmax(0,1fr))',
    gap:5, marginBottom:4,
  },
  statCard: {
    borderRadius:8, border:'0.5px solid #eee',
    padding:'7px 4px', textAlign:'center', background:'#fff',
  },
  statNum: { fontSize:14, fontWeight:500, color:'#111', lineHeight:1.2 },
  statLbl: { fontSize:8, color:'#aaa', marginTop:2, lineHeight:1.2 },
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
  formId:    { fontSize:11, color:'#bbb', width:52, flexShrink:0 },
  formBat:   { flex:1, fontSize:12, fontWeight:500, color:'#222' },
  formBowl:  { fontSize:11, color:'#888' },
  momTrophy: { fontSize:12 },
  pshipRow: {
    display:'flex', alignItems:'center', padding:'10px 14px',
    borderBottom:'0.5px solid #f5f5f5',
  },
  pshipName:   { fontSize:13, fontWeight:500, color:'#222' },
  pshipDetail: { fontSize:11, color:'#aaa', marginTop:2 },
  pshipRuns:   { fontSize:15, fontWeight:500, color:'#222' },
  pshipSR:     { fontSize:11, color:'#aaa', marginTop:2 },
  barTrack: {
    height:3, background:'#f0f0f0', borderRadius:2,
    marginTop:6, overflow:'hidden',
  },
  barFill: {
    height:3, background:ACCENT, borderRadius:2,
    transition:'width 0.4s ease',
  },

  // Compare styles
  cmpPlayerRow: { display:'flex', gap:8, alignItems:'flex-end', marginBottom:10 },
  cmpVs: {
    fontSize:11, color:'#aaa', paddingBottom:8,
    flexShrink:0, width:16, textAlign:'center',
  },
  cmpHeader: {
    display:'flex', justifyContent:'space-between', alignItems:'center',
    padding:'10px 14px', borderBottom:'0.5px solid #f0f0f0',
    background:'#fafafa',
  },
  cmpMetricRow: {
    display:'flex', alignItems:'center',
    padding:'8px 10px', borderBottom:'0.5px solid #f5f5f5',
    gap:6,
  },
  cmpSide: {
    flex:1, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2,
  },
  cmpSideRight: {
    flex:1, display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2,
  },
  cmpValLeft: {
    fontSize:13, fontWeight:500, color:ACCENT, minWidth:28, textAlign:'right',
  },
  cmpValRight: {
    fontSize:13, fontWeight:500, color:'#185FA5', minWidth:28,
  },
  cmpMetricLabel: {
    fontSize:10, color:'#aaa', width:62, textAlign:'center',
    flexShrink:0, lineHeight:1.2,
  },
  cmpBarTrackLeft: {
    width:'100%', height:4, background:'#f0f0f0',
    borderRadius:2, overflow:'hidden',
    display:'flex', justifyContent:'flex-end',
  },
  cmpBarTrackRight: {
    width:'100%', height:4, background:'#f0f0f0',
    borderRadius:2, overflow:'hidden',
  },
  cmpBarLeft: {
    height:4, borderRadius:2,
    transition:'width 0.3s ease',
  },
  cmpBarRight: {
    height:4, borderRadius:2,
    transition:'width 0.3s ease',
  },

  empty: { textAlign:'center', padding:'28px 0', fontSize:13, color:'#ccc' },
};