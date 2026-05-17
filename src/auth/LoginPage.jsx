// src/auth/LoginPage.jsx
import { useState } from 'react';
import { login, resetPassword } from './authUtils';
import playersConfig from '../config/players.config.json';

// Extract player names — second value in each row
// Adjust this line if your JSON structure is different
// e.g. if rows look like: [["RCL001", "Rahul"], ["RCL002", "Aman"], ...]
const PLAYER_NAMES = Object.values(playersConfig).sort();

export default function LoginPage({ onLogin }) {
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (!selectedPlayer) { setError('Please select your name'); return; }
    setLoading(true);
    setError('');

    const result = login(selectedPlayer, password);
    if (result.success) {
      onLogin(selectedPlayer);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleReset = () => {
    if (!selectedPlayer) { setResetMsg('Please select your name first'); return; }
    resetPassword(selectedPlayer);
    setResetMsg(`Password for ${selectedPlayer} has been reset to "racl"`);
    setPassword('');
    setShowReset(false);
  };

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', alignItems: 'center',
      justifyContent: 'center', background: '#1a1a2e', padding: '1rem'
    }}>
      <div style={{
        background: '#fff', padding: '2rem', borderRadius: '16px',
        width: '100%', maxWidth: '360px', boxSizing: 'border-box'
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem' }}>🏏</div>
          <h1 style={{ margin: '0.25rem 0 0', fontSize: '1.4rem', fontWeight: '600', color: '#1a1a2e' }}>
            RACL Stats
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#888' }}>
            Members only
          </p>
        </div>

        <form onSubmit={handleLogin}>
          {/* Player dropdown */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', color: '#555', marginBottom: '4px' }}>
              Your name
            </label>
            <select
              value={selectedPlayer}
              onChange={e => { setSelectedPlayer(e.target.value); setError(''); setResetMsg(''); }}
              style={{
                width: '100%', padding: '10px 12px', border: '1.5px solid #ddd',
                borderRadius: '8px', fontSize: '1rem', background: '#fff',
                color: selectedPlayer ? '#111' : '#999', boxSizing: 'border-box',
                appearance: 'auto'
              }}
            >
              <option value="">— Select your name —</option>
              {PLAYER_NAMES.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', color: '#555', marginBottom: '4px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Password"
              autoComplete="current-password"
              style={{
                width: '100%', padding: '10px 12px', border: '1.5px solid #ddd',
                borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <p style={{
              color: '#c0392b', fontSize: '0.83rem', margin: '0 0 1rem',
              padding: '8px 12px', background: '#fdf0ee', borderRadius: '6px'
            }}>
              {error}
            </p>
          )}

          {/* Reset message */}
          {resetMsg && (
            <p style={{
              color: '#27ae60', fontSize: '0.83rem', margin: '0 0 1rem',
              padding: '8px 12px', background: '#eafaf1', borderRadius: '6px'
            }}>
              {resetMsg}
            </p>
          )}

          {/* Sign in button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', background: '#2c7a4b', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '500',
              cursor: 'pointer', marginBottom: '0.75rem'
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {/* Reset password toggle */}
          {!showReset ? (
            <button
              type="button"
              onClick={() => { setShowReset(true); setResetMsg(''); }}
              style={{
                width: '100%', background: 'none', border: 'none',
                color: '#888', fontSize: '0.83rem', cursor: 'pointer', padding: '4px'
              }}
            >
              Forgot password?
            </button>
          ) : (
            <div style={{
              padding: '12px', background: '#f8f8f8', borderRadius: '8px', marginTop: '4px'
            }}>
              <p style={{ fontSize: '0.82rem', color: '#555', margin: '0 0 8px' }}>
                This will reset <strong>{selectedPlayer || 'the selected player'}</strong>'s password back to <code>racl</code>.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    flex: 1, padding: '8px', background: '#e74c3c', color: '#fff',
                    border: 'none', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer'
                  }}
                >
                  Reset to "racl"
                </button>
                <button
                  type="button"
                  onClick={() => setShowReset(false)}
                  style={{
                    flex: 1, padding: '8px', background: '#ddd', color: '#333',
                    border: 'none', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
