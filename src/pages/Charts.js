import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');
const ACCENT = '#27500A';

const PLAYER_COLORS = [
  '#185FA5','#993C1D','#534AB7','#0F6E56','#BA7517',
  '#712B13','#3C3489','#27500A','#633806','#0C447C',
];

const CHART_TABS = [
  { id:'runs',    label:'Runs'     },
  { id:'wickets', label:'Wickets'  },
  { id:'mvp',     label:'MVP'      },
  { id:'batmap',  label:'Bat map'  },
  { id:'bowlmap', label:'Bowl map' },
];

const VIEW_MODES = [
  { id:'total',   label:'Total'     },
  { id:'season',  label:'By season' },
  { id:'innings', label:'By inning' },
];

const MVP_COMPONENTS = [
  { id:'mvpMomPerInn',  label:'Total MVP' },
  { id:'mvpBatPerInn',  label:'MVP Bat'   },
  { id:'mvpBowlPerInn', label:'MVP Bowl'  },
];

export default function Charts() {
  const { sportType, season, format } = useApp();
  const sport = sportType.toLowerCase();

  const [chartTab,   setChartTab]   = useState('runs');
  const [viewMode,   setViewMode]   = useState('total');
  const [mvpComp,    setMvpComp]    = useState('mvpMomPerInn');
  const [ground,     setGround]     = useState('All');
  const [team,       setTeam]       = useState('All');
  const [result,     setResult]     = useState('All');
  const [batInning,  setBatInning]  = useState('All');
  const [position,   setPosition]   = useState('All');
  const [selPlayers, setSelPlayers] = useState([]);
  const [playerList, setPlayerList] = useState([]);
  const [grounds,    setGrounds]    = useState(['All']);
  const [teams,      setTeams]      = useState(['All']);
  const [seasons,    setSeasons]    = useState([]);
  const [isLandscape,setIsLandscape]= useState(false);
  const [chartData,  setChartData]  = useState(null);

  // Mobile-only orientation detection
  useEffect(() => {
    function checkOrientation() {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsLandscape(isMobile && window.innerWidth > window.innerHeight);
    }
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  useEffect(() => {
    const cfg  = engine.loadConfig(sport);
    const list = engine.getPlayerList(sport);
    setPlayerList(list);
    setSelPlayers([]);
    setGrounds(['All', ...(cfg.grounds || [])]);
    setSeasons(cfg.seasons || []);
    try { setTeams(engine.getAllTeams(sport)); } catch(_) { setTeams(['All']); }
  }, [sport]);

  function buildFilters(extra = {}) {
    const f = {};
    if (season    !== 'All') f.season           = season;
    if (format    !== 'All') f.format            = format;
    if (ground    !== 'All') f.ground            = ground;
    if (team      !== 'All') f.team              = team;
    if (result    !== 'All') f.winLoss           = result;
    if (batInning !== 'All') f.batInning         = batInning;
    if (position  !== 'All') f.battingPosition   = position;
    return { ...f, ...extra };
  }

  function getActivePlayers() {
    if (selPlayers.length > 0) return selPlayers;
    try {
      const lb = chartTab === 'wickets'
        ? engine.getBowlingLeaderboard(sport, buildFilters(), 'wickets')
        : engine.getBattingLeaderboard(sport, buildFilters(), 'runs');
      return lb.slice(0, 8).map(p => p.player);
    } catch(_) { return playerList.slice(0, 8); }
  }

  useEffect(() => {
    computeChartData();
  }, [sport, season, format, chartTab, viewMode, mvpComp,
      ground, team, result, batInning, position, selPlayers]);

  function computeChartData() {
    try {
      if (chartTab === 'batmap') {
        const lb = engine.getBattingLeaderboard(sport, buildFilters(), 'runs');
        setChartData({ type:'scatter', subtype:'batting', dots: lb.map((p,i) => ({
          name:  p.player,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          x:     p.strikeRate || 0,
          y:     p.average    || 0,
          r:     Math.max(4, Math.min(14, p.innings || 1)),
          label: `${p.innings} inn`,
        }))});
        return;
      }

      if (chartTab === 'bowlmap') {
        const lb = engine.getBowlingLeaderboard(sport, buildFilters(), 'wickets');
        setChartData({ type:'scatter', subtype:'bowling', dots: lb.map((p,i) => ({
          name:  p.player,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          x:     p.economy    || 0,
          y:     p.bowlingAvg || 0,
          r:     Math.max(4, Math.min(14, p.innings || 1)),
          label: `${p.innings} inn`,
        }))});
        return;
      }

      const players  = getActivePlayers();
      const statKey  = chartTab === 'runs'    ? 'runs'
                     : chartTab === 'wickets' ? 'wickets'
                     : mvpComp;
      const activeSns = season !== 'All' ? [Number(season)] : seasons;

      if (viewMode === 'total') {
        // Sort by total value descending
        const bars = players.map((p, i) => {
          const st = engine.getPlayerStats(sport, p, buildFilters());
          return { player:p, value: st?.[statKey] || 0, color: PLAYER_COLORS[i % PLAYER_COLORS.length] };
        }).sort((a,b) => b.value - a.value);
        setChartData({ type:'hbar', bars, statKey });
        return;
      }

      if (viewMode === 'season') {
        // Group by player first, then seasons within each player
        // Sort players by their total value
        const playerTotals = players.map((p,i) => {
          const total = activeSns.reduce((s, sn) => {
            const st = engine.getPlayerStats(sport, p, buildFilters({ season: sn }));
            return s + (st?.[statKey] || 0);
          }, 0);
          return { player:p, total, color: PLAYER_COLORS[i % PLAYER_COLORS.length],
            values: activeSns.map(sn => {
              const st = engine.getPlayerStats(sport, p, buildFilters({ season: sn }));
              return { season: sn, value: st?.[statKey] || 0 };
            })
          };
        }).sort((a,b) => b.total - a.total);

        setChartData({ type:'playerGrouped', viewMode:'season', players: playerTotals,
          seasons: activeSns, statKey, scrollable: true });
        return;
      }

      if (viewMode === 'innings') {
        const playerTotals = players.map((p,i) => {
          const total = activeSns.reduce((s, sn) => {
            const st1 = engine.getPlayerStats(sport, p, buildFilters({ season:sn, batInning:'1' }));
            const st2 = engine.getPlayerStats(sport, p, buildFilters({ season:sn, batInning:'2' }));
            return s + (st1?.[statKey]||0) + (st2?.[statKey]||0);
          }, 0);
          const values = activeSns.flatMap(sn => {
            const st1 = engine.getPlayerStats(sport, p, buildFilters({ season:sn, batInning:'1' }));
            const st2 = engine.getPlayerStats(sport, p, buildFilters({ season:sn, batInning:'2' }));
            return [
              { label:`S${sn} I1`, value: st1?.[statKey]||0 },
              { label:`S${sn} I2`, value: st2?.[statKey]||0 },
            ];
          });
          return { player:p, total, color: PLAYER_COLORS[i % PLAYER_COLORS.length], values };
        }).sort((a,b) => b.total - a.total);

        setChartData({ type:'playerGrouped', viewMode:'innings', players: playerTotals,
          seasons: activeSns, statKey, scrollable: true });
        return;
      }
    } catch(_) { setChartData(null); }
  }

  function togglePlayer(p) {
    setSelPlayers(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  }

  const showBatFilters   = chartTab === 'runs'    || chartTab === 'mvp';
  const showPlayerFilter = chartTab !== 'batmap'  && chartTab !== 'bowlmap';
  const showViewMode     = chartTab !== 'batmap'  && chartTab !== 'bowlmap';

  return (
    <div style={S.page}>

      {/* Chart tabs */}
      <div style={S.chartTabRow}>
        {CHART_TABS.map(t => (
          <button key={t.id} onClick={() => setChartTab(t.id)}
            style={chartTab===t.id ? S.ctOn : S.ctOff}>
            {t.label}
          </button>
        ))}
      </div>

      {/* View mode */}
      {showViewMode && (
        <div style={S.viewModeRow}>
          {VIEW_MODES.map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)} style={{
              ...S.vmBtn,
              background: viewMode===v.id ? ACCENT : '#f0f0f0',
              color:      viewMode===v.id ? '#fff'  : '#555',
            }}>
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* MVP component */}
      {chartTab === 'mvp' && (
        <div style={S.mvpRow}>
          {MVP_COMPONENTS.map(c => (
            <button key={c.id} onClick={() => setMvpComp(c.id)} style={{
              ...S.vmBtn,
              background: mvpComp===c.id ? '#185FA5' : '#f0f0f0',
              color:      mvpComp===c.id ? '#fff'    : '#555',
            }}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={S.filterBar}>
        <div style={S.filterGrid}>
          <FilterCell label="Ground" value={ground} set={setGround} opts={grounds}/>
          <FilterCell label="Team"   value={team}   set={setTeam}   opts={teams}/>
          <FilterCell label="Result" value={result}  set={setResult} opts={['All','Win','Loss']}/>
          {showBatFilters && <>
            <FilterCell label="Bat inn"  value={batInning} set={setBatInning} opts={['All','1','2']}/>
            <FilterCell label="Position" value={position}  set={setPosition}
              opts={['All','1','2','3','4','5','6','7','8']}/>
          </>}
        </div>
      </div>

      {/* Chart area */}
      <div style={S.chartArea}>
        {!chartData
          ? <div style={S.empty}>No data available</div>
          : <ChartRenderer data={chartData} isLandscape={false}/>
        }
      </div>

      {/* Rotate hint */}
      <div style={S.rotateHint}>
        <RotateIcon/>
        <span style={S.rotateText}>Rotate phone for full view</span>
      </div>

      {/* Player selector — after chart */}
      {showPlayerFilter && (
        <div style={S.playerFilter}>
          <div style={S.playerFilterHeader}>
            <span style={S.filterLabel}>
              Select players {selPlayers.length > 0 ? `· ${selPlayers.length} selected` : '· showing top 8'}
            </span>
            {selPlayers.length > 0 && (
              <button onClick={() => setSelPlayers([])} style={S.clearBtn}>Clear</button>
            )}
          </div>
          <div style={S.playerChips}>
            {playerList.map((p, i) => {
              const selected = selPlayers.includes(p);
              const idx      = selected ? selPlayers.indexOf(p) : i;
              const color    = PLAYER_COLORS[idx % PLAYER_COLORS.length];
              return (
                <button key={p} onClick={() => togglePlayer(p)} style={{
                  ...S.playerChip,
                  background:  selected ? color   : '#f5f5f5',
                  color:       selected ? '#fff'  : '#555',
                  borderColor: selected ? color   : '#e0e0e0',
                }}>
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Landscape fullscreen overlay */}
      {isLandscape && chartData && (
        <div style={S.overlay}>
          <ChartRenderer data={chartData} isLandscape={true}/>
        </div>
      )}

    </div>
  );
}

// ── Rotate icon ───────────────────────────────────────────────────────────────
function RotateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{verticalAlign:'middle', marginRight:5}}>
      <rect x="4" y="6" width="10" height="14" rx="2"/>
      <path d="M18 8 C21 8 21 16 18 16" strokeDasharray="2 1"/>
      <polyline points="16 6 18 8 16 10"/>
    </svg>
  );
}

// ── Chart renderer ────────────────────────────────────────────────────────────
function ChartRenderer({ data, isLandscape }) {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const [containerW, setContainerW] = useState(320);

  useEffect(() => {
    if (containerRef.current) {
      setContainerW(containerRef.current.offsetWidth || 320);
    }
  }, [isLandscape]);

  const W = isLandscape ? window.innerWidth - 32 : containerW;
  const H = isLandscape ? window.innerHeight - 40
          : data?.type === 'hbar'         ? Math.max(180, (data.bars?.length || 1) * 28 + 20)
          : data?.type === 'playerGrouped'? Math.max(200, (data.players?.length || 1) * 40 + 40)
          : 220;

  // Pixel ratio for sharp rendering
  const dpr = window.devicePixelRatio || 1;

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    const canvas = canvasRef.current;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    if (data.type === 'scatter')       drawScatter(ctx, W, H, data);
    else if (data.type === 'hbar')     drawHBar(ctx, W, H, data);
    else if (data.type === 'playerGrouped') drawPlayerGrouped(ctx, W, H, data);
  }, [data, W, H, dpr]);

  return (
    <div ref={containerRef} style={{width:'100%', overflowX: data?.scrollable ? 'auto' : 'visible'}}>
      <canvas ref={canvasRef} style={{display:'block'}}/>
      <Legend data={data}/>
    </div>
  );
}

function Legend({ data }) {
  if (!data) return null;
  const items = data.type === 'scatter'
    ? data.dots?.map(d => ({ label: d.name, color: d.color }))
    : data.type === 'hbar'
      ? null
      : data.players?.map(p => ({ label: p.player, color: p.color }));

  if (!items?.length) return null;
  return (
    <div style={S.legend}>
      {items.map((item,i) => (
        <div key={i} style={S.legItem}>
          <div style={{...S.legDot, background:item.color}}/>
          <span style={S.legLabel}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Drawing functions ─────────────────────────────────────────────────────────

function drawScatter(ctx, W, H, data) {
  const { dots, subtype } = data;
  if (!dots?.length) return;

  const padL = 46, padR = 16, padT = 20, padB = 36;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const xs   = dots.map(d => d.x);
  const ys   = dots.map(d => d.y);
  // Dynamic scaling — don't start from zero
  const xPad = (Math.max(...xs) - Math.min(...xs)) * 0.1 || 2;
  const yPad = (Math.max(...ys) - Math.min(...ys)) * 0.1 || 2;
  const minX = Math.max(0, Math.min(...xs) - xPad);
  const maxX = Math.max(...xs) + xPad;
  const minY = Math.max(0, Math.min(...ys) - yPad);
  const maxY = Math.max(...ys) + yPad;

  function px(x) { return padL + ((x-minX)/(maxX-minX||1))*cW; }
  function py(y) { return padT + (1-(y-minY)/(maxY-minY||1))*cH; }

  // Grid lines
  ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 1;
  [0,0.25,0.5,0.75,1].forEach(r => {
    const y = padT + r*cH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    const val = (maxY - r*(maxY-minY)).toFixed(1);
    ctx.fillStyle = '#999'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(val, padL-4, y+3);
  });

  // X axis ticks
  [0,0.25,0.5,0.75,1].forEach(r => {
    const x   = padL + r*cW;
    const val = (minX + r*(maxX-minX)).toFixed(1);
    ctx.fillStyle = '#999'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(val, x, H-padB+14);
  });

  // Axis labels
  const xLabel = subtype === 'bowling' ? 'Economy (lower = better)' : 'Strike rate';
  const yLabel = subtype === 'bowling' ? 'Avg (lower = better)'     : 'Avg';
  ctx.fillStyle = '#666'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(xLabel, padL + cW/2, H - 4);

  ctx.save();
  ctx.translate(12, padT + cH/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  // Dots
  dots.forEach(d => {
    const x = px(d.x), y = py(d.y);
    ctx.beginPath();
    ctx.arc(x, y, d.r, 0, Math.PI*2);
    ctx.fillStyle = d.color + 'CC';
    ctx.fill();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.name, x, y - d.r - 3);
  });
}

function drawHBar(ctx, W, H, data) {
  const { bars } = data;
  if (!bars?.length) return;

  const padL = 72, padR = 36, padT = 8, padB = 8;
  const cW   = W - padL - padR;
  const cH   = H - padT - padB;
  const barH = Math.max(16, Math.floor(cH / bars.length) - 4);
  const maxV = Math.max(...bars.map(b => b.value), 1);

  bars.forEach((b, i) => {
    const y    = padT + i*(barH+4);
    const barW = (b.value/maxV)*cW;

    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(padL, y, Math.max(barW, 2), barH, 3);
    ctx.fill();

    // Player name
    ctx.fillStyle = '#333';
    ctx.font = `${Math.min(12, barH-2)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(b.player, padL-5, y+barH/2+4);

    // Value
    ctx.fillStyle = '#555';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(b.value, padL+barW+5, y+barH/2+4);
  });
}

function drawPlayerGrouped(ctx, W, H, data) {
  const { players, viewMode } = data;
  if (!players?.length) return;

  const padL = 28, padR = 12, padT = 20, padB = 40;
  const cW   = W - padL - padR;
  const cH   = H - padT - padB;

  // Each player gets a group; within group, one bar per season/inning
  const numGroups  = players.length;
  const barsPerGrp = players[0]?.values?.length || 1;
  const allVals    = players.flatMap(p => p.values.map(v => typeof v === 'object' ? v.value : v));
  const maxVal     = Math.max(...allVals, 1);

  const grpW   = cW / numGroups;
  const barW   = Math.max(3, Math.min(20, (grpW * 0.85) / barsPerGrp));
  const grpPad = (grpW - barW * barsPerGrp) / 2;

  // Grid lines
  [0,0.25,0.5,0.75,1].forEach(r => {
    const y = padT + r*cH;
    ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    ctx.fillStyle = '#999'; ctx.font = '8px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal*(1-r)), padL-3, y+3);
  });

  players.forEach((p, gi) => {
    p.values.forEach((v, bi) => {
      const val  = typeof v === 'object' ? v.value : v;
      const bH   = (val/maxVal)*cH;
      const x    = padL + gi*grpW + grpPad + bi*barW;
      const y    = padT + cH - bH;

      // Alternate shading within player group
      const alpha = bi % 2 === 0 ? 'FF' : 'BB';
      ctx.fillStyle = p.color + alpha;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(barW-1, 1), Math.max(bH, 1), 2);
      ctx.fill();
    });

    // Player name below
    const cx = padL + gi*grpW + grpW/2;
    ctx.fillStyle = '#444'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    // Truncate long names
    const name = p.player.length > 7 ? p.player.slice(0,6)+'…' : p.player;
    ctx.fillText(name, cx, H - padB + 14);
    ctx.fillStyle = '#888'; ctx.font = '8px sans-serif';
    ctx.fillText(p.total, cx, H - padB + 24);
  });

  // Season/inning labels at very bottom if space
  if (barsPerGrp <= 4 && players.length > 0) {
    players[0].values.forEach((v, bi) => {
      const label = typeof v === 'object' ? v.label || v.season : '';
      if (!label) return;
      // Show only for first player group as reference
      const x = padL + grpPad + bi*barW + barW/2;
      ctx.fillStyle = '#bbb'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(label, x, H - padB + 34);
    });
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────
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

const S = {
  page:        { paddingBottom:16 },
  chartTabRow: {
    display:'flex', overflowX:'auto', background:'#fff',
    borderBottom:'0.5px solid #eee', scrollbarWidth:'none',
  },
  ctOn: {
    padding:'9px 14px', fontSize:11, fontWeight:500, whiteSpace:'nowrap',
    color:ACCENT, border:'none', background:'none',
    borderBottom:`2px solid ${ACCENT}`, cursor:'pointer', flexShrink:0,
  },
  ctOff: {
    padding:'9px 14px', fontSize:11, whiteSpace:'nowrap',
    color:'#aaa', border:'none', background:'none',
    borderBottom:'2px solid transparent', cursor:'pointer', flexShrink:0,
  },
  viewModeRow: {
    display:'flex', gap:6, padding:'8px 12px',
    background:'#f8f8f8', borderBottom:'0.5px solid #eee',
  },
  mvpRow: {
    display:'flex', gap:6, padding:'6px 12px',
    background:'#f8f8f8', borderBottom:'0.5px solid #eee',
  },
  vmBtn: {
    flex:1, padding:'5px 4px', borderRadius:6,
    border:'none', fontSize:11, fontWeight:500, cursor:'pointer',
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
  chartArea: { padding:'12px 12px 0' },
  rotateHint: {
    display:'flex', alignItems:'center', justifyContent:'center',
    padding:'8px 12px 0', gap:4,
  },
  rotateText: { fontSize:13, color:'#333', fontWeight:500 },
  playerFilter: {
    padding:'10px 12px 8px',
    borderTop:'0.5px solid #eee',
  },
  playerFilterHeader: {
    display:'flex', alignItems:'center',
    justifyContent:'space-between', marginBottom:6,
  },
  playerChips: { display:'flex', flexWrap:'wrap', gap:5 },
  playerChip: {
    padding:'4px 10px', borderRadius:14, fontSize:11,
    border:'1px solid #e0e0e0', cursor:'pointer',
    fontWeight:500, transition:'all 0.15s',
  },
  clearBtn: {
    fontSize:11, color:ACCENT, background:'none',
    border:'none', cursor:'pointer', textDecoration:'underline',
  },
  overlay: {
    position:'fixed', top:0, left:0,
    width:'100vw', height:'100vh',
    background:'#fff', zIndex:999,
    display:'flex', alignItems:'center',
    justifyContent:'center', padding:16,
  },
  legend: {
    display:'flex', flexWrap:'wrap', gap:8, marginTop:8, paddingLeft:4,
  },
  legItem:  { display:'flex', alignItems:'center', gap:4 },
  legDot:   { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  legLabel: { fontSize:10, color:'#888' },
  empty: {
    textAlign:'center', padding:'40px 0',
    fontSize:13, color:'#ccc',
  },
};