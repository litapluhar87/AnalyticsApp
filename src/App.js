import React, { useState, createContext, useContext } from 'react';
import Home from './pages/Home';
import Matches from './pages/Matches';
import MyCricket from './pages/MyCricket';
import Leaderboard from './pages/Leaderboard';
import Charts from './pages/Charts';
import Settings from './pages/Settings';

export const AppContext = createContext();
export function useApp() { return useContext(AppContext); }

const TABS = [
  { id:'home',        label:'Home',        icon:'⌂',  color:'#0C447C' },
  { id:'matches',     label:'Matches',     icon:'🏏', color:'#993C1D' },
  { id:'mycricket',   label:'My Cricket',  icon:'👤', color:'#534AB7' },
  { id:'leaderboard', label:'Leaderboard', icon:'★',  color:'#27500A' },
  { id:'charts',      label:'Charts',      icon:'▦',  color:'#27500A' },
];

const SPORT_TYPES = ['Classic','Box','Pair'];
const SEASONS_BOX      = ['All','3','4','5','6'];
const SEASONS_CLASSIC  = ['All','1','2','3','4','5','6'];
const SEASONS_PAIR     = ['All','6'];
const FORMATS          = ['All','T12','Test'];

export default function App() {
  const [activeTab,    setActiveTab]    = useState('home');
  const [sportType,    setSportType]    = useState('Box');
  const [season,       setSeason]       = useState('All');
  const [format,       setFormat]       = useState('All');
  const [showSettings, setShowSettings] = useState(false);
  const [currentUser,  setCurrentUser]  = useState('Rahul');
  const [isAdmin,      setIsAdmin]      = useState(true);

  const activeColor = TABS.find(t => t.id === activeTab)?.color || '#0C447C';

  const seasonOptions = sportType === 'Classic'
    ? SEASONS_CLASSIC
    : sportType === 'Pair'
      ? SEASONS_PAIR
      : SEASONS_BOX;

  const ctx = {
    sportType, setSportType,
    format, setFormat,
    season, setSeason,
    currentUser, setCurrentUser,
    isAdmin,
    activeColor,
    navigateTo: (tab) => {
      setShowSettings(false);
      setActiveTab(tab);
    },
  };

  const renderPage = () => {
    if (showSettings) return <Settings onClose={() => setShowSettings(false)}/>;
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

            {/* Left: title only */}
            <div style={S.titleBlock}>
              <div style={S.appName}>RACL Cricket</div>
            </div>

            {/* Right: all three dropdowns + gear + avatar */}
            <div style={S.rightBlock}>
              <select
                value={sportType}
                onChange={e => {
                  setSportType(e.target.value);
                  setSeason('All');
                }}
                style={S.filterSelect}>
                {SPORT_TYPES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={season}
                onChange={e => setSeason(e.target.value)}
                style={S.filterSelect}>
                {seasonOptions.map(s => (
                  <option key={s} value={s}>
                    {s === 'All' ? 'All' : `S${s}`}
                  </option>
                ))}
              </select>
              <select
                value={format}
                onChange={e => setFormat(e.target.value)}
                style={S.filterSelect}>
                {FORMATS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <button
                style={S.gearBtn}
                onClick={() => setShowSettings(s => !s)}>
                ⚙
              </button>
              <div style={S.avatar}>
                {currentUser.slice(0,2).toUpperCase()}
              </div>
            </div>

          </div>
        </div>

        {/* Page content */}
        <div style={S.content}>
          {renderPage()}
        </div>

        {/* Bottom nav */}
        {!showSettings && (
          <div style={S.bottomNav}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                style={S.navItem}
                onClick={() => setActiveTab(tab.id)}>
                <div style={{
                  ...S.navBar,
                  background: activeTab === tab.id
                    ? tab.color
                    : 'transparent'
                }}/>
                <span style={{
                  fontSize: 18,
                  lineHeight: 1,
                  filter: activeTab === tab.id ? 'none' : 'opacity(0.35)',
                }}>
                  {tab.icon}
                </span>
                <span style={{
                  ...S.navLabel,
                  color: activeTab === tab.id
                    ? tab.color
                    : '#aaa',
                  fontWeight: activeTab === tab.id ? 500 : 400,
                }}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        )}

      </div>
    </AppContext.Provider>
  );
}

const S = {
  shell: {
    maxWidth: 480,
    margin: '0 auto',
    minHeight: '100vh',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: '#f5f5f5',
    overflowY: 'auto',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 200,
    padding: '10px 14px 10px',
    flexShrink: 0,
    WebkitBackfaceVisibility: 'hidden',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleBlock: {
    flexShrink: 0,
  },
  appName: {
    fontSize: 20,
    fontWeight: 600,
    color: '#fff',
    letterSpacing: 0.3,
    whiteSpace: 'nowrap',
  },
  rightBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterSelect: {
    background: '#fff',
    border: '1px solid rgba(255,255,255,0.25)',
    color: '#333',
    borderRadius: 8,
    fontSize: 11,
    padding: '4px 5px',
    cursor: 'pointer',
    outline: 'none',
    maxWidth: 90,
  },
  gearBtn: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.25)',
    border: '1.5px solid rgba(255,255,255,0.4)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflowY: 'visible',
    paddingBottom: 70,
  },
  bottomNav: {
    position: 'sticky',
    bottom: 0,
    width: '100%',
    maxWidth: 480,
    background: '#fff',
    borderTop: '0.5px solid #e0e0e0',
    display: 'flex',
    zIndex: 100,
    flexShrink: 0,
    marginTop: 'auto',
  },
  navItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '6px 0 8px',
    gap: 2,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  navBar: {
    width: 20,
    height: 3,
    borderRadius: 2,
    marginBottom: 1,
  },
  navLabel: {
    fontSize: 9,
  },
};