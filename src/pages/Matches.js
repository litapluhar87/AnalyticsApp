import React, { useState, useEffect } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');

const ACCENT  = '#993C1D';
const SEASONS = ['All', 'S3', 'S4', 'S5', 'S6'];
const FORMATS = ['All', 'T12', 'Test'];

export default function Matches() {
  const { sportType } = useApp();
  const sport = sportType.toLowerCase();

  const [localSeason, setLocalSeason] = useState('All');
  const [localFormat, setLocalFormat] = useState('All');
  const [showPT, setShowPT]           = useState(false);
  const [matches, setMatches]         = useState([]);
  const [pointsTable, setPT]          = useState([]);
  const [expandedKey, setExpandedKey] = useState(null);
  const [matchDetail, setDetail]      = useState(null);
  const [inningTab, setInningTab]     = useState(0);

  const seasonArg = localSeason === 'All' ? undefined : localSeason.replace('S', '');
  const formatArg = localFormat === 'All' ? undefined : localFormat;

  useEffect(() => {
    try {
      const filters = {};
      if (seasonArg) filters.season = seasonArg;
      if (formatArg) filters.format = formatArg;
      setMatches(engine.getMatches(sport, filters) || []);
    } catch (_) { setMatches([]); }
    setExpandedKey(null);
    setDetail(null);
  }, [sport, seasonArg, formatArg]);

  useEffect(() => {
    if (!showPT) return;
    try {
      const filters = {};
      if (seasonArg) filters.season = seasonArg;
      if (formatArg) filters.format = formatArg;
      setPT(engine.getPointsTable(sport, filters) || []);
    } catch (_) { setPT([]); }
  }, [showPT, sport, seasonArg, formatArg]);

  function toggleMatch(key, season, matchNum) {
    if (expandedKey === key) {
      setExpandedKey(null);
      setDetail(null);
      return;
    }
    setExpandedKey(key);
    setInningTab(0);
    try {
      setDetail(engine.getScorecard(sport, season, matchNum) || null);
    } catch (_) { setDetail(null); }
  }

  return (
    <div style={S.page}>

      {/* ── FILTER BAR ── */}
      <div style={S.filterBar}>
        <div style={S.filterRow}>
          {SEASONS.map(s => (
            <button
              key={s}
              onClick={() => setLocalSeason(s)}
              style={localSeason === s ? S.pillOn : S.pillOff}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={S.filterRow}>
          {FORMATS.map(f => (
            <button
              key={f}
              onClick={() => setLocalFormat(f)}
              style={localFormat === f ? S.pillOn : S.pillOff}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ ...S.filterRow, justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowPT(p => !p)}
            style={showPT ? S.pillOn : S.pillOff}
          >
            Points Table
          </button>
        </div>
      </div>

      {/* ── CONTENT ── */}
      {showPT
        ? <PointsTableView data={pointsTable} onBack={() => setShowPT(false)} />
        : (
          <div style={S.list}>
            {matches.length === 0
              ? <Empty />
              : matches.map(m => {
                  const key = `${m.season}-${m.matchNum}`;
                  return (
                    <MatchCard
                      key={key}
                      match={m}
                      expanded={expandedKey === key}
                      detail={expandedKey === key ? matchDetail : null}
                      inningTab={inningTab}
                      onTap={() => toggleMatch(key, m.season, m.matchNum)}
                      onTabChange={t => setInningTab(t)}
                    />
                  );
                })}
          </div>
        )}

    </div>
  );
}

function MatchCard({ match: m, expanded, detail, inningTab, onTap, onTabChange }) {
  const t1Won = m.winner && m.winner === m.team1;
  const t2Won = m.winner && m.winner === m.team2;
  const result = typeof m.result === 'string' ? m.result : (m.result?.text || '');

  // Normalise innings from whatever structure the match JSON uses
  const innings = detail?.innings || [];

  const currentInning = innings[inningTab] || null;

  return (
    <div style={S.card}>
      {/* ── TILE (tap target) ── */}
      <button style={S.cardBtn} onClick={onTap}>
        <div style={S.cardTop}>
          <div style={S.teamBlock}>
            <div style={{ ...S.teamName, fontWeight: t1Won ? 700 : 400, color: t1Won ? ACCENT : '#333' }}>
              {m.team1}
            </div>
            <div style={S.score}>{m.score1 || '-'}</div>
          </div>
          <div style={S.vsBlock}>
            <span style={S.vs}>vs</span>
            {m.format && <span style={S.fmtBadge}>{m.format}</span>}
          </div>
          <div style={{ ...S.teamBlock, alignItems: 'flex-end' }}>
            <div style={{ ...S.teamName, fontWeight: t2Won ? 700 : 400, color: t2Won ? ACCENT : '#333' }}>
              {m.team2}
            </div>
            <div style={S.score}>{m.score2 || '-'}</div>
          </div>
        </div>
        <div style={S.metaArea}>
          <div style={S.metaRow}>
            {m.ground  && <span style={S.chip}>{m.ground}</span>}
            {m.season  && <span style={S.chip}>S{m.season}</span>}
            {result    && <span style={S.resultTxt}>{result}</span>}
          </div>
          {m.mom && <div style={S.momRow}>MoM: <strong>{m.mom}</strong></div>}
        </div>
      </button>

      {/* ── SCORECARD (expanded) ── */}
      {expanded && (
        <div style={S.scorecard}>
          {innings.length > 0 && (
            <div style={S.tabRow}>
              {innings.map((inn, i) => {
                const label = inn?.team || inn?.battingTeam || `Innings ${i + 1}`;
                return (
                  <button
                    key={i}
                    onClick={() => onTabChange(i)}
                    style={{ ...S.tab, ...(inningTab === i ? S.tabActive : {}) }}
                  >
                    {label} bat
                  </button>
                );
              })}
            </div>
          )}

          {!currentInning && innings.length === 0 && (
            <div style={{ padding: '16px 14px' }}><Empty /></div>
          )}

		  {currentInning && (
            <>
              <BattingTable rows={currentInning.batters} />
              <BowlingTable rows={currentInning.bowlers} />
              <FieldingSection data={currentInning.fielding} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BattingTable({ rows }) {
  if (!rows?.length) return null;
  return (
    <div style={S.tableWrap}>
      <div style={S.tableTitle}>Batting</div>
      <div style={S.tblHead}>
        <span style={S.tblPlayer}>Batter</span>
        <span style={S.tblNum}>R</span>
        <span style={S.tblNum}>B</span>
        <span style={S.tblNum}>4s</span>
        <span style={S.tblNum}>6s</span>
        <span style={S.tblNum}>SR</span>
      </div>
      {rows.map((b, i) => (
        <div key={i} style={{ ...S.tblRow, background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
          <div style={S.tblPlayer}>
            <div style={S.tblPlayerName}>{b.player}</div>
            {b.dismissal && <div style={S.dismissal}>{b.dismissal}</div>}
          </div>
          <span style={S.tblNum}>{b.runs  ?? '-'}</span>
          <span style={S.tblNum}>{b.balls ?? '-'}</span>
          <span style={S.tblNum}>{b.fours ?? b['4s'] ?? '-'}</span>
          <span style={S.tblNum}>{b.sixes ?? b['6s'] ?? '-'}</span>
          <span style={S.tblNum}>
            {typeof b.sr       === 'number' ? b.sr.toFixed(1)
             : typeof b.strikeRate === 'number' ? b.strikeRate.toFixed(1)
             : (b.sr ?? b.strikeRate ?? '-')}
          </span>
        </div>
      ))}
    </div>
  );
}

function BowlingTable({ rows }) {
  if (!rows?.length) return null;
  return (
    <div style={S.tableWrap}>
      <div style={S.tableTitle}>Bowling</div>
      <div style={S.tblHead}>
        <span style={S.tblPlayer}>Bowler</span>
        <span style={S.tblNum}>O</span>
        <span style={S.tblNum}>R</span>
        <span style={S.tblNum}>W</span>
        <span style={S.tblNum}>Eco</span>
      </div>
      {rows.map((b, i) => {
        const wkts = b.wickets ?? 0;
        return (
          <div key={i} style={{ ...S.tblRow, background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
            <span style={S.tblPlayer}>{b.bowler || b.player}</span>
            <span style={S.tblNum}>{b.overs ?? '-'}</span>
            <span style={S.tblNum}>{b.runs  ?? '-'}</span>
            <span style={{ ...S.tblNum, fontWeight: wkts > 0 ? 700 : 400, color: wkts > 0 ? ACCENT : 'inherit' }}>
              {wkts}
            </span>
            <span style={S.tblNum}>
              {typeof b.economy === 'number' ? b.economy.toFixed(1) : (b.economy ?? '-')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FieldingSection({ data }) {
  if (!data) return null;

  const lines = [];

  if (Array.isArray(data)) {
    // [{player, catches, stumpings, runouts}, ...]
    data.forEach(f => {
      const n = f.player || f.name || '';
      if ((f.catches    || 0) > 0) lines.push(`${n}: ${f.catches} catch${f.catches > 1 ? 'es' : ''}`);
      if ((f.stumpings  || 0) > 0) lines.push(`${n}: ${f.stumpings} stumping${f.stumpings > 1 ? 's' : ''}`);
      const ro = (f.runouts || f.directRunOuts || 0) + (f.comboRunOuts || 0);
      if (ro > 0) lines.push(`${n}: ${ro} run out${ro > 1 ? 's' : ''}`);
    });
  } else if (typeof data === 'object') {
    // { catches: [...names], stumpings: [...], runouts: [...] }
    const cats = data.catches   || [];
    const sts  = data.stumpings || [];
    const ros  = data.runouts   || data.runOuts || [];
    if (cats.length) lines.push(`Catches: ${cats.join(', ')}`);
    if (sts.length)  lines.push(`Stumpings: ${sts.join(', ')}`);
    if (ros.length)  lines.push(`Run Outs: ${ros.join(', ')}`);
  }

  if (!lines.length) return null;

  return (
    <div style={S.tableWrap}>
      <div style={S.tableTitle}>Fielding</div>
      {lines.map((line, i) => (
        <div key={i} style={S.fieldItem}>{line}</div>
      ))}
    </div>
  );
}

function PointsTableView({ data, onBack }) {
  return (
    <div style={{ padding: '0 12px 16px' }}>
      <button style={S.backBtn} onClick={onBack}>← Back to Matches</button>
      {data.length === 0 ? <Empty /> : (
        <div style={S.ptCard}>
          <div style={S.ptHead}>
            <span style={S.ptTeam}>Team</span>
            <span style={S.ptNum}>P</span>
            <span style={S.ptNum}>W</span>
            <span style={S.ptNum}>L</span>
            <span style={S.ptNum}>T</span>
            <span style={{ ...S.ptNum, fontWeight: 600 }}>Pts</span>
          </div>
          {data.map((row, i) => (
            <div key={i} style={{ ...S.ptRow, background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
              <span style={S.ptTeam}>{row.team}</span>
              <span style={S.ptNum}>{row.played ?? '-'}</span>
              <span style={S.ptNum}>{row.won    ?? '-'}</span>
              <span style={S.ptNum}>{row.lost   ?? '-'}</span>
              <span style={S.ptNum}>{row.tied   ?? '-'}</span>
              <span style={{ ...S.ptNum, fontWeight: 700, color: ACCENT }}>
                {row.points ?? '-'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty() {
  return <div style={S.empty}>No data available</div>;
}

const S = {
  page:      { paddingBottom: 16 },
  filterBar: {
    padding: '8px 12px 6px',
    background: '#fff',
    borderBottom: '0.5px solid #e8e8e8',
  },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  pillOn: {
    padding: '5px 14px',
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 500,
    background: ACCENT,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    minHeight: 32,
  },
  pillOff: {
    padding: '5px 14px',
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 400,
    background: '#f0f0f0',
    color: '#555',
    border: 'none',
    cursor: 'pointer',
    minHeight: 32,
  },
  list: { padding: '8px 12px 0' },
  card: {
    background: '#fff',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  cardBtn: {
    width: '100%',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '12px 14px',
    textAlign: 'left',
    minHeight: 80,
  },
  cardTop:   { display: 'flex', alignItems: 'flex-start' },
  teamBlock: { flex: 1, display: 'flex', flexDirection: 'column' },
  teamName:  { fontSize: 13 },
  score:     { fontSize: 16, fontWeight: 600, color: '#111', marginTop: 3 },
  vsBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 8px',
    gap: 4,
  },
  vs:        { color: '#c0c0c0', fontSize: 11 },
  fmtBadge: {
    fontSize: 9,
    fontWeight: 600,
    padding: '2px 6px',
    background: '#f4eeea',
    color: ACCENT,
    borderRadius: 4,
  },
  metaArea:  { marginTop: 8 },
  metaRow:   { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  chip: {
    fontSize: 11,
    background: '#f5f5f5',
    color: '#777',
    padding: '2px 7px',
    borderRadius: 4,
  },
  resultTxt: { fontSize: 11, color: '#666' },
  momRow:    { fontSize: 11, color: '#999', marginTop: 3 },
  scorecard: { borderTop: '0.5px solid #f0f0f0', paddingBottom: 8 },
  tabRow:    { display: 'flex', padding: '8px 14px 4px', gap: 8 },
  tab: {
    flex: 1,
    padding: '6px 8px',
    borderRadius: 8,
    fontSize: 12,
    background: '#f5f5f5',
    color: '#777',
    border: 'none',
    cursor: 'pointer',
    minHeight: 32,
  },
  tabActive: { background: ACCENT, color: '#fff', fontWeight: 500 },
  tableWrap: { padding: '8px 14px 4px' },
  tableTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#999',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tblHead: {
    display: 'flex',
    padding: '3px 0 5px',
    borderBottom: '0.5px solid #eee',
  },
  tblRow: {
    display: 'flex',
    padding: '5px 0',
    borderBottom: '0.5px solid #f5f5f5',
    alignItems: 'flex-start',
  },
  tblPlayer:     { flex: 1, fontSize: 12, color: '#888', fontWeight: 500 },
  tblPlayerName: { fontSize: 12, color: '#222' },
  dismissal:     { fontSize: 10, color: '#bbb', marginTop: 1 },
  tblNum:        { width: 34, textAlign: 'right', fontSize: 12, color: '#555' },
  fieldItem:     { fontSize: 12, color: '#555', padding: '3px 0' },
  backBtn: {
    background: 'none',
    border: 'none',
    color: ACCENT,
    fontSize: 13,
    cursor: 'pointer',
    padding: '10px 0 8px',
    fontWeight: 500,
    display: 'block',
  },
  ptCard:  { borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  ptHead: {
    display: 'flex',
    padding: '10px 14px',
    background: '#f8f8f8',
    borderBottom: '0.5px solid #eee',
  },
  ptRow:   { display: 'flex', padding: '10px 14px', borderBottom: '0.5px solid #f5f5f5' },
  ptTeam:  { flex: 1, fontSize: 13, color: '#222' },
  ptNum:   { width: 30, textAlign: 'right', fontSize: 13, color: '#555' },
  empty:   { textAlign: 'center', padding: '28px 0', fontSize: 13, color: '#c0c0c0' },
};
