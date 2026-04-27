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
  { id: 'home',        label: 'Home',        color: '#0C447C' },
  { id: 'matches',     label: 'Matches',     color: '#993C1D' },
  { id: 'mycricket',   label: 'My Cricket',  color: '#534AB7' },
  { id: 'leaderboard', label: 'Leaderboard', color: '#27500A' },
  { id: 'charts',      label: 'Charts',      color: '#27500A' },
];

const SPORT_TYPES = ['Classic', 'Box', 'Pair'];
const FORMATS     = ['All', 'T12', 'Test'];

export default function App() {
  const [activeTab,    setActiveTab]    = useState('home');
  const [sportType,    setSportType]    = useState('Box');
  const [format,       setFormat]       = useState('T12');
  const [season,       setSeason]       = useState('6');
  const [showSettings, setShowSettings] = useState(false);
  const [currentUser,  setCurrentUser]  = useState('Rahul');
  const [isAdmin,      setIsAdmin]      = useState(true);

  const activeColor = TABS.find(t => t.id === activeTab)?.color || '#0C447C';

  const ctx = {
    sportType, setSportType,
    format, setFormat,
    season, setSeason,
    currentUser, setCurrentUser,
    isAdmin,
    activeColor,
    navigateTo: setActiveTab,
  };

  const renderPage = () => {
    if (showSettings) return <Settings onClose={() => setShowSettings(false)} />;
    switch (activeTab) {
      case 'home':        return <Home />;
      case 'matches':     return <Matches />;
      case 'mycricket':   return <MyCricket />;
      case 'leaderboard': return <Leaderboard />;
      case 'charts':      return <Charts />;
      default:            return <Home />;
    }
  };

  return (
    <AppContext.Provider value={ctx}>
      <div style={styles.shell}>

        {/* Global header */}
        <div style={{ ...styles.header, background: activeColor }}>
          <div style={styles.headerTop}>
            <div>
              <div style={styles.appName}>RACL Cricket</div>
              <div style={styles.appSub}>
                {sportType} · {format} · Season {season}
              </div>
            </div>
            <div style={styles.headerRight}>
              <button style={styles.gearBtn} onClick={() => setShowSettings(s => !s)}>⚙</button>
              <div style={styles.avatar}>{currentUser.slice(0,2).toUpperCase()}</div>
            </div>
          </div>

          {/* Sport type toggle */}
          <div style={styles.pillRow}>
            {SPORT_TYPES.map(s => (
              <button key={s}
                style={sportType === s ? styles.pillOn : styles.pillOff}
                onClick={() => setSportType(s)}>
                {s}
              </button>
            ))}
          </div>

          {/* Format toggle */}
          <div style={{ ...styles.pillRow, marginTop: 6 }}>
            {FORMATS.map(f => (
              <button key={f}
                style={format === f ? styles.pillOn : styles.pillOff}
                onClick={() => setFormat(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Page content */}
        <div style={styles.content}>
          {renderPage()}
        </div>

        {/* Bottom nav */}
        {!showSettings && (
          <div style={styles.bottomNav}>
            {TABS.map(tab => (
              <button key={tab.id}
                style={styles.navItem}
                onClick={() => setActiveTab(tab.id)}>
                <div style={{
                  ...styles.navBar,
                  background: activeTab === tab.id ? tab.color : 'transparent'
                }}/>
                <span style={{
                  ...styles.navLabel,
                  color: activeTab === tab.id ? tab.color : 'var(--color-text-secondary)',
                  fontWeight: activeTab === tab.id ? 500 : 400
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

const styles = {
  shell: {
    maxWidth: 480,
    margin: '0 auto',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: '#f5f5f5',
  },
  header: {
    padding: '12px 16px 14px',
    flexShrink: 0,
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  appName: {
    fontSize: 17,
    fontWeight: 500,
    color: '#fff',
  },
  appSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
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
  },
  pillRow: {
    display: 'flex',
    gap: 6,
  },
  pillOn: {
    padding: '4px 12px',
    borderRadius: 14,
    fontSize: 11,
    fontWeight: 500,
    background: '#fff',
    color: '#333',
    border: 'none',
    cursor: 'pointer',
  },
  pillOff: {
    padding: '4px 12px',
    borderRadius: 14,
    fontSize: 11,
    fontWeight: 500,
    background: 'rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.8)',
    border: '1px solid rgba(255,255,255,0.2)',
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: 60,
  },
  bottomNav: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: 480,
    background: '#fff',
    borderTop: '0.5px solid #e0e0e0',
    display: 'flex',
    zIndex: 100,
  },
  navItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0 10px',
    gap: 3,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  navBar: {
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  navLabel: {
    fontSize: 10,
  },
};