import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');
const ACCENT = '#27500A';

const SEASONS = ['All','S3','S4','S5','S6'];
const FORMATS = ['All','T12','Test'];

const CHART_TABS = [
  { id:'runs',         label:'Runs trend' },
  { id:'avgsr',        label:'Avg vs SR' },
  { id:'wickets',      label:'Wickets' },
  { id:'economy',      label:'Economy' },
  { id:'mvp',          label:'MVP' },
  { id:'winloss',      label:'Win/Loss' },
  { id:'partnerships', label:'Partnerships' },
];

const PLAYER_COLORS = [
  '#378ADD','#3B6D11','#BA7517','#993C1D','#534AB7',
  '#0F6E56','#854F0B','#712B13','#185FA5','#27500A',
];

export default function Charts() {
  const { sportType } = useApp();
  const sport = sportType.toLowerCase();

  const [chartTab, setChartTab] = useState('runs');
  const [season,   setSeason]   = useState('All');
  const [format,   setFormat]   = useState('All');
  const [data,     setData]     = useState(null);

  useEffect(() => { loadChartData(); }, [sport, chartTab, season, format]);

  function buildFilters() {
    const f = {};
    if (season !== 'All') f.season = season.replace('S','');
    if (format !== 'All') f.format = format;
    return f;
  }

  function loadChartData() {
    const f = buildFilters();
    try {
      const cfg = engine.loadConfig(sport);
      const seasons = cfg.seasons || [3,4,5,6];

      if (chartTab === 'runs') {
        const top5 = engine.getBattingLeaderboard(sport, {}, 'runs').slice(0,5);
        const series = top5.map((p,i) => ({
          name: p.player,
          color: PLAYER_COLORS[i],
          values: seasons.map(s => {
            const st = engine.getPlayerStats(sport, p.player, { season: s });
            return st?.runs || 0;
          }),
        }));
        setData({ type:'line', seasons: seasons.map(s=>`S${s}`), series });
      }

      else if (chartTab === 'wickets') {
        const top5 = engine.getBowlingLeaderboard(sport, {}, 'wickets').slice(0,5);
        const series = top5.map((p,i) => ({
          name: p.player,
          color: PLAYER_COLORS[i],
          values: seasons.map(s => {
            const st = engine.getPlayerStats(sport, p.player, { season: s });
            return st?.wickets || 0;
          }),
        }));
        setData({ type:'line', seasons: seasons.map(s=>`S${s}`), series });
      }

      else if (chartTab === 'mvp') {
        const top3 = engine.getMVPLeaderboard(sport, {}, 'totalPoints').slice(0,3);
        const series = top3.map((p,i) => ({
          name: p.player,
          color: PLAYER_COLORS[i],
          values: seasons.map(s => {
            const st = engine.getPlayerStats(sport, p.player, { season: s });
            return st?.mvpTotal || 0;
          }),
        }));
        setData({ type:'line', seasons: seasons.map(s=>`S${s}`), series });
      }

      else if (chartTab === 'avgsr') {
        const players = engine.getBattingLeaderboard(sport, f, 'runs');
        const dots = players.map((p,i) => ({
          name:  p.player,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          x:     p.strikeRate,
          y:     p.average,
          r:     Math.max(4, Math.min(12, p.innings)),
        }));
        setData({ type:'scatter', dots });
      }

      else if (chartTab === 'economy') {
        const bowlers = engine.getBowlingLeaderboard(sport, f, 'economy').slice(0,8);
        setData({
          type: 'bar',
          labels: bowlers.map(p => p.player),
          values: bowlers.map(p => p.economy),
          color:  '#185FA5',
        });
      }

      else if (chartTab === 'winloss') {
        const cfg2  = engine.loadConfig(sport);
        const gnds  = cfg2.grounds || [];
        const bars  = gnds.map(g => {
          const ms = engine.getMatches(sport, { ...f, ground: g });
          const wins = ms.filter(m => m.winner && m.winner !== 'Tie').length;
          return { label: g, wins, losses: ms.length - wins };
        }).filter(g => g.wins + g.losses > 0);
        setData({ type:'grouped', bars });
      }

      else if (chartTab === 'partnerships') {
        const top8 = engine.getPartnershipLeaderboard(sport, f, 'runs').slice(0,8);
        setData({
          type:   'bar',
          labels: top8.map(p => `${p.player1} & ${p.player2}`),
          values: top8.map(p => p.runs),
          color:  ACCENT,
        });
      }
    } catch(_) { setData(null); }
  }

  return (
    <div style={S.page}>

      {/* Chart tab scroll */}
      <div style={S.chartTabRow}>
        {CHART_TABS.map(t => (
          <button key={t.id} onClick={() => setChartTab(t.id)}
            style={chartTab===t.id ? S.ctOn : S.ctOff}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={S.filterBar}>
        <PillRow label="Season" items={SEASONS} active={season} set={setSeason}/>
        <PillRow label="Format" items={FORMATS} active={format} set={setFormat}/>
      </div>

      {/* Chart */}
      <div style={S.body}>
        <div style={S.card}>
          <div style={S.chartTitle}>{CHART_TABS.find(t=>t.id===chartTab)?.label}</div>
          {!data
            ? <Empty/>
            : data.type === 'line'
              ? <LineChart data={data}/>
              : data.type === 'scatter'
                ? <ScatterChart data={data}/>
                : data.type === 'grouped'
                  ? <GroupedBar data={data}/>
                  : <BarChart data={data}/>
          }
        </div>
      </div>
    </div>
  );
}

// ── Chart components ──────────────────────────────────────────────────────────

function LineChart({ data }) {
  const { seasons, series } = data;
  if (!series?.length) return <Empty/>;

  const allVals = series.flatMap(s => s.values);
  const maxVal  = Math.max(...allVals, 1);
  const W = 300, H = 160, padL = 30, padB = 24, padT = 10, padR = 10;
  const chartW = W - padL - padR;
  const chartH = H - padB - padT;

  function x(i)   { return padL + (i / (seasons.length-1)) * chartW; }
  function y(val) { return padT + (1 - val/maxVal) * chartH; }

  return (
    <div style={{overflowX:'auto'}}>
      <svg width={W} height={H} style={{display:'block',margin:'0 auto'}}>
        {/* Grid lines */}
        {[0,0.25,0.5,0.75,1].map((r,i) => (
          <g key={i}>
            <line x1={padL} y1={padT+r*chartH} x2={W-padR} y2={padT+r*chartH}
              stroke="#f0f0f0" strokeWidth={1}/>
            <text x={padL-4} y={padT+r*chartH+4} textAnchor="end"
              fontSize={9} fill="#ccc">
              {Math.round(maxVal*(1-r))}
            </text>
          </g>
        ))}
        {/* X labels */}
        {seasons.map((s,i) => (
          <text key={i} x={x(i)} y={H-6} textAnchor="middle" fontSize={9} fill="#aaa">{s}</text>
        ))}
        {/* Lines */}
        {series.map((s,si) => (
          <g key={si}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={1.5}
              points={s.values.map((v,i) => `${x(i)},${y(v)}`).join(' ')}
            />
            {s.values.map((v,i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color}/>
            ))}
          </g>
        ))}
      </svg>
      {/* Legend */}
      <div style={S.legend}>
        {series.map((s,i) => (
          <div key={i} style={S.legItem}>
            <div style={{...S.legDot, background:s.color}}/>
            <span style={S.legLabel}>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data }) {
  const { labels, values, color } = data;
  if (!labels?.length) return <Empty/>;
  const maxVal = Math.max(...values, 1);
  const W = 300, H = 180, padL = 80, padB = 10, padT = 10, padR = 10;
  const chartW = W - padL - padR;
  const barH   = Math.floor((H - padT - padB) / labels.length) - 4;

  return (
    <div style={{overflowX:'auto'}}>
      <svg width={W} height={H} style={{display:'block',margin:'0 auto'}}>
        {labels.map((lbl, i) => {
          const barW = (values[i] / maxVal) * chartW;
          const yPos = padT + i * (barH + 4);
          return (
            <g key={i}>
              <text x={padL-6} y={yPos+barH/2+4} textAnchor="end"
                fontSize={9} fill="#888">{lbl}</text>
              <rect x={padL} y={yPos} width={barW} height={barH}
                fill={color} rx={2} opacity={0.85}/>
              <text x={padL+barW+4} y={yPos+barH/2+4}
                fontSize={9} fill="#555">{values[i]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function GroupedBar({ data }) {
  const { bars } = data;
  if (!bars?.length) return <Empty/>;
  const maxVal = Math.max(...bars.map(b => b.wins + b.losses), 1);
  const W = 300, H = 160, padL = 55, padB = 24, padT = 10, padR = 10;
  const chartW  = W - padL - padR;
  const grpW    = chartW / bars.length;
  const barW    = Math.min(18, grpW * 0.35);

  function barH(val) { return (val/maxVal) * (H - padT - padB); }
  function bY(val)   { return H - padB - barH(val); }

  return (
    <div style={{overflowX:'auto'}}>
      <svg width={W} height={H} style={{display:'block',margin:'0 auto'}}>
        {bars.map((b, i) => {
          const cx = padL + i * grpW + grpW/2;
          return (
            <g key={i}>
              <rect x={cx-barW-1} y={bY(b.wins)}   width={barW} height={barH(b.wins)}
                fill={ACCENT} rx={2} opacity={0.85}/>
              <rect x={cx+1}     y={bY(b.losses)} width={barW} height={barH(b.losses)}
                fill="#D3D1C7" rx={2} opacity={0.85}/>
              <text x={cx} y={H-6} textAnchor="middle" fontSize={8} fill="#aaa">
                {b.label.length > 7 ? b.label.slice(0,7)+'…' : b.label}
              </text>
            </g>
          );
        })}
        {/* Legend */}
        <rect x={padL}    y={padT} width={8} height={8} fill={ACCENT} rx={1}/>
        <text x={padL+11} y={padT+7} fontSize={8} fill="#555">Wins</text>
        <rect x={padL+45} y={padT} width={8} height={8} fill="#D3D1C7" rx={1}/>
        <text x={padL+56} y={padT+7} fontSize={8} fill="#555">Losses</text>
      </svg>
    </div>
  );
}

function ScatterChart({ data }) {
  const { dots } = data;
  if (!dots?.length) return <Empty/>;
  const xs = dots.map(d=>d.x), ys = dots.map(d=>d.y);
  const minX = Math.min(...xs)-5, maxX = Math.max(...xs)+5;
  const minY = Math.min(...ys)-2, maxY = Math.max(...ys)+2;
  const W=300, H=180, padL=30, padB=24, padT=10, padR=10;
  const cW = W-padL-padR, cH = H-padT-padB;

  function px(x) { return padL + ((x-minX)/(maxX-minX))*cW; }
  function py(y) { return padT + (1-(y-minY)/(maxY-minY))*cH; }

  return (
    <div style={{overflowX:'auto'}}>
      <svg width={W} height={H} style={{display:'block',margin:'0 auto'}}>
        <text x={W/2} y={H-2} textAnchor="middle" fontSize={9} fill="#bbb">Strike rate</text>
        {dots.map((d,i) => (
          <g key={i}>
            <circle cx={px(d.x)} cy={py(d.y)} r={d.r} fill={d.color} opacity={0.75}/>
            <text x={px(d.x)} y={py(d.y)-d.r-2} textAnchor="middle"
              fontSize={8} fill="#555">{d.name}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function PillRow({ label, items, active, set }) {
  return (
    <div style={{marginBottom:6}}>
      <div style={S.filterLabel}>{label}</div>
      <div style={S.pillRow}>
        {items.map(item => (
          <button key={item} onClick={() => set(item)}
            style={active===item ? S.pillOn : S.pillOff}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function Empty() {
  return <div style={S.empty}>No data available</div>;
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
  filterBar:   { padding:'10px 12px 4px', background:'#f8f8f8', borderBottom:'0.5px solid #eee' },
  filterLabel: { fontSize:10, color:'#aaa', fontWeight:500, letterSpacing:0.5,
                 textTransform:'uppercase', marginBottom:4 },
  pillRow:  { display:'flex', flexWrap:'wrap', gap:5, marginBottom:2 },
  pillOn: {
    padding:'4px 10px', borderRadius:14, fontSize:11, fontWeight:500,
    background:ACCENT, color:'#fff', border:'none', cursor:'pointer', minHeight:28,
  },
  pillOff: {
    padding:'4px 10px', borderRadius:14, fontSize:11,
    background:'#efefef', color:'#666', border:'none', cursor:'pointer', minHeight:28,
  },
  body:  { padding:'10px 12px 0' },
  card: {
    background:'#fff', borderRadius:10,
    border:'0.5px solid #eee', padding:'12px 14px',
    marginBottom:8, overflowX:'auto',
  },
  chartTitle: {
    fontSize:12, fontWeight:500, color:'#333',
    marginBottom:10,
  },
  legend:   { display:'flex', flexWrap:'wrap', gap:8, marginTop:8, paddingLeft:4 },
  legItem:  { display:'flex', alignItems:'center', gap:4 },
  legDot:   { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  legLabel: { fontSize:10, color:'#888' },
  empty:    { textAlign:'center', padding:'28px 0', fontSize:13, color:'#ccc' },
};