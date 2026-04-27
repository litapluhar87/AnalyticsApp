import React, { useState } from 'react';
import { useApp } from '../App';

const engine = require('../engine/statsEngine');
const ACCENT = '#0C447C';

export default function Settings({ onClose }) {
  const { sportType, isAdmin, currentUser } = useApp();
  const sport = sportType.toLowerCase();
  const config = engine.loadConfig(sport);
  const rules  = config.mvpRules;

  const [editMode, setEditMode] = useState(false);

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={onClose}>← Back</button>
        <div style={S.headerTitle}>Settings</div>
        {isAdmin && (
          <button style={S.editBtn} onClick={() => setEditMode(e => !e)}>
            {editMode ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      <div style={S.body}>

        {/* Profile section */}
        <Sec label="Profile"/>
        <div style={S.card}>
          <Row label="Logged in as" value={currentUser}/>
          <Row label="Role"         value={isAdmin ? 'Admin' : 'Player'}/>
          <Row label="Sport"        value={config.name}/>
        </div>

        {/* MVP Rules — Batting */}
        <Sec label={`MVP rules · ${config.name}`}/>
        <div style={S.card}>
          <SectionHead label="Batting"/>
          <Row label="Run"         value={`${rules.batting.runPoints} pt per run`}/>
          <Row label="Four"        value={`+${rules.batting.boundaryBonus.four} pt`}/>
          <Row label="Six"         value={`+${rules.batting.boundaryBonus.six} pts`}/>
          <Row label="Not out bonus" value={`${rules.batting.notOutBonus.multiplier*100}% of bat pts`}/>
          <Row label="SR threshold"  value={`${rules.batting.strikeRate.threshold}`}/>
          <Row label="SR bonus"      value={`×${rules.batting.strikeRate.bonusMultiplier}`}/>
          <Row label="SR penalty"    value={`×${rules.batting.strikeRate.penaltyMultiplier} (max ${rules.batting.strikeRate.maxPenalty})`}/>
          {Object.entries(rules.batting.milestones||{}).map(([m,p]) => (
            <Row key={m} label={`${m}+ runs`} value={`+${p} pts`}/>
          ))}
        </div>

        {/* MVP Rules — Bowling */}
        <div style={S.card}>
          <SectionHead label="Bowling"/>
          {Object.entries(rules.bowling.wicketTypes||{}).map(([type,pts]) => (
            pts > 0 &&
            <Row key={type} label={`${type.charAt(0).toUpperCase()+type.slice(1)}`} value={`${pts} pts`}/>
          ))}
          <Row label="Maiden over"    value={`+${rules.bowling.maidenOver} pts`}/>
          <Row label="Expected eco"   value={`${rules.bowling.economy.expectedEconomy}`}/>
          <Row label="Eco multiplier" value={`×${rules.bowling.economy.multiplier}`}/>
          <Row label="Max eco penalty"value={`${rules.bowling.economy.maxPenalty}`}/>
          {Object.entries(rules.bowling.milestones||{}).map(([m,p]) => (
            <Row key={m} label={`${m}+ wickets`} value={`+${p} pts`}/>
          ))}
        </div>

        {/* MVP Rules — Fielding */}
        <div style={S.card}>
          <SectionHead label="Fielding"/>
          <Row label="Catch"       value={`${rules.fielding.catch} pts`}/>
          <Row label="Stumping"    value={`${rules.fielding.stumping} pts`}/>
          <Row label="Direct RO"   value={`${rules.fielding.directRunOut} pts`}/>
          <Row label="Combo RO"    value={`${rules.fielding.comboRunOut} pts`}/>
        </div>

        {/* Admin only — PDF upload */}
        {isAdmin && (
          <>
            <Sec label="Admin"/>
            <div style={S.card}>
              <div style={S.uploadArea}>
                <div style={S.uploadIcon}>📄</div>
                <div style={S.uploadTitle}>Upload scorecard PDF</div>
                <div style={S.uploadSub}>
                  AI will extract match data automatically
                </div>
                <button style={S.uploadBtn}>
                  Choose PDF file
                </button>
                <div style={S.uploadNote}>
                  Coming in Phase 2 — manual data entry via Excel migration currently active
                </div>
              </div>
            </div>
          </>
        )}

        {/* About */}
        <Sec label="About"/>
        <div style={S.card}>
          <Row label="App"      value="RACL Cricket Stats"/>
          <Row label="Seasons"  value={config.seasons?.join(', ')||'-'}/>
          <Row label="Players"  value={`${config.players?.length||0} registered`}/>
          <Row label="Version"  value="1.0.0"/>
        </div>

      </div>
    </div>
  );
}

function Sec({ label }) {
  return <div style={S.secLabel}>{label}</div>;
}

function SectionHead({ label }) {
  return <div style={S.sectionHead}>{label}</div>;
}

function Row({ label, value }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={S.rowValue}>{value}</span>
    </div>
  );
}

const S = {
  page:   { minHeight:'100vh', background:'#f5f5f5', paddingBottom:32 },
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 16px', background:ACCENT,
  },
  backBtn: {
    background:'none', border:'none', color:'rgba(255,255,255,0.85)',
    fontSize:13, cursor:'pointer', padding:0,
  },
  headerTitle: { fontSize:16, fontWeight:500, color:'#fff' },
  editBtn: {
    background:'rgba(255,255,255,0.15)', border:'none',
    color:'#fff', fontSize:12, padding:'5px 12px',
    borderRadius:14, cursor:'pointer',
  },
  body:    { padding:'10px 12px 0' },
  secLabel: {
    fontSize:10, fontWeight:500, color:'#aaa',
    letterSpacing:0.7, textTransform:'uppercase',
    margin:'14px 0 6px',
  },
  card: {
    background:'#fff', borderRadius:10,
    border:'0.5px solid #eee', overflow:'hidden', marginBottom:8,
  },
  sectionHead: {
    fontSize:11, fontWeight:600, color:ACCENT,
    padding:'8px 14px 4px', letterSpacing:0.3,
  },
  row: {
    display:'flex', justifyContent:'space-between',
    alignItems:'center', padding:'9px 14px',
    borderBottom:'0.5px solid #f5f5f5',
  },
  rowLabel: { fontSize:12, color:'#888' },
  rowValue: { fontSize:12, fontWeight:500, color:'#222', textAlign:'right', maxWidth:'55%' },
  uploadArea: {
    padding:'20px 14px', textAlign:'center',
  },
  uploadIcon:  { fontSize:28, marginBottom:8 },
  uploadTitle: { fontSize:14, fontWeight:500, color:'#222', marginBottom:4 },
  uploadSub:   { fontSize:12, color:'#888', marginBottom:14 },
  uploadBtn: {
    padding:'9px 20px', borderRadius:8,
    background:ACCENT, color:'#fff',
    border:'none', fontSize:13, cursor:'pointer',
    marginBottom:10,
  },
  uploadNote: { fontSize:11, color:'#bbb', fontStyle:'italic' },
};