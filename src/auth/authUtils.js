// src/auth/authUtils.js
// Client-side auth for RACL Stats App
// Passwords stored in localStorage — suitable for a private friends app

const STORAGE_KEY = 'racl_auth';
const DEFAULT_PASSWORD = 'racl';

// Load all stored passwords from localStorage
// Structure: { "Rahul": "racl", "Aman": "mypassword123", ... }
function getPasswordStore() {
  try {
    return JSON.parse(localStorage.getItem('racl_passwords') || '{}');
  } catch {
    return {};
  }
}

// Get the effective password for a player (stored password, or default 'racl')
function getPasswordForPlayer(playerName) {
  const store = getPasswordStore();
  return store[playerName] || DEFAULT_PASSWORD;
}

// --- Auth actions ---

export function login(playerName, password) {
  const expected = getPasswordForPlayer(playerName);
  if (password !== expected) return { success: false, error: 'Incorrect password' };

  const session = { playerName, loggedInAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return { success: true };
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw); // { playerName, loggedInAt }
  } catch {
    return null;
  }
}

export function changePassword(playerName, currentPassword, newPassword) {
  const expected = getPasswordForPlayer(playerName);
  if (currentPassword !== expected) return { success: false, error: 'Current password is incorrect' };
  if (!newPassword || newPassword.length < 4) return { success: false, error: 'New password must be at least 4 characters' };

  const store = getPasswordStore();
  store[playerName] = newPassword;
  localStorage.setItem('racl_passwords', JSON.stringify(store));
  return { success: true };
}

export function resetPassword(playerName) {
  // Resets to default 'racl'
  const store = getPasswordStore();
  delete store[playerName]; // removing entry = falls back to DEFAULT_PASSWORD
  localStorage.setItem('racl_passwords', JSON.stringify(store));
  return { success: true };
}

export const DEFAULT_PLAYER_PASSWORD = DEFAULT_PASSWORD;
