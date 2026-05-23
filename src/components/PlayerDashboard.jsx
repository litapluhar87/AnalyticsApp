// src/components/PlayerDashboard.jsx
// Dashboard view for MyCricket stats tab
// Uses recharts — already available in the project
// Props: stats (aggregated), recentForm (per-match array), playerName

import React, { useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
  PieChart, Pie,
} from 'recharts';

const ACCENT  = '#534AB7';
const GREEN   = '#3B8C2A';
const RED     = '#C0392B';
const AMBER   = '#E67E22';
const TEAL    = '#16A085';
const SOFT_BG = '#F7F6FF';

// ─── Pill ─────────────────────────────────────────────────────────────────────
function StatPill({ value, label, color, bg }) {
  return (
    <div style={{
      flex: 1,
      background: bg || SOFT_BG,
      borderRadius: 12,
      padding: '12px 8px',
      textAlign: 'center',
      border: `1.5px solid ${color}22`,
    }}>
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color,
        lineHeight: 1,
        letterSpacing: -1,
      }}>
        {value ?? '-'}
      </div>
      <div style={{
        fontSize: 10,
        color: '#fff',
        marginTop: 4,
        fontWeight: 600,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
    </div>
  );
}

// ─── Custom radar label ───────────────────────────────────────────────────────
function RadarLabel({ x, y, payload }) {
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 10, fill: '#666', fontWeight: 500 }}>
      {payload.value}
    </text>
  );
}

// ─── Win/Loss donut custom label ──────────────────────────────────────────────
function DonutLabel({ cx, cy, wins, matches }) {
  const pct = matches > 0 ? Math.round((wins / matches) * 100) : 0;
  return (
    <>
      <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 20, fontWeight: 700, fill: '#222' }}>
        {pct}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 9, fill: '#aaa', fontWeight: 500, letterSpacing: 0.5 }}>
        WIN RATE
      </text>
    </>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function PlayerDashboard({ stats, recentForm }) {
  if (!stats) return (
    <div style={{ textAlign: 'center', padding: 32, color: '#ccc', fontSize: 13 }}>
      No data available
    </div>
  );

  // ── Radar data ─────────────────────────────────────────────────────────────
  // Normalise each axis to 0-100
  const radarData = useMemo(() => {
    const batMax  = 100;  // MVP bat per inning — cap at 100
    const bowlMax = 50;   // MVP bowl per inning — cap at 50
    const fieldMax= 20;   // MVP field per inning
    const winMax  = 100;  // win % 0-100
    const mvpMax  = 100;  // total MVP per inning

    return [
      {
        axis: 'Bat',
        value: Math.min(Math.round(((stats.mvpBatPerInn || 0) / batMax) * 100), 100),
        raw: stats.mvpBatPerInn || 0,
      },
      {
        axis: 'Bowl',
        value: Math.min(Math.round(((stats.mvpBowlPerInn || 0) / bowlMax) * 100), 100),
        raw: stats.mvpBowlPerInn || 0,
      },
      //{
      //  axis: 'Field',
      //  value: Math.min(Math.round(((stats.mvpField || 0) / fieldMax) * 100), 100),
      //  raw: stats.mvpField || 0,
      //},
      //{
      //  axis: 'Win%',
      //  value: stats.matches > 0
      //    ? Math.round((stats.won / stats.matches) * 100)
      //    : 0,
      //  raw: stats.matches > 0
      //    ? Math.round((stats.won / stats.matches) * 100)
      //    : 0,
      //},
      {
        axis: 'MVP',
        value: Math.min(Math.round(((stats.mvpMomPerInn || 0) / mvpMax) * 100), 100),
        raw: stats.mvpMomPerInn || 0,
      },
    ];
  }, [stats]);

  // ── Donut data ─────────────────────────────────────────────────────────────
  const losses   = Math.max(0, (stats.matches || 0) - (stats.won || 0));
  const donutData = [
    { name: 'Won',  value: stats.won    || 0, color: GREEN },
    { name: 'Lost', value: losses,             color: RED   },
  ];

  // ── Per-match bar/line data ────────────────────────────────────────────────
  const matchData = useMemo(() => {
    if (!recentForm?.length) return [];
    return [...recentForm].reverse().map((r, i) => ({
      name:    `S${r.season}M${r.matchNum}`,
      runs:    r.runs    || 0,
      wickets: r.wickets || 0,
      mvp:     Math.round(r.mvpMom || r.mvpTotal || 0),
      won:     r.won,
      tied:    r.tied,
    }));
  }, [recentForm]);

  const maxRuns    = Math.max(...matchData.map(d => d.runs),    1);
  const maxWickets = Math.max(...matchData.map(d => d.wickets), 1);
  const maxMvp     = Math.max(...matchData.map(d => d.mvp),     1);

  // ── Win/loss legend ────────────────────────────────────────────────────────
  const hasBowling = (stats.wickets || 0) > 0 || (stats.oversBowled || 0) > 0;

  return (
    <div style={{ paddingBottom: 16 }}>

      {/* ── Pills: Runs + Wickets ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        <StatPill
          value={stats.runs}
          label={`Runs · Avg ${stats.average ?? '-'}`}
          color='#fff'
          bg='#3B63D1'
        />
        <StatPill
          value={stats.wickets}
          label={`Wickets · Eco ${stats.economy || '-'}`}
          color='#fff'
          bg='#7A2948'
        />
      </div>

      {/* ── Win/Loss donut + Radar side by side ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>

        {/* Donut */}
        <div style={card}>
          <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center', marginBottom: 4, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Win / Loss
          </div>
          <PieChart width={140} height={120}>
            <Pie
              data={donutData}
              cx={70} cy={60}
              innerRadius={36} outerRadius={52}
              dataKey="value"
              startAngle={90} endAngle={-270}
              strokeWidth={0}
            >
              {donutData.map((d, i) => (
                <Cell key={i} fill={d.color}/>
              ))}
            </Pie>
            <DonutLabel cx={70} cy={60} wins={stats.won || 0} matches={stats.matches || 0}/>
          </PieChart>
          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 4 }}>
            {donutData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }}/>
                <span style={{ fontSize: 10, color: '#888' }}>{d.value} {d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Radar */}
        <div style={{ ...card, flex: 1 }}>
          <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center', marginBottom: 0, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Player Profile
          </div>
          <RadarChart
            width={190} height={140}
            data={radarData}
            margin={{ top: 8, right: 20, bottom: 8, left: 20 }}
          >
            <PolarGrid stroke="#eee" strokeWidth={0.8}/>
            <PolarAngleAxis dataKey="axis" tick={<RadarLabel/>}/>
            <Radar
              dataKey="value"
              stroke={ACCENT}
              fill={ACCENT}
              fillOpacity={0.25}
              strokeWidth={1.5}
            />
          </RadarChart>
        </div>
      </div>

      {/* ── MVP Trend ── */}
      {matchData.length > 0 && (
        <>          
          <div style={card}>
		    <div style={chartTitle}>MVP trend</div>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={matchData} margin={{ top: 8, right: 12, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#bbb' }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fontSize: 8, fill: '#bbb' }} tickLine={false} axisLine={false}/>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 2px 12px #0002' }}
                  formatter={(v) => [`${v} pts`, 'MVP']}
                  labelStyle={{ color: '#888', fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="mvp"
                  stroke={ACCENT}
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const fill = payload.tied ? AMBER : payload.won ? GREEN : RED;
                    return <circle key={cx} cx={cx} cy={cy} r={3} fill={fill} stroke="#fff" strokeWidth={1}/>;
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, paddingBottom: 8 }}>
              {[['Won', GREEN], ['Lost', RED], ['Tied', AMBER]].map(([l, c]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }}/>
                  <span style={{ fontSize: 9, color: '#aaa' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Runs + Wickets bars side by side ── */}
      {matchData.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>

            {/* Runs */}
            <div style={{ ...card, flex: 1 }}>
              <div style={chartTitle}>Runs</div>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={matchData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }} barSize={10}>
                  <XAxis dataKey="name" tick={{ fontSize: 7, fill: '#ccc' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 7, fill: '#ccc' }} tickLine={false} axisLine={false}/>
                  <Tooltip
                    contentStyle={{ fontSize: 10, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px #0002' }}
                    formatter={(v) => [`${v}`, 'Runs']}
                    labelStyle={{ fontSize: 9, color: '#888' }}
                  />
                  <Bar dataKey="runs" radius={[3, 3, 0, 0]}>
                    {matchData.map((d, i) => (
                      <Cell key={i} fill={d.tied ? AMBER : d.won ? ACCENT : '#C5C2E8'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Wickets */}
            <div style={{ ...card, flex: 1 }}>
              <div style={chartTitle}>Wickets</div>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={matchData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }} barSize={10}>
                  <XAxis dataKey="name" tick={{ fontSize: 7, fill: '#ccc' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 7, fill: '#ccc' }} tickLine={false} axisLine={false} domain={[0, Math.max(maxWickets + 1, 5)]}/>
                  <Tooltip
                    contentStyle={{ fontSize: 10, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px #0002' }}
                    formatter={(v) => [`${v}`, 'Wickets']}
                    labelStyle={{ fontSize: 9, color: '#888' }}
                  />
                  <Bar dataKey="wickets" radius={[3, 3, 0, 0]}>
                    {matchData.map((d, i) => (
                      <Cell key={i} fill={d.tied ? AMBER : d.won ? TEAL : '#A8DED4'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const card = {
  background: '#fff',
  borderRadius: 10,
  border: '0.5px solid #eee',
  padding: '10px 10px 6px',
  marginBottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const chartTitle = {
  fontSize: 10,
  color: '#aaa',
  fontWeight: 600,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  marginBottom: 4,
  alignSelf: 'flex-start',
};
