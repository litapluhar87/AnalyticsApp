import React, { useState, useEffect, createContext, useContext } from 'react';
import Home from './pages/Home';
import Matches from './pages/Matches';
import MyCricket from './pages/MyCricket';
import Leaderboard from './pages/Leaderboard';
import Charts from './pages/Charts';
import Settings from './pages/Settings';
import { getSession, logout } from './auth/authUtils';
import LoginPage from './auth/LoginPage';
import { getDefaultSport } from './auth/getDefaultSport';

export const AppContext = createContext();
export function useApp() { return useContext(AppContext); }

const TABS = [
  { id:'home',        label:'Home',        icon:'⌂',  color:'#0C447C' },
  { id:'matches',     label:'Matches',     icon:'🏏', color:'#993C1D' },
  { id:'mycricket',   label:'My Cricket',  icon:'👤', color:'#534AB7' },
  { id:'leaderboard', label:'Leaderboard', icon:'🏆', color:'#27500A' },
  { id:'charts',      label:'Charts',      icon:'📈', color:'#27500A' },
];

const SPORT_TYPES  = ['Classic','Box','Pair'];
const SEASONS_PAIR = ['All','6'];
const FORMATS      = ['All','T12','Test'];

export default function App() {

  // ── Auth state ──────────────────────────────────────────────
  const [loggedInPlayer, setLoggedInPlayer] = useState(null); // null = checking

  useEffect(() => {
    const session = getSession();
    setLoggedInPlayer(session ? session.playerName : '');
  }, []);

  const handleLogin = (playerName) => {
    setLoggedInPlayer(playerName);
    setSportType(getDefaultSport(playerName));
    setActiveTab('home');
    setShowSettings(false);
  };
  const handleLogout = () => { logout(); setLoggedInPlayer(''); setActiveTab('home'); setShowSettings(false); };

  // ── App state ────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState('home');
  const [sportType, setSportType] = useState(() => getDefaultSport(loggedInPlayer));
  const [season,       setSeason]       = useState('All');
  const [format,       setFormat]       = useState('All');
  const [showSettings, setShowSettings] = useState(false);
  const [currentUser,  setCurrentUser]  = useState('Rahul'); // placeholder until auth resolves
  const [isAdmin,      setIsAdmin]      = useState(true);

  // Once auth resolves, sync currentUser to the logged-in player
  useEffect(() => {
    if (loggedInPlayer) setCurrentUser(loggedInPlayer);
  }, [loggedInPlayer]);

  // ── Still checking localStorage ──────────────────────────────
  if (loggedInPlayer === null) return null;

  // ── Not logged in ────────────────────────────────────────────
  if (loggedInPlayer === '') return <LoginPage onLogin={handleLogin} />;

  // ── Logged in — render app ───────────────────────────────────

  const activeColor = TABS.find(t => t.id === activeTab)?.color || '#0C447C';

  const seasonOptions = (() => {
    if (sportType === 'Pair') return SEASONS_PAIR;
    try {
      const cfg = require('./config/' + sportType.toLowerCase() + '.config.json');
      return ['All', ...(cfg.seasons || []).map(s => String(s))];
    } catch(_) { return ['All']; }
  })();

  const ctx = {
    sportType, setSportType,
    format, setFormat,
    season, setSeason,
    currentUser, setCurrentUser,
    isAdmin,
    activeColor,
    navigateTo: (tab) => { setShowSettings(false); setActiveTab(tab); },
  };

  const renderPage = () => {
    if (showSettings) return (
      <Settings
        onClose={() => setShowSettings(false)}
        onLogout={handleLogout}
      />
    );
    switch (activeTab) {
      case 'home':        return <Home/>;
      case 'matches':     return <Matches/>;
      case 'mycricket':   return <MyCricket/>;
      case 'leaderboard': return <Leaderboard/>;
      case 'charts':      return <Charts/>;
      default:            return <Home/>;
    }
  };

  return (
    <AppContext.Provider value={ctx}>
      <div style={S.shell}>

        {/* Sticky header */}
        <div style={{ ...S.header, background: activeColor }}>
          <div style={S.headerRow}>
            <div style={S.appName}>RACL</div>
            <div style={S.headerRight}>
              <button style={S.gearBtn} onClick={() => setShowSettings(s => !s)}>⚙</button>
              <div style={S.avatar}>{currentUser.slice(0,2).toUpperCase()}</div>
            </div>
          </div>
          <div style={S.dropdownRow}>
            <select value={sportType} onChange={e => { setSportType(e.target.value); setSeason('All'); }} style={S.filterSelect}>
              {SPORT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={season} onChange={e => setSeason(e.target.value)} style={S.filterSelect}>
              {seasonOptions.map(s => <option key={s} value={s}>{s === 'All' ? 'All' : `S${s}`}</option>)}
            </select>
            <select value={format} onChange={e => setFormat(e.target.value)} style={S.filterSelect}>
              {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* Top tab nav */}
        {!showSettings && (
          <div style={S.topNav}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                style={{
                  ...S.navItem,
                  borderTop:    activeTab === tab.id ? `3px solid ${tab.color}` : '3px solid transparent',
                  borderLeft:   activeTab === tab.id ? '0.5px solid #e0e0e0'    : '0.5px solid transparent',
                  borderRight:  activeTab === tab.id ? '0.5px solid #e0e0e0'    : '0.5px solid transparent',
                  borderBottom: activeTab === tab.id ? '2px solid #fff'          : '0.5px solid transparent',
                  background:   activeTab === tab.id ? '#fff' : '#f5f5f5',
                  marginBottom: activeTab === tab.id ? -1 : 0,
                }}
                onClick={() => setActiveTab(tab.id)}>
                <span style={{ fontSize:16, lineHeight:1, opacity: activeTab === tab.id ? 1 : 0.4 }}>
                  {tab.icon}
                </span>
                <span style={{ ...S.navLabel, fontSize:11, color: activeTab === tab.id ? tab.color : '#aaa', fontWeight: activeTab === tab.id ? 600 : 400 }}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Page content */}
        <div style={S.content}>{renderPage()}</div>

      </div>
    </AppContext.Provider>
  );
}

const S = {
  shell:       { maxWidth:480, margin:'0 auto', height:'100vh', display:'flex', flexDirection:'column', fontFamily:'system-ui, -apple-system, sans-serif', background:'#f5f5f5', overflow:'hidden' },
  header:      { position:'sticky', top:0, zIndex:200, padding:'10px 14px 10px', flexShrink:0, WebkitBackfaceVisibility:'hidden' },
  headerRow:   { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  headerRight: { display:'flex', alignItems:'center', gap:8 },
  appName:     { fontSize:20, fontWeight:600, color:'#fff', letterSpacing:0.3, whiteSpace:'nowrap' },
  dropdownRow: { display:'flex', gap:8 },
  filterSelect:{ background:'#fff', border:'1px solid rgba(255,255,255,0.25)', color:'#333', borderRadius:8, fontSize:12, padding:'5px 6px', cursor:'pointer', outline:'none', flex:1 },
  gearBtn:     { width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  avatar:      { width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.25)', border:'1.5px solid rgba(255,255,255,0.4)', color:'#fff', fontSize:11, fontWeight:500, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  content:     { flex:1, overflowY:'auto', paddingBottom:24, WebkitOverflowScrolling:'touch' },
  topNav:      { flexShrink:0, width:'100%', background:'#fff', borderBottom:'0.5px solid #e0e0e0', display:'flex', zIndex:150, paddingTop:2 },
  navItem:     { flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'6px 2px 4px', gap:3, cursor:'pointer', transition:'background 0.15s' },
  navLabel:    { fontSize:11, letterSpacing:0.2 },
};
