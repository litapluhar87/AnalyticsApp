import React, { useState, useEffect } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');

const ACCENT  = '#993C1D';

export default function Matches() {
  const { sportType, season, format } = useApp();
  const sport = sportType.toLowerCase();

  const [showPT,      setShowPT]      = useState(false);
  const [ptFilters,   setPtFilters]   = useState({});
  const [matches, setMatches]         = useState([]);
  const [pointsTable, setPT]          = useState([]);
  const [expandedKey, setExpandedKey] = useState(null);
  const [matchDetail, setDetail]      = useState(null);
  const [inningTab, setInningTab]     = useState(0);

  const seasonArg = season === 'All' ? undefined : season;
  const formatArg = format === 'All' ? undefined : format;

  useEffect(() => {
    try {
      const filters = {};
      if (seasonArg) filters.season = seasonArg;
      if (formatArg) filters.format = formatArg;
      const m = engine.getMatches(sport, filters) || [];
      setMatches(m);
      // Auto-derive PT filters from most recent match
      if (m.length > 0) {
        const recent = m[0];
        const pf = { season: String(recent.season) };
        if (recent.format && recent.format !== 'All') pf.format = recent.format;
        setPtFilters(pf);
      }
    } catch (_) { setMatches([]); }
    setExpandedKey(null);
    setDetail(null);
  }, [sport, seasonArg, formatArg]);

  useEffect(() => {
    try {
      setPT(engine.getPointsTable(sport, ptFilters) || []);
    } catch (_) { setPT([]); }
  }, [sport, ptFilters]);

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

	  {/* ── STICKY POINTS TABLE BAR ── */}
      <div style={S.ptBar}>
        <button
          onClick={() => setShowPT(p => !p)}
          style={showPT ? S.pillOn : S.pillOff}>
          {showPT ? '✖ Close' : '📊 Points Table'}
        </button>
        {ptFilters.season && (
          <span style={S.ptFilterLabel}>
            S{ptFilters.season}{ptFilters.format ? ` · ${ptFilters.format}` : ''}
          </span>
        )}
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
            {m.format === 'Test' && m.innings?.length === 4 ? (
              <>
                <div style={S.score}>{m.innings[0]?.score || '-'} {m.innings[0]?.overs ? <span style={S.overs}>({m.innings[0]?.overs} ov)</span> : null}</div>
                <div style={{...S.score, fontSize:16, color:'#222'}}>{m.innings[2]?.score || '-'} {m.innings[2]?.overs ? <span style={S.overs}>({m.innings[2]?.overs} ov)</span> : null}</div>
              </>
            ) : (
              <div style={S.score}>{m.score1 || '-'} {m.overs1 ? <span style={S.overs}>({m.overs1} ov)</span> : null}</div>
            )}
          </div>
          <div style={S.vsBlock}>
            <span style={S.vs}>vs</span>
            {m.format && <span style={S.fmtBadge}>{m.format}</span>}
          </div>
          <div style={{ ...S.teamBlock, alignItems: 'flex-end' }}>
            <div style={{ ...S.teamName, fontWeight: t2Won ? 700 : 400, color: t2Won ? ACCENT : '#333' }}>
              {m.team2}
            </div>
            {m.format === 'Test' && m.innings?.length === 4 ? (
              <>
                <div style={S.score}>{m.innings[1]?.score || '-'} {m.innings[1]?.overs ? <span style={S.overs}>({m.innings[1]?.overs} ov)</span> : null}</div>
                <div style={{...S.score, fontSize:16, color:'#222'}}>{m.innings[3]?.score || '-'} {m.innings[3]?.overs ? <span style={S.overs}>({m.innings[3]?.overs} ov)</span> : null}</div>
              </>
            ) : (
              <div style={S.score}>{m.score2 || '-'} {m.overs2 ? <span style={S.overs}>({m.overs2} ov)</span> : null}</div>
            )}
          </div>
        </div>
		<div style={S.metaArea}>
          {/* Line 1: Ground · S6 M7 · Date (right aligned) */}
          <div style={S.metaRow}>
            {m.ground && <span style={S.chip}>{m.ground}</span>}
            {m.season && <span style={S.chip}>S{m.season} M{m.matchNum}</span>}
            <span style={{flex:1}}/>
            {m.date && <span style={S.chip}>
              {new Date(m.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
            </span>}
          </div>
          {/* Line 2: Result centered */}
          {result && <div style={S.resultTxt}>{result}</div>}
          {/* Line 3: Man of the Match */}
          {m.mom && <div style={S.momRow}>Man of the Match: <strong>{m.mom}</strong></div>}
        </div>
      </button>

      {/* ── SCORECARD (expanded) ── */}
      {expanded && (
        <div style={S.scorecard}>
          {innings.length > 0 && (
            <div style={S.tabRow}>
              {innings.map((inn, i) => {
                const innNum  = Math.floor(i/2) + 1;
                const label   = innings.length === 4
                  ? `${inn.team?.split(' ')[0]} Inn${innNum}`
                  : `${inn.team || `Inn ${i+1}`} bat`;
                return (
                  <button
                    key={i}
                    onClick={() => onTabChange(i)}
                    style={{ ...S.tab, ...(inningTab === i ? S.tabActive : {}) }}
                  >
                    {label}
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
              <BattingTable
                rows={currentInning.batters}
                dnb={currentInning.dnb}
                extras={currentInning.extras}
              />
              <BowlingTable rows={currentInning.bowlers} />
              <FieldingSection data={currentInning.fielding} />
			  <FOWSection fow={currentInning.fow} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BattingTable({ rows, dnb, extras }) {
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
        <div key={i} style={{
          ...S.tblRow,
          background: i % 2 === 0 ? '#fafafa' : '#fff'
        }}>
          <div style={S.tblPlayer}>
            <div style={S.tblPlayerName}>
              {b.player}{b.notOut ? '*' : ''}
            </div>
            <div style={S.dismissal}>{b.dismissal || 'not out'}</div>
          </div>
          <span style={S.tblNum}>{b.runs ?? '-'}</span>
          <span style={S.tblNum}>{b.balls ?? '-'}</span>
          <span style={S.tblNum}>{b.fours ?? '-'}</span>
          <span style={S.tblNum}>{b.sixes ?? '-'}</span>
          <span style={S.tblNum}>
            {typeof b.sr === 'number' ? b.sr.toFixed(1) : '-'}
          </span>
        </div>
      ))}
      {/* Extras */}
      {extras > 0 && (
        <div style={{...S.tblRow, background:'#f8f8f8'}}>
          <div style={{...S.tblPlayer, color:'#888'}}>Extras</div>
          <span style={{...S.tblNum, color:'#888'}}>{extras}</span>
          <span style={S.tblNum}/>
          <span style={S.tblNum}/>
          <span style={S.tblNum}/>
          <span style={S.tblNum}/>
        </div>
      )}
      {/* Did not bat */}
      {dnb?.length > 0 && (
        <div style={S.dnbRow}>
          <span style={S.dnbLabel}>Did not bat: </span>
          <span style={S.dnbNames}>{dnb.join(', ')}</span>
        </div>
      )}
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
        <span style={S.tblNum}>M</span>
        <span style={S.tblNum}>R</span>
        <span style={S.tblNum}>W</span>
      </div>
      {rows.map((b, i) => {
        const wkts = b.wickets ?? 0;
        return (
          <div key={i} style={{ ...S.tblRow, background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
            <span style={S.tblPlayer}>{b.bowler || b.player}</span>
            <span style={S.tblNum}>{b.overs ?? '-'}</span>
			<span style={S.tblNum}>{b.maidens  ?? '-'}</span>
            <span style={S.tblNum}>{b.runs  ?? '-'}</span>
			<span style={{ ...S.tblNum, fontWeight: wkts > 0 ? 700 : 400, color: wkts > 0 ? ACCENT : 'inherit' }}>
              {wkts}
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

function FOWSection({ fow }) {
  if (!fow?.length) return null;
  return (
    <div style={S.tableWrap}>
      <div style={S.tableTitle}>Fall of wickets</div>
      <div style={S.fowRow}>
        {fow.map((f, i) => (
          <span key={i} style={S.fowItem}>
            <span style={S.fowWkt}>{f.wicket}-{f.runs}</span>
            <span style={S.fowPlayer}> ({f.player}{f.overs ? `, ${f.overs} ov` : ''})</span>
            {i < fow.length - 1 && <span style={S.fowSep}>, </span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function PointsTableView({ data, onBack }) {
  return (
    <div style={{ padding: '0 12px 16px' }}>
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
	  <button style={S.backBtn} onClick={onBack}>← Back to Matches</button>
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
  ptBar: {
    position:'sticky',
    top: 0,
    zIndex: 50,
    display:'flex',
    alignItems:'center',
    justifyContent:'space-between',
    padding:'7px 12px',
    background:'#fff',
    borderBottom:'0.5px solid #eee',
  },
  ptFilterLabel: {
    fontSize:11, color:'#888',
  },
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
  overs:     { fontSize: 10, fontWeight: 300, color: '#888', marginTop: 3 },
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
  metaArea: { marginTop: 6 },
  metaRow: { display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 },
  chip: {
    fontSize: 11,
    background: '#f5f5f5',
    color: '#777',
    padding: '2px 7px',
    borderRadius: 4,
  },
  resultTxt: { fontSize: 12, color: '#222', textAlign: 'center', marginTop: 8 },
  momRow:    { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 3 },
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
  fowRow:    { padding: '6px 14px 10px', flexWrap: 'wrap', display: 'flex' },
  fowItem:   { fontSize: 11, color: '#555' },
  fowWkt:    { fontWeight: 500, color: '#333' },
  fowPlayer: { color: '#888' },
  fowSep:    { color: '#ccc' },
  dnbRow:   { padding:'6px 12px', background:'#fafafa', borderTop:'0.5px solid #f0f0f0' },
  dnbLabel: { fontSize:11, color:'#aaa', fontStyle:'italic' },
  dnbNames: { fontSize:11, color:'#666' },
};
