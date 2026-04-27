import React, { useState, useEffect } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');
const ACCENT = '#27500A';

const SEASONS = ['All','S1','S2','S3','S4','S5','S6'];
const FORMATS = ['All','T12','Test'];

const INDIVIDUAL_TABS = [
  { id:'mvp',      label:'MVP' },
  { id:'batting',  label:'Batting' },
  { id:'bowling',  label:'Bowling' },
  { id:'fielding', label:'Fielding' },
];

const MVP_SORTS     = ['totalPoints','batPoints','bowlPoints','fieldPoints','momCount','perInning'];
const BAT_SORTS     = ['runs','average','strikeRate','fours','sixes','highScore'];
const BOWL_SORTS    = ['wickets','economy','average'];
const FIELD_SORTS   = ['total','catches','stumpings','runOuts'];
const PSHIP_SORTS   = ['runs','strikeRate','count'];

export default function Leaderboard() {
  const { sportType } = useApp();
  const sport = sportType.toLowerCase();

  const [mode,    setMode]    = useState('individual');
  const [indTab,  setIndTab]  = useState('mvp');
  const [season,  setSeason]  = useState('All');
  const [format,  setFormat]  = useState('All');
  const [sortBy,  setSortBy]  = useState('totalPoints');
  const [data,    setData]    = useState([]);
  const [grounds, setGrounds] = useState(['All']);
  const [ground,  setGround]  = useState('All');

  useEffect(() => {
    const cfg = engine.loadConfig(sport);
    setGrounds(['All', ...(cfg.grounds || [])]);
  }, [sport]);

  useEffect(() => {
    setSortBy(defaultSort(indTab));
  }, [indTab]);

  useEffect(() => {
    loadData();
  }, [sport, mode, indTab, season, format, ground, sortBy]);

  function defaultSort(tab) {
    if (tab==='mvp')      return 'totalPoints';
    if (tab==='batting')  return 'runs';
    if (tab==='bowling')  return 'wickets';
    if (tab==='fielding') return 'total';
    return 'runs';
  }

  function buildFilters() {
    const f = {};
    if (season !== 'All') f.season = season.replace('S','');
    if (format !== 'All') f.format = format;
    if (ground !== 'All') f.ground = ground;
    return f;
  }

  function loadData() {
    const f = buildFilters();
    try {
      if (mode === 'individual') {
        if (indTab==='mvp')      setData(engine.getMVPLeaderboard(sport, f, sortBy));
        if (indTab==='batting')  setData(engine.getBattingLeaderboard(sport, f, sortBy));
        if (indTab==='bowling')  setData(engine.getBowlingLeaderboard(sport, f, sortBy));
        if (indTab==='fielding') setData(engine.getFieldingLeaderboard(sport, f, sortBy));
      } else if (mode === 'team') {
        setData(engine.getPointsTable(sport, f));
      } else if (mode === 'partnership') {
        setData(engine.getPartnershipLeaderboard(sport, f, sortBy));
      }
    } catch(_) { setData([]); }
  }

  const sortOptions = () => {
    if (mode==='partnership') return PSHIP_SORTS;
    if (indTab==='mvp')       return MVP_SORTS;
    if (indTab==='batting')   return BAT_SORTS;
    if (indTab==='bowling')   return BOWL_SORTS;
    if (indTab==='fielding')  return FIELD_SORTS;
    return [];
  };

  return (
    <div style={S.page}>

      {/* Mode toggle */}
      <div style={S.modeBar}>
        {['individual','team','partnership'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={mode===m ? S.modeOn : S.modeOff}>
            {m.charAt(0).toUpperCase()+m.slice(1)}
          </button>
        ))}
      </div>

      {/* Individual sub-tabs */}
      {mode==='individual' && (
        <div style={S.subTabBar}>
          {INDIVIDUAL_TABS.map(t => (
            <button key={t.id} onClick={() => setIndTab(t.id)}
              style={indTab===t.id ? S.subTabOn : S.subTab}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={S.filterBar}>
        <PillRow label="Season" items={SEASONS} active={season} set={setSeason}/>
        <PillRow label="Format" items={FORMATS} active={format} set={setFormat}/>
        <PillRow label="Ground" items={grounds} active={ground} set={setGround}/>
        {sortOptions().length > 0 && (
          <div style={{marginBottom:6}}>
            <div style={S.filterLabel}>Sort by</div>
            <div style={S.pillRow}>
              {sortOptions().map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  style={sortBy===s ? S.pillOn : S.pillOff}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={S.body}>
        {data.length === 0
          ? <Empty/>
          : mode==='team'
            ? <TeamTable data={data}/>
            : mode==='partnership'
              ? <PshipTable data={data}/>
              : <IndividualTable data={data} tab={indTab}/>
        }
      </div>
    </div>
  );
}

function IndividualTable({ data, tab }) {
  return (
    <div style={S.card}>
      <div style={S.tblHead}>
        <span style={S.rankCol}>#</span>
        <span style={S.nameCol}>Player</span>
        {tab==='mvp'      && <><span style={S.numCol}>Total</span><span style={S.numCol}>/inn</span><span style={S.numCol}>MoM</span></>}
        {tab==='batting'  && <><span style={S.numCol}>Runs</span><span style={S.numCol}>Avg</span><span style={S.numCol}>SR</span></>}
        {tab==='bowling'  && <><span style={S.numCol}>Wkts</span><span style={S.numCol}>Eco</span><span style={S.numCol}>Avg</span></>}
        {tab==='fielding' && <><span style={S.numCol}>Tot</span><span style={S.numCol}>Ct</span><span style={S.numCol}>RO</span></>}
      </div>
      {data.map((row, i) => (
        <div key={i} style={{ ...S.tblRow, background: i%2===0?'#fafafa':'#fff' }}>
          <span style={{
            ...S.rankCol,
            color: i===0?'#BA7517': i===1?'#5F5E5A': i===2?'#854F0B':'#aaa',
            fontWeight: i<3?600:400,
          }}>{row.rank}</span>
          <span style={S.nameCol}>{row.player}</span>
          {tab==='mvp'      && <><span style={S.numCol}>{row.mvpTotal}</span><span style={S.numCol}>{row.mvpPerInning}</span><span style={S.numCol}>{row.momCount}</span></>}
          {tab==='batting'  && <><span style={S.numCol}>{row.runs}</span><span style={S.numCol}>{row.average}</span><span style={S.numCol}>{row.strikeRate}</span></>}
          {tab==='bowling'  && <><span style={S.numCol}>{row.wickets}</span><span style={S.numCol}>{row.economy}</span><span style={S.numCol}>{row.bowlingAvg??'-'}</span></>}
          {tab==='fielding' && <><span style={S.numCol}>{row.totalFielding}</span><span style={S.numCol}>{row.catches}</span><span style={S.numCol}>{row.runOutsDirect+row.runOutsCombo}</span></>}
        </div>
      ))}
    </div>
  );
}

function TeamTable({ data }) {
  return (
    <div style={S.card}>
      <div style={S.tblHead}>
        <span style={S.nameCol}>Team</span>
        <span style={S.numCol}>P</span>
        <span style={S.numCol}>W</span>
        <span style={S.numCol}>L</span>
        <span style={S.numCol}>T</span>
        <span style={{...S.numCol,fontWeight:600}}>Pts</span>
      </div>
      {data.map((row,i) => (
        <div key={i} style={{...S.tblRow, background:i%2===0?'#fafafa':'#fff'}}>
          <span style={S.nameCol}>{row.team}</span>
          <span style={S.numCol}>{row.played}</span>
          <span style={S.numCol}>{row.won}</span>
          <span style={S.numCol}>{row.lost}</span>
          <span style={S.numCol}>{row.tied??0}</span>
          <span style={{...S.numCol,fontWeight:700,color:ACCENT}}>{row.points}</span>
        </div>
      ))}
    </div>
  );
}

function PshipTable({ data }) {
  return (
    <div style={S.card}>
      <div style={S.tblHead}>
        <span style={S.rankCol}>#</span>
        <span style={S.nameCol}>Pair</span>
        <span style={S.numCol}>Runs</span>
        <span style={S.numCol}>SR</span>
        <span style={S.numCol}>Stds</span>
      </div>
      {data.map((row,i) => (
        <div key={i} style={{...S.tblRow, background:i%2===0?'#fafafa':'#fff'}}>
          <span style={{
            ...S.rankCol,
            color: i===0?'#BA7517': i===1?'#5F5E5A': i===2?'#854F0B':'#aaa',
            fontWeight: i<3?600:400,
          }}>{row.rank}</span>
          <div style={S.nameCol}>
            <div style={{fontSize:12,fontWeight:500,color:'#222'}}>{row.player1}</div>
            <div style={{fontSize:11,color:'#aaa'}}>& {row.player2}</div>
          </div>
          <span style={S.numCol}>{row.runs}</span>
          <span style={S.numCol}>{row.strikeRate}</span>
          <span style={S.numCol}>{row.count}</span>
        </div>
      ))}
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
  page:    { paddingBottom:16 },
  modeBar: {
    display:'flex', background:'#fff',
    borderBottom:'0.5px solid #eee', padding:'0 12px',
  },
  modeOn: {
    flex:1, padding:'10px 0', fontSize:12, fontWeight:500,
    color:ACCENT, border:'none', background:'none',
    borderBottom:`2px solid ${ACCENT}`, cursor:'pointer',
  },
  modeOff: {
    flex:1, padding:'10px 0', fontSize:12,
    color:'#aaa', border:'none', background:'none',
    borderBottom:'2px solid transparent', cursor:'pointer',
  },
  subTabBar: {
    display:'flex', background:'#f8f8f8',
    borderBottom:'0.5px solid #eee',
  },
  subTab: {
    flex:1, padding:'8px 0', fontSize:11,
    color:'#888', border:'none', background:'none',
    borderBottom:'2px solid transparent', cursor:'pointer',
  },
  subTabOn: {
    flex:1, padding:'8px 0', fontSize:11, fontWeight:500,
    color:ACCENT, border:'none', background:'none',
    borderBottom:`2px solid ${ACCENT}`, cursor:'pointer',
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
  body:    { padding:'10px 12px 0' },
  card: {
    background:'#fff', borderRadius:10,
    border:'0.5px solid #eee', overflow:'hidden', marginBottom:8,
  },
  tblHead: {
    display:'flex', padding:'8px 12px',
    background:'#f5f5f5', borderBottom:'0.5px solid #eee',
  },
  tblRow:  { display:'flex', padding:'9px 12px', borderBottom:'0.5px solid #f5f5f5', alignItems:'center' },
  rankCol: { width:24, fontSize:12, color:'#aaa', flexShrink:0 },
  nameCol: { flex:1, fontSize:12, fontWeight:500, color:'#222' },
  numCol:  { width:40, textAlign:'right', fontSize:12, color:'#555' },
  empty:   { textAlign:'center', padding:'28px 0', fontSize:13, color:'#ccc' },
};