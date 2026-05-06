import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  { id:'total',   label:'Total'       },
  { id:'season',  label:'By season'   },
  { id:'innings', label:'By inning'   },
];

const MVP_COMPONENTS = [
  { id:'mvpMomPerInn',  label:'Total MVP' },
  { id:'mvpBatPerInn',  label:'MVP Bat'   },
  { id:'mvpBowlPerInn', label:'MVP Bowl'  },
];

export default function Charts() {
  const { sportType, season, format } = useApp();
  const sport = sportType.toLowerCase();

  const [chartTab,    setChartTab]    = useState('runs');
  const [viewMode,    setViewMode]    = useState('total');
  const [mvpComp,     setMvpComp]     = useState('mvpMomPerInn');
  const [ground,      setGround]      = useState('All');
  const [team,        setTeam]        = useState('All');
  const [result,      setResult]      = useState('All');
  const [batInning,   setBatInning]   = useState('All');
  const [position,    setPosition]    = useState('All');
  const [selPlayers,  setSelPlayers]  = useState([]);
  const [playerList,  setPlayerList]  = useState([]);
  const [grounds,     setGrounds]     = useState(['All']);
  const [teams,       setTeams]       = useState(['All']);
  const [seasons,     setSeasons]     = useState([]);
  const [isLandscape, setIsLandscape] = useState(false);
  const [chartData,   setChartData]   = useState(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  // Orientation detection
  useEffect(() => {
    function checkOrientation() {
      // Only trigger landscape mode on actual mobile devices
      // Desktop browsers are always "landscape" by window ratio
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isLand   = window.innerWidth > window.innerHeight;
      setIsLandscape(isMobile && isLand);
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
    const cfg = engine.loadConfig(sport);
    const list = engine.getPlayerList(sport);
    setPlayerList(list);
    setSelPlayers([]);
    setGrounds(['All', ...(cfg.grounds || [])]);
    setSeasons(cfg.seasons || []);
    try { setTeams(engine.getAllTeams(sport)); } catch(_) { setTeams(['All']); }
  }, [sport]);

  function buildFilters(extraFilters = {}) {
    const f = {};
    if (season   !== 'All') f.season   = season;
    if (format   !== 'All') f.format   = format;
    if (ground   !== 'All') f.ground   = ground;
    if (team     !== 'All') f.team     = team;
    if (result   !== 'All') f.winLoss  = result;
    if (batInning !== 'All') f.batInning = batInning;
    if (position  !== 'All') f.battingPosition = position;
    return { ...f, ...extraFilters };
  }

  // Get active players — selected or top 8
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
          r:     Math.max(4, Math.min(14, p.wickets || 1)),
        }))});
        return;
      }

      // Column charts
      const players = getActivePlayers();
      const statKey = chartTab === 'runs'    ? 'runs'
                    : chartTab === 'wickets' ? 'wickets'
                    : mvpComp;

      if (viewMode === 'total') {
        const bars = players.map((p, i) => {
          const st = engine.getPlayerStats(sport, p, buildFilters());
          return {
            player: p,
            value:  st?.[statKey] || 0,
            color:  PLAYER_COLORS[i % PLAYER_COLORS.length],
          };
        }).sort((a,b) => b.value - a.value);
        setChartData({ type:'bar', viewMode:'total', bars, statKey });
        return;
      }

      if (viewMode === 'season') {
        const activeSns = season !== 'All' ? [Number(season)] : seasons;
        const series = players.map((p, i) => ({
          player: p,
          color:  PLAYER_COLORS[i % PLAYER_COLORS.length],
          values: activeSns.map(s => {
            const st = engine.getPlayerStats(sport, p, buildFilters({ season: s }));
            return st?.[statKey] || 0;
          }),
        }));
        setChartData({ type:'grouped', viewMode:'season', seasons: activeSns, series, statKey });
        return;
      }

      if (viewMode === 'innings') {
        const activeSns = season !== 'All' ? [Number(season)] : seasons;
        const labels = [];
        activeSns.forEach(s => { labels.push(`S${s} Inn1`); labels.push(`S${s} Inn2`); });
        const series = players.map((p, i) => ({
          player: p,
          color:  PLAYER_COLORS[i % PLAYER_COLORS.length],
          values: activeSns.flatMap(s => {
            const st1 = engine.getPlayerStats(sport, p, buildFilters({ season: s, batInning: '1' }));
            const st2 = engine.getPlayerStats(sport, p, buildFilters({ season: s, batInning: '2' }));
            return [st1?.[statKey] || 0, st2?.[statKey] || 0];
          }),
        }));
        setChartData({ type:'grouped', viewMode:'innings', seasons: labels, series, statKey });
        return;
      }
    } catch(_) { setChartData(null); }
  }

  function togglePlayer(p) {
    setSelPlayers(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  }

  const showBatFilters  = chartTab === 'runs'    || chartTab === 'mvp';
  const showPlayerFilter = chartTab !== 'batmap' && chartTab !== 'bowlmap';
  const showViewMode     = chartTab !== 'batmap' && chartTab !== 'bowlmap';

  const chartContent = (
    <ChartRenderer
      data={chartData}
      isLandscape={isLandscape}
    />
  );

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

      {/* View mode toggle */}
      {showViewMode && (
        <div style={S.viewModeRow}>
          {VIEW_MODES.map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)}
              style={{
                ...S.vmBtn,
                background:   viewMode===v.id ? ACCENT : '#f0f0f0',
                color:        viewMode===v.id ? '#fff'  : '#555',
              }}>
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* MVP component selector */}
      {chartTab === 'mvp' && (
        <div style={S.mvpRow}>
          {MVP_COMPONENTS.map(c => (
            <button key={c.id} onClick={() => setMvpComp(c.id)}
              style={{
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
          {showBatFilters && (
            <FilterCell label="Bat inn" value={batInning} set={setBatInning} opts={['All','1','2']}/>
          )}
          {showBatFilters && (
            <FilterCell label="Position" value={position} set={setPosition}
              opts={['All','1','2','3','4','5','6','7','8']}/>
          )}
        </div>
      </div>

      {/* Player multi-select */}
      {showPlayerFilter && (
        <div style={S.playerFilter}>
          <div style={S.filterLabel}>
            Players {selPlayers.length > 0 ? `(${selPlayers.length} selected)` : '(showing top 8)'}
            {selPlayers.length > 0 && (
              <button onClick={() => setSelPlayers([])} style={S.clearBtn}>Clear</button>
            )}
          </div>
          <div style={S.playerChips}>
            {playerList.map((p, i) => {
              const selected = selPlayers.includes(p);
              const color    = PLAYER_COLORS[
                selected ? selPlayers.indexOf(p) % PLAYER_COLORS.length : i % PLAYER_COLORS.length
              ];
              return (
                <button key={p} onClick={() => togglePlayer(p)} style={{
                  ...S.playerChip,
                  background:  selected ? color : '#f5f5f5',
                  color:       selected ? '#fff' : '#555',
                  borderColor: selected ? color : '#e0e0e0',
                }}>
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart area */}
      <div style={S.chartArea}>
        {!chartData ? (
          <div style={S.empty}>No data available</div>
        ) : (
          <>
            {chartContent}
            <div style={S.rotateHint}>
              ⤢ Rotate phone for full view
            </div>
          </>
        )}
      </div>

      {/* Landscape fullscreen overlay */}
      {isLandscape && chartData && (
        <div style={S.overlay}>
          <div style={S.overlayChart}>
            <ChartRenderer data={chartData} isLandscape={true}/>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Chart renderer ────────────────────────────────────────────────────────────

function ChartRenderer({ data, isLandscape }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (data.type === 'scatter') {
      drawScatter(ctx, W, H, data);
    } else if (data.type === 'bar') {
      drawBar(ctx, W, H, data);
    } else if (data.type === 'grouped') {
      drawGrouped(ctx, W, H, data);
    }
  }, [data, isLandscape]);

  const W = isLandscape ? window.innerWidth  - 32 : Math.min(320, window.innerWidth - 24);
  const H = isLandscape ? window.innerHeight - 60 : 220;

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ display:'block', margin:'0 auto', maxWidth:'100%' }}
      />
      {data && <Legend data={data}/>}
    </div>
  );
}

function Legend({ data }) {
  if (data.type === 'scatter') {
    return (
      <div style={S.legend}>
        {data.dots?.slice(0,8).map((d,i) => (
          <div key={i} style={S.legItem}>
            <div style={{...S.legDot, background:d.color}}/>
            <span style={S.legLabel}>{d.name}</span>
          </div>
        ))}
      </div>
    );
  }
  if (data.series) {
    return (
      <div style={S.legend}>
        {data.series.map((s,i) => (
          <div key={i} style={S.legItem}>
            <div style={{...S.legDot, background:s.color}}/>
            <span style={S.legLabel}>{s.player}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// ── Drawing functions ─────────────────────────────────────────────────────────

function drawScatter(ctx, W, H, data) {
  const { dots, subtype } = data;
  if (!dots?.length) return;

  const padL = 42, padR = 16, padT = 16, padB = 32;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const xs = dots.map(d => d.x);
  const ys = dots.map(d => d.y);
  const minX = Math.max(0, Math.min(...xs) - 5);
  const maxX = Math.max(...xs) + 5;
  const minY = Math.max(0, Math.min(...ys) - 2);
  const maxY = Math.max(...ys) + 2;

  function px(x) { return padL + ((x-minX)/(maxX-minX||1))*cW; }
  function py(y) { return padT + (1-(y-minY)/(maxY-minY||1))*cH; }

  // Grid
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  [0,0.25,0.5,0.75,1].forEach(r => {
    const y = padT + r * cH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    const val = (maxY - r*(maxY-minY)).toFixed(1);
    ctx.fillStyle = '#aaa'; ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, padL - 4, y + 3);
  });

  // Axis labels
  ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  const xLabel = subtype === 'bowling' ? 'Economy (lower better)' : 'Strike rate';
  ctx.fillText(xLabel, padL + cW/2, H - 4);

  // Y axis label
  ctx.save();
  ctx.translate(12, padT + cH/2);
  ctx.rotate(-Math.PI/2);
  const yLabel = subtype === 'bowling' ? 'Avg (lower better)' : 'Avg';
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  // Dots
  dots.forEach(d => {
    const x = px(d.x), y = py(d.y);
    ctx.beginPath();
    ctx.arc(x, y, d.r, 0, Math.PI*2);
    ctx.fillStyle = d.color + 'CC';
    ctx.fill();

    // Name label
    ctx.fillStyle = '#333';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.name, x, y - d.r - 3);
  });
}

function drawBar(ctx, W, H, data) {
  const { bars } = data;
  if (!bars?.length) return;

  const padL = 70, padR = 40, padT = 10, padB = 10;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const maxVal = Math.max(...bars.map(b => b.value), 1);
  const barH   = Math.floor(cH / bars.length) - 4;

  bars.forEach((b, i) => {
    const y    = padT + i * (barH + 4);
    const barW = (b.value / maxVal) * cW;

    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(padL, y, Math.max(barW, 2), barH, 3);
    ctx.fill();

    // Player name
    ctx.fillStyle = '#444';
    ctx.font = `${Math.min(11, barH)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(b.player, padL - 4, y + barH/2 + 4);

    // Value
    ctx.fillStyle = '#555';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(b.value, padL + barW + 4, y + barH/2 + 4);
  });
}

function drawGrouped(ctx, W, H, data) {
  const { seasons, series } = data;
  if (!seasons?.length || !series?.length) return;

  const padL = 28, padR = 10, padT = 16, padB = 32;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const allVals = series.flatMap(s => s.values);
  const maxVal  = Math.max(...allVals, 1);

  const grpW  = cW / seasons.length;
  const barW  = Math.max(2, Math.min(16, (grpW / series.length) - 2));
  const grpPad = (grpW - barW * series.length) / 2;

  // Grid lines
  [0, 0.25, 0.5, 0.75, 1].forEach(r => {
    const y = padT + r * cH;
    ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    const val = Math.round(maxVal * (1-r));
    ctx.fillStyle = '#aaa'; ctx.font = '8px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(val, padL - 3, y + 3);
  });

  // Bars
  series.forEach((s, si) => {
    s.values.forEach((v, gi) => {
      const bH  = (v / maxVal) * cH;
      const x   = padL + gi * grpW + grpPad + si * barW;
      const y   = padT + cH - bH;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.roundRect(x, y, barW - 1, Math.max(bH, 1), 2);
      ctx.fill();
    });
  });

  // X labels
  seasons.forEach((s, i) => {
    const x = padL + i * grpW + grpW/2;
    ctx.fillStyle = '#aaa'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
    const label = typeof s === 'number' ? `S${s}` : s;
    ctx.fillText(label, x, H - 8);
  });
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
  page: { paddingBottom:16 },
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
  playerFilter: {
    padding:'8px 12px 6px',
    background:'#fff', borderBottom:'0.5px solid #eee',
  },
  playerChips: {
    display:'flex', flexWrap:'wrap', gap:5, marginTop:5,
  },
  playerChip: {
    padding:'3px 10px', borderRadius:14, fontSize:11,
    border:'1px solid #e0e0e0', cursor:'pointer',
    fontWeight:500, transition:'all 0.15s',
  },
  clearBtn: {
    marginLeft:8, fontSize:10, color:ACCENT,
    background:'none', border:'none', cursor:'pointer',
    textDecoration:'underline', padding:0,
  },
  chartArea: {
    padding:'12px 12px 0',
  },
  rotateHint: {
    textAlign:'center', fontSize:10,
    color:'#aaa', marginTop:8,
  },
  overlay: {
    position:'fixed', top:0, left:0,
    width:'100vw', height:'100vh',
    background:'#fff', zIndex:999,
    display:'flex', alignItems:'center',
    justifyContent:'center',
    padding:16,
  },
  overlayChart: {
    width:'100%',
  },
  legend: {
    display:'flex', flexWrap:'wrap', gap:8,
    marginTop:8, paddingLeft:4,
  },
  legItem:  { display:'flex', alignItems:'center', gap:4 },
  legDot:   { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  legLabel: { fontSize:10, color:'#888' },
  empty: {
    textAlign:'center', padding:'40px 0',
    fontSize:13, color:'#ccc',
  },
};