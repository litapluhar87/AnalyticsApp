import React from 'react';
export default function Settings({ onClose }) {
  return (
    <div style={{padding:16}}>
      <button onClick={onClose}>← Back</button>
      <h2>Settings</h2>
    </div>
  );
}