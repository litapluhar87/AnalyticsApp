import React, { useState } from 'react';
import { useApp } from '../App';
import { logout } from '../auth/authUtils';

const engine       = require('../engine/statsEngine');
const awardsEngine = require('../engine/awardsEngine');
const appConfig    = require('../config/app.config.json');

const ACCENT = '#0C447C';
export default function Settings({ onClose, onLogout }) {
//export default function Settings({ onClose }) {
  const { sportType, isAdmin, currentUser } = useApp();
  const sport  = sportType.toLowerCase();
  const config = engine.loadConfig(sport);
  const rules  = config.mvpRules;

  const [openSection, setOpenSection] = useState(null);

  function toggle(id) {
    setOpenSection(s => s === id ? null : id);
  }

  const sections = [
    { id:'players',  label:'Players',   icon:'👤' },
    { id:'seasons',  label:'Seasons',   icon:'📅' },
    { id:'teams',    label:'Teams',     icon:'🏏' },
    { id:'grounds',  label:'Grounds',   icon:'📍' },
    { id:'formats',  label:'Formats',   icon:'📋' },
    { id:'mvprules', label:'MVP Rules', icon:'⭐' },
    { id:'awards',   label:'Awards',    icon:'🏆' },
    { id:'other',    label:'Other',     icon:'⚙️'  },
    { id: 'account', label: 'Account', icon: '🔐' },
  ];

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={{ ...S.header, background: 'none' }}>
        <button style={S.backBtn} onClick={onClose}>← Back</button>
        <div style={S.headerTitle}>Settings</div>
      </div>

      <div style={S.body}>
        {sections.map(sec => (
          <div key={sec.id} style={S.section}>
            <button style={S.sectionHeader} onClick={() => toggle(sec.id)}>
              <span style={S.sectionIcon}>{sec.icon}</span>
              <span style={S.sectionLabel}>{sec.label}</span>
              <span style={S.sectionChevron}>
                {openSection === sec.id ? '▲' : '▼'}
              </span>
            </button>
            {openSection === sec.id && (
              <div style={S.sectionBody}>
                <SectionContent id={sec.id} config={config} rules={rules} sport={sport} onLogout={onLogout} />
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}

function SectionContent({ id, config, rules, sport, onLogout }) {
  switch(id) {

    case 'players':
      return (
        <div style={S.tagWrap}>
          {(config.players || []).map(p => (
            <span key={p} style={S.tag}>{p}</span>
          ))}
        </div>
      );

    case 'seasons':
      return (
        <div style={S.tagWrap}>
          {(config.seasons || []).map(s => (
            <span key={s} style={S.tag}>Season {s}</span>
          ))}
        </div>
      );

    case 'teams': {
      const seasons = Object.entries(config.teams || {}).sort((a,b) => Number(a[0])-Number(b[0]));
      return (
        <>
          {seasons.map(([season, teams]) => (
            <div key={season} style={S.subSection}>
              <div style={S.subLabel}>Season {season}</div>
              {teams.length === 0
                ? <div style={S.emptyNote}>No data</div>
                : <div style={S.tagWrap}>
                    {teams.map(t => <span key={t} style={S.tag}>{t}</span>)}
                  </div>
              }
            </div>
          ))}
        </>
      );
    }

    case 'grounds':
      return (
        <div style={S.tagWrap}>
          {(config.grounds || []).map(g => (
            <span key={g} style={S.tag}>{g}</span>
          ))}
        </div>
      );

    case 'formats':
      return (
        <div style={S.tagWrap}>
          {(config.formats || []).map(f => (
            <span key={f} style={S.tag}>{f}</span>
          ))}
        </div>
      );

    case 'account': {
      const { currentUser } = useApp();
      const [confirmLogout, setConfirmLogout] = useState(false);

      const handleLogout = () => {
        logout();
        onLogout(); // tells App.js to clear loggedInPlayer → shows LoginPage
      };

      return (
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
            Signed in as <strong>{currentUser}</strong>
          </div>

          {!confirmLogout ? (
            <button
              onClick={() => setConfirmLogout(true)}
              style={{
                width: '100%', padding: '10px',
                background: '#fff', border: '1.5px solid #e74c3c',
                color: '#e74c3c', borderRadius: 8,
                fontSize: 13, fontWeight: 500, cursor: 'pointer'
              }}
            >
              Sign out
            </button>
          ) : (
            <div style={{ background: '#fdf0ee', borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 12, color: '#555', margin: '0 0 10px' }}>
                Sign out as <strong>{currentUser}</strong>?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleLogout}
                  style={{
                    flex: 1, padding: '8px', background: '#e74c3c',
                    color: '#fff', border: 'none', borderRadius: 6,
                    fontSize: 13, cursor: 'pointer'
                  }}
                >
                  Yes, sign out
                </button>
                <button
                  onClick={() => setConfirmLogout(false)}
                  style={{
                    flex: 1, padding: '8px', background: '#ddd',
                    color: '#333', border: 'none', borderRadius: 6,
                    fontSize: 13, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
    case 'mvprules':
      return (
        <>
          <SubHead label="Batting"/>
          <Row label="Run points"       val={`${rules.batting.runPoints} pt/run`}/>
          <Row label="Four bonus"       val={`+${rules.batting.boundaryBonus.four} pt`}/>
          <Row label="Six bonus"        val={`+${rules.batting.boundaryBonus.six} pts`}/>
          <Row label="Not out bonus"    val={`${rules.batting.notOutBonus.multiplier*100}% of bat pts`}/>
          <Row label="SR threshold"     val={rules.batting.strikeRate.threshold}/>
          <Row label="SR bonus mult"    val={`×${rules.batting.strikeRate.bonusMultiplier}`}/>
          <Row label="SR penalty mult"  val={`×${rules.batting.strikeRate.penaltyMultiplier}`}/>
          <Row label="Max SR penalty"   val={rules.batting.strikeRate.maxPenalty}/>
          {Object.entries(rules.batting.milestones||{}).map(([m,p]) => (
            <Row key={m} label={`${m}+ runs`} val={`+${p} pts`}/>
          ))}

          <SubHead label="Bowling"/>
          {Object.entries(rules.bowling.wicketTypes||{}).map(([type,pts]) => (
            pts > 0 &&
            <Row key={type} label={type.charAt(0).toUpperCase()+type.slice(1)} val={`${pts} pts`}/>
          ))}
          <Row label="Maiden over"      val={`+${rules.bowling.maidenOver} pts`}/>
          <Row label="Expected economy" val={rules.bowling.economy.expectedEconomy}/>
          <Row label="Economy mult"     val={`×${rules.bowling.economy.multiplier}`}/>
          <Row label="Max eco penalty"  val={rules.bowling.economy.maxPenalty}/>
          {Object.entries(rules.bowling.milestones||{}).map(([m,p]) => (
            <Row key={m} label={`${m}+ wickets`} val={`+${p} pts`}/>
          ))}

          <SubHead label="Fielding"/>
          <Row label="Catch"      val={`${rules.fielding.catch} pts`}/>
          <Row label="Stumping"   val={`${rules.fielding.stumping} pts`}/>
          <Row label="Direct RO"  val={`${rules.fielding.directRunOut} pts`}/>
          <Row label="Combo RO"   val={`${rules.fielding.comboRunOut} pts`}/>

          {rules.captaincy && (
            <>
              <SubHead label="Captaincy"/>
              <Row label="Win"  val={`${rules.captaincy.win} pts`}/>
              <Row label="Loss" val={`${rules.captaincy.loss} pts`}/>
            </>
          )}
        </>
      );

    case 'awards': {
      const all = awardsEngine.getAllAwards(sport);
      if (!all.length) return <div style={S.emptyNote}>No awards recorded yet</div>;
      return (
        <>
          {all.map((a,i) => (
            <div key={i} style={S.awardRow}>
              <div style={S.awardSeason}>S{a.season} · {a.format}</div>
              <div style={S.awardDetails}>
                {a.mos        && <AwardBadge icon="⭐" label="MoS"        val={a.mos}/>}
                {a.orangeCap  && <AwardBadge icon="🟠" label="Orange Cap" val={a.orangeCap}/>}
                {a.purpleCap  && <AwardBadge icon="🟣" label="Purple Cap" val={a.purpleCap}/>}
              </div>
            </div>
          ))}
        </>
      );
    }

    case 'other':
      return (
        <>
          <SubHead label="Leaderboard"/>
          <Row label="MVP qualification"
            val={`${((appConfig.leaderboard?.mvpQualificationThreshold||0.6)*100).toFixed(0)}% of matches`}/>
          <Row label="Recent form matches"
            val={appConfig.leaderboard?.recentFormMatches || 10}/>
          <Row label="Partnership preview"
            val={`Top ${appConfig.leaderboard?.partnershipPreviewCount || 10}`}/>

          <SubHead label="Carousel"/>
          <Row label="Player eligibility"
            val={`${((appConfig.carousel?.playerEligibilityThreshold||0.25)*100).toFixed(0)}% of matches`}/>
        </>
      );

    case 'account':
      return <AccountSection onLogout={onLogout} />;
    default: return null;
  }
}

function AccountSection({ onLogout }) {
  const { currentUser } = useApp();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = () => {
    logout();
    onLogout();
  };

  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
        Signed in as <strong>{currentUser}</strong>
      </div>
      {!confirmLogout ? (
        <button
          onClick={() => setConfirmLogout(true)}
          style={{
            width: '100%', padding: '10px',
            background: '#fff', border: '1.5px solid #e74c3c',
            color: '#e74c3c', borderRadius: 8,
            fontSize: 13, fontWeight: 500, cursor: 'pointer'
          }}
        >
          Sign out
        </button>
      ) : (
        <div style={{ background: '#fdf0ee', borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 12, color: '#555', margin: '0 0 10px' }}>
            Sign out as <strong>{currentUser}</strong>?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleLogout}
              style={{
                flex: 1, padding: '8px', background: '#e74c3c',
                color: '#fff', border: 'none', borderRadius: 6,
                fontSize: 13, cursor: 'pointer'
              }}
            >
              Yes, sign out
            </button>
            <button
              onClick={() => setConfirmLogout(false)}
              style={{
                flex: 1, padding: '8px', background: '#ddd',
                color: '#333', border: 'none', borderRadius: 6,
                fontSize: 13, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, val }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={S.rowVal}>{val ?? '-'}</span>
    </div>
  );
}

function SubHead({ label }) {
  return <div style={S.subHead}>{label}</div>;
}

function AwardBadge({ icon, label, val }) {
  return (
    <div style={S.awardBadge}>
      <span>{icon}</span>
      <span style={S.awardBadgeLabel}>{label}:</span>
      <span style={S.awardBadgeVal}>{val}</span>
    </div>
  );
}

const S = {
  page:   { minHeight:'100vh', background:'#f5f5f5', paddingBottom:32 },
  header: { padding:'12px 16px 14px' },
  backBtn: {
    background:'none', border:'none',
    color:'#222', fontSize:13,
    cursor:'pointer', padding:0, display:'block', marginBottom:6,
  },
  headerTitle: { fontSize:18, fontWeight:600, color:'#222', textAlign:'center' },
  body: { padding:'10px 12px' },
  section: {
    background:'#fff', borderRadius:10,
    border:'0.5px solid #eee', marginBottom:8,
    overflow:'hidden',
  },
  sectionHeader: {
    width:'100%', display:'flex', alignItems:'center',
    gap:10, padding:'12px 14px',
    background:'none', border:'none', cursor:'pointer',
    textAlign:'left',
  },
  sectionIcon:    { fontSize:16, flexShrink:0 },
  sectionLabel:   { flex:1, fontSize:14, fontWeight:500, color:'#222' },
  sectionChevron: { fontSize:10, color:'#aaa' },
  sectionBody: {
    borderTop:'0.5px solid #f0f0f0',
    padding:'8px 0',
  },
  subHead: {
    fontSize:10, fontWeight:600, color:ACCENT,
    padding:'8px 14px 4px',
    letterSpacing:0.5, textTransform:'uppercase',
  },
  row: {
    display:'flex', justifyContent:'space-between',
    alignItems:'center', padding:'7px 14px',
    borderBottom:'0.5px solid #f8f8f8',
  },
  rowLabel: { fontSize:12, color:'#666' },
  rowVal:   { fontSize:12, fontWeight:500, color:'#222', textAlign:'right', maxWidth:'55%' },
  tagWrap: {
    display:'flex', flexWrap:'wrap', gap:6,
    padding:'8px 14px',
  },
  tag: {
    fontSize:12, background:'#f0f0f0',
    color:'#444', padding:'4px 10px',
    borderRadius:12,
  },
  subSection: { padding:'4px 0 8px' },
  subLabel: {
    fontSize:10, color:'#aaa', fontWeight:500,
    padding:'4px 14px 2px',
    letterSpacing:0.5, textTransform:'uppercase',
  },
  emptyNote: { fontSize:12, color:'#bbb', padding:'6px 14px', fontStyle:'italic' },
  awardRow: {
    padding:'8px 14px', borderBottom:'0.5px solid #f8f8f8',
  },
  awardSeason: { fontSize:11, fontWeight:500, color:'#0C447C', marginBottom:4 },
  awardDetails:{ display:'flex', flexWrap:'wrap', gap:8 },
  awardBadge: {
    display:'flex', alignItems:'center', gap:4,
    fontSize:12, color:'#333',
  },
  awardBadgeLabel: { color:'#888', fontSize:11 },
  awardBadgeVal:   { fontWeight:500, color:'#222' },
};
