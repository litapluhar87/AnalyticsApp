import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');
const ACCENT = '#27500A';

const PLAYER_COLORS = [
  '#185FA5','#993C1D','#534AB7','#0F6E56','#BA7517',
  '#712B13','#3C3489','#27500A','#633806','#0C447C',
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
  const [inningsSeasonRequired, setInningsSeasonRequired] = useState(false);

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
    setSelPlayers([...list]); // all selected by default
    setGrounds(['All', ...(cfg.grounds || [])]);
    setSeasons(cfg.seasons || []);
    try { setTeams(engine.getAllTeams(sport)); } catch(_) { setTeams(['All']); }
  }, [sport]);

  // When chart tab changes, reset to all players selected
  useEffect(() => {
    setSelPlayers([...playerList]);
  }, [chartTab]);

  function buildFilters(extra = {}) {
    const f = {};
    if (season    !== 'All') f.season         = season;
    if (format    !== 'All') f.format          = format;
    if (ground    !== 'All') f.ground          = ground;
    if (team      !== 'All') f.team            = team;
    if (result    !== 'All') f.winLoss         = result;
    if (batInning !== 'All') f.batInning       = batInning;
    if (position  !== 'All') f.battingPosition = position;
    return { ...f, ...extra };
  }

  useEffect(() => {
    // By innings requires season selection
    if (viewMode === 'innings' && season === 'All') {
      setInningsSeasonRequired(true);
      setChartData(null);
      return;
    }
    setInningsSeasonRequired(false);
    computeChartData();
  }, [sport, season, format, chartTab, viewMode, mvpComp,
      ground, team, result, batInning, position, selPlayers, playerList]);

  function getActivePlayers() {
    return selPlayers.length > 0 ? selPlayers : playerList;
  }

  function computeChartData() {
    try {
      if (chartTab === 'batmap') {
        const lb = engine.getBattingLeaderboard(sport, buildFilters(), 'runs');
        const filtered = selPlayers.length > 0
          ? lb.filter(p => selPlayers.includes(p.player))
          : lb;
        setChartData({
          type:'scatter', subtype:'batting',
          dots: filtered.map((p,i) => ({
            name:  p.player,
            color: PLAYER_COLORS[i % PLAYER_COLORS.length],
            x:     p.strikeRate || 0,
            y:     p.average    || 0,
            r:     Math.max(4, Math.min(14, p.innings || 1)),
          }))
        });
        return;
      }

      if (chartTab === 'bowlmap') {
        const lb = engine.getBowlingLeaderboard(sport, buildFilters(), 'wickets');
        const filtered = selPlayers.length > 0
          ? lb.filter(p => selPlayers.includes(p.player))
          : lb;
        setChartData({
          type:'scatter', subtype:'bowling',
          dots: filtered.map((p,i) => ({
            name:  p.player,
            color: PLAYER_COLORS[i % PLAYER_COLORS.length],
            x:     p.economy    || 0,
            y:     p.bowlingAvg || 0,
            r:     Math.max(4, Math.min(14, p.innings || 1)),
          }))
        });
        return;
      }

      const players  = getActivePlayers();
      const statKey  = chartTab === 'runs'    ? 'runs'
                     : chartTab === 'wickets' ? 'wickets'
                     : mvpComp;

      if (viewMode === 'total') {
        const bars = players.map((p, i) => {
          const st = engine.getPlayerStats(sport, p, buildFilters());
          const raw = Number(st?.[statKey]) || 0;
          return {
            player: p,
            value:  chartTab === 'mvp' ? Math.round(raw * 10) / 10 : raw,
            color:  PLAYER_COLORS[i % PLAYER_COLORS.length],
          };
        })
        .filter(b => b.value > 0)
        .sort((a,b) => b.value - a.value);
        setChartData({ type:'hbar', bars, statKey });
        return;
      }

      if (viewMode === 'season') {
        // Get all seasons that have data
        const allSns   = season !== 'All' ? [Number(season)] : seasons;
        const activeSns = allSns.filter(s => {
          return players.some(p => {
            const st = engine.getPlayerStats(sport, p, buildFilters({ season: s }));
            return st && (Number(st[statKey]) || 0) > 0;
          });
        });

        const playerData = players.map((p, i) => {
          const values = activeSns.map(s => {
            const st  = engine.getPlayerStats(sport, p, buildFilters({ season: s }));
            const raw = Number(st?.[statKey]) || 0;
            return chartTab === 'mvp' ? Math.round(raw * 10) / 10 : raw;
          });
          const total = values.reduce((a,b) => a+b, 0);
          return { player:p, total, color: PLAYER_COLORS[i % PLAYER_COLORS.length], values };
        })
        .filter(p => p.total > 0)
        .sort((a,b) => b.total - a.total);

        setChartData({
          type:'playerGrouped', viewMode:'season',
          players: playerData, seasons: activeSns, statKey
        });
        return;
      }

      if (viewMode === 'innings') {
        // Season must be selected — enforced above
        const sn = Number(season);
        // Get actual matches in this season
        const matches = engine.getMatches(sport, buildFilters());
        const matchNums = [...new Set(matches.map(m => m.matchNum))].sort((a,b)=>a-b);

        const playerData = players.map((p, i) => {
          // For each match, get 1st and 2nd innings separately
          const values = [];
          matchNums.forEach(mn => {
            const st1 = engine.getPlayerStats(sport, p, buildFilters({ matchNum: mn, batInning:'1' }));
            const st2 = engine.getPlayerStats(sport, p, buildFilters({ matchNum: mn, batInning:'2' }));
            const round = v => chartTab === 'mvp' ? Math.round(v * 10) / 10 : v;
            const v1  = round(Number(st1?.[statKey]) || 0);
            const v2  = round(Number(st2?.[statKey]) || 0);
            if (v1 > 0 || v2 > 0) {
              values.push({ label:`M${mn} I1`, value:v1 });
              values.push({ label:`M${mn} I2`, value:v2 });
            }
          });
          const total = values.reduce((a,b) => a + b.value, 0);
          return { player:p, total, color: PLAYER_COLORS[i % PLAYER_COLORS.length], values };
        })
        .filter(p => p.total > 0)
        .sort((a,b) => b.total - a.total);

        setChartData({
          type:'playerGrouped', viewMode:'innings',
          players: playerData, statKey
        });
        return;
      }
    } catch(e) {
      console.error(e);
      setChartData(null);
    }
  }

  function togglePlayer(p) {
    setSelPlayers(prev => {
      if (prev.includes(p)) {
        // Don't deselect if only one left
        if (prev.length === 1) return prev;
        return prev.filter(x => x !== p);
      }
      return [...prev, p];
    });
  }

  function selectAll()  { setSelPlayers([...playerList]); }
  function clearAll()   { setSelPlayers([playerList[0]]); }

  const showBatFilters   = chartTab === 'runs' || chartTab === 'mvp';
  const showPlayerFilter = true;
  const showViewMode     = chartTab !== 'batmap' && chartTab !== 'bowlmap';

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
            <button key={v.id}
              onClick={() => setViewMode(v.id)}
              style={{
                ...S.vmBtn,
                background: viewMode===v.id ? ACCENT : '#f0f0f0',
                color:      viewMode===v.id ? '#fff'  : '#555',
                opacity:    v.id==='innings' && season==='All' ? 0.5 : 1,
              }}>
              {v.label}
              {v.id==='innings' && season==='All' && ' *'}
            </button>
          ))}
          {inningsSeasonRequired && (
            <div style={S.inningsWarning}>
              * Select a season to use By Inning view
            </div>
          )}
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
	  
	  {/* Rotate hint */}
      <div style={S.rotateHint}>
        <span style={S.rotateText}>🔄Rotate phone for full view</span>
      </div>

      {/* Chart */}
      <div style={S.chartArea}>
        {inningsSeasonRequired
          ? <div style={S.warning}>Please select a season to view By Inning chart</div>
          : !chartData
            ? <div style={S.empty}>No data available</div>
            : <ChartRenderer data={chartData} isLandscape={false}/>
        }
      </div>

      {/* Rotate hint */}
      <div style={S.rotateHint}>
        <span style={S.rotateText}>🔄Rotate phone for full view</span>
      </div>

      {/* Player selector */}
      {showPlayerFilter && (
        <div style={S.playerFilter}>
          <div style={S.playerFilterHeader}>
            <span style={S.sectionLabel}>Players</span>
            <div style={{display:'flex', gap:8}}>
              <button onClick={selectAll} style={S.actionBtn}>All</button>
              <button onClick={clearAll}  style={S.actionBtn}>Clear</button>
            </div>
          </div>
          <div style={S.playerChips}>
            {playerList.map((p, i) => {
              const selected = selPlayers.includes(p);
              const color    = PLAYER_COLORS[i % PLAYER_COLORS.length];
              return (
                <button key={p} onClick={() => togglePlayer(p)} style={{
                  ...S.playerChip,
                  background:  selected ? color  : '#f5f5f5',
                  color:       selected ? '#fff' : '#555',
                  borderColor: selected ? color  : '#e0e0e0',
                }}>
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Landscape fullscreen */}
      {isLandscape && chartData && (
        <div style={S.overlay}>
          <div style={{width:'100%', height:'100%', overflowY:'auto', overflowX:'auto'}}>
            <ChartRenderer data={chartData} isLandscape={true}/>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Chart renderer ────────────────────────────────────────────────────────────
function ChartRenderer({ data, isLandscape }) {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const [containerW, setContainerW] = useState(300);
  const dpr = window.devicePixelRatio || 1;

  useEffect(() => {
    if (containerRef.current) {
      setContainerW(containerRef.current.offsetWidth || 300);
    }
  });

  // Calculate canvas dimensions
  const chartW = isLandscape
    ? window.innerWidth - 32
    : containerW - 8;

  const numPlayers = data?.players?.length || data?.bars?.length || data?.dots?.length || 1;
  const chartH = isLandscape
    ? window.innerHeight - 80
    : data?.type === 'hbar'
      ? Math.max(160, numPlayers * 26 + 20)
      : data?.type === 'playerGrouped'
        ? Math.max(200, numPlayers * 38 + 60)
        : 220;

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    const canvas  = canvasRef.current;
    canvas.width  = chartW * dpr;
    canvas.height = chartH * dpr;
    canvas.style.width  = `${chartW}px`;
    canvas.style.height = `${chartH}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, chartW, chartH);

    if      (data.type === 'scatter')       drawScatter(ctx, chartW, chartH, data);
    else if (data.type === 'hbar')          drawHBar(ctx, chartW, chartH, data);
    else if (data.type === 'playerGrouped') drawPlayerGrouped(ctx, chartW, chartH, data);
  }, [data, chartW, chartH, dpr]);

  return (
    <div ref={containerRef} style={{width:'100%'}}>
      <div style={{overflowX:'auto', overflowY:'visible', WebkitOverflowScrolling:'touch'}}>
        <canvas ref={canvasRef} style={{display:'block'}}/>
      </div>
      <Legend data={data}/>
    </div>
  );
}

function Legend({ data }) {
  return null;
}

// ── Drawing functions ─────────────────────────────────────────────────────────

function drawScatter(ctx, W, H, data) {
  const { dots, subtype } = data;
  if (!dots?.length) return;

  const padL = 48, padR = 20, padT = 24, padB = 38;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const xs = dots.map(d => d.x);
  const ys = dots.map(d => d.y);

  // Dynamic scaling
  const xSpread = Math.max(...xs) - Math.min(...xs) || 2;
  const ySpread = Math.max(...ys) - Math.min(...ys) || 2;
  const xPad = xSpread * 0.12;
  const yPad = ySpread * 0.15;

  // Bowl map: invert x axis (lower economy = right side = better)
  const minX = subtype === 'bowling'
    ? Math.max(0, Math.min(...xs) - xPad)
    : Math.max(0, Math.min(...xs) - xPad);
  const maxX = Math.max(...xs) + xPad;
  const minY = Math.max(0, Math.min(...ys) - yPad);
  const maxY = Math.max(...ys) + yPad;

  // For bowling: flip x so lower economy = right
  function px(x) {
    if (subtype === 'bowling') {
      // Invert: high economy maps to left, low economy to right
      return padL + (1 - (x-minX)/(maxX-minX||1)) * cW;
    }
    return padL + ((x-minX)/(maxX-minX||1)) * cW;
  }
  function py(y) {
    // Both: higher avg = top, lower = bottom
    // For bowling we want lower avg at top
    if (subtype === 'bowling') {
      return padT + ((y-minY)/(maxY-minY||1)) * cH; // lower avg = top
    }
    return padT + (1-(y-minY)/(maxY-minY||1)) * cH;
  }

  // Grid
  ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 1;
  [0,0.25,0.5,0.75,1].forEach(r => {
    const y = padT + r*cH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    const yVal = subtype === 'bowling'
      ? (minY + r*(maxY-minY)).toFixed(1)
      : (maxY - r*(maxY-minY)).toFixed(1);
    ctx.fillStyle = '#999'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(yVal, padL-4, y+3);
  });

  [0,0.25,0.5,0.75,1].forEach(r => {
    const x    = padL + r*cW;
    const xVal = subtype === 'bowling'
      ? (maxX - r*(maxX-minX)).toFixed(1)  // inverted labels
      : (minX + r*(maxX-minX)).toFixed(1);
    ctx.fillStyle = '#999'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(xVal, x, H-padB+14);
  });

  // Axis labels
  const xLabel = subtype === 'bowling' ? '← Economy (lower = better →)' : 'Strike rate';
  const yLabel = subtype === 'bowling' ? 'Avg (lower = better ↑)'        : 'Avg';
  ctx.fillStyle = '#555'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(xLabel, padL+cW/2, H-4);

  ctx.save();
  ctx.translate(12, padT+cH/2);
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
    ctx.strokeStyle = d.color; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.fillStyle = '#222';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.name, x, y-d.r-3);
  });
}

function drawHBar(ctx, W, H, data) {
  const { bars } = data;
  if (!bars?.length) return;

  const padL = 74, padR = 40, padT = 8, padB = 8;
  const cW   = W - padL - padR;
  const cH   = H - padT - padB;
  const barH = Math.max(18, Math.floor(cH / bars.length) - 3);
  const maxV = Math.max(...bars.map(b => b.value), 1);

  bars.forEach((b, i) => {
    const y    = padT + i*(barH+3);
    const barW = Math.max((b.value/maxV)*cW, 2);

    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(padL, y, barW, barH, 3);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.font = `${Math.min(12, barH-2)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(b.player, padL-5, y+barH/2+4);

    ctx.fillStyle = '#333';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(b.value, padL+barW+5, y+barH/2+4);
  });
}

function drawPlayerGrouped(ctx, W, H, data) {
  const { players, viewMode } = data;
  if (!players?.length) return;

  const padL = 30, padR = 14, padT = 22, padB = 44;
  const cW   = W - padL - padR;
  const cH   = H - padT - padB;

  const barsPerPlayer = players[0]?.values?.length || 1;
  const allVals = players.flatMap(p => p.values.map(v =>
    typeof v === 'object' ? v.value : v
  ));
  const maxVal = Math.max(...allVals, 1);

  const grpW   = cW / players.length;
  const barW   = Math.max(3, Math.min(18, (grpW * 0.88) / barsPerPlayer));
  const grpPad = (grpW - barW * barsPerPlayer) / 2;

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
      if (!val) return;
      const bH  = (val/maxVal)*cH;
      const x   = padL + gi*grpW + grpPad + bi*barW;
      const y   = padT + cH - bH;

      // Alternate brightness for innings within player
      const alpha = bi % 2 === 0 ? 'FF' : 'AA';
      ctx.fillStyle = p.color + alpha;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(barW-1,1), Math.max(bH,1), 2);
      ctx.fill();
    });

    // Player name
    const cx = padL + gi*grpW + grpW/2;
    ctx.fillStyle = '#333';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    const name = p.player.length > 7 ? p.player.slice(0,6)+'…' : p.player;
    ctx.fillText(name, cx, H-padB+14);

    // Total value
    ctx.fillStyle = '#666';
    ctx.font = '8px sans-serif';
    ctx.fillText(p.total, cx, H-padB+24);
  });

  // Season/inning sub-labels — show for first player as reference
  if (barsPerPlayer <= 8 && players[0]) {
    players[0].values.forEach((v, bi) => {
      const label = typeof v === 'object' ? (v.label || '') : `S${v}`;
      if (!label) return;
      const x = padL + grpPad + bi*barW + barW/2;
      ctx.fillStyle = '#bbb'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(label, x, H-padB+35);
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
    display:'flex', gap:6, padding:'8px 12px', flexWrap:'wrap',
    background:'#f8f8f8', borderBottom:'0.5px solid #eee',
  },
  inningsWarning: {
    width:'100%', fontSize:10, color:'#993C1D',
    paddingTop:2,
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
  chartArea:   { padding:'12px 12px 0' },
  rotateHint: {
    display:'flex', justifyContent:'center',
    padding:'8px 12px 4px',
  },
  rotateText: {
    display:'flex', alignItems:'center', gap:5,
    fontSize:11, color:'#555', fontWeight:500,
    background:'#f8f8f8', border:'0.5px solid #e0e0e0',
    borderRadius:16, padding:'5px 14px',
  },
  playerFilter: {
    padding:'10px 12px 12px',
    borderTop:'0.5px solid #eee',
  },
  playerFilterHeader: {
    display:'flex', alignItems:'center',
    justifyContent:'space-between', marginBottom:8,
  },
  sectionLabel: {
    fontSize:10, fontWeight:500, color:'#888',
    letterSpacing:0.7, textTransform:'uppercase',
  },
  playerChips: { display:'flex', flexWrap:'wrap', gap:5 },
  playerChip: {
    padding:'4px 10px', borderRadius:14, fontSize:11,
    border:'1px solid #e0e0e0', cursor:'pointer', fontWeight:500,
  },
  actionBtn: {
    padding:'3px 10px', borderRadius:6, fontSize:11,
    border:'0.5px solid #ddd', background:'#f5f5f5',
    color:'#555', cursor:'pointer',
  },
  overlay: {
    position:'fixed', top:0, left:0,
    width:'100vw', height:'100vh',
    background:'#fff', zIndex:999,
    overflowY:'auto', overflowX:'auto',
    padding:16,
    WebkitOverflowScrolling:'touch',
  },
  legend: {
    display:'flex', flexWrap:'wrap', gap:8, marginTop:8, paddingLeft:4,
  },
  legItem:  { display:'flex', alignItems:'center', gap:4 },
  legDot:   { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  legLabel: { fontSize:10, color:'#888' },
  warning: {
    textAlign:'center', padding:'30px 20px',
    fontSize:13, color:'#993C1D',
    background:'#FAECE7', borderRadius:10,
    margin:'0 0 8px',
  },
  empty: {
    textAlign:'center', padding:'40px 0',
    fontSize:13, color:'#ccc',
  },
};