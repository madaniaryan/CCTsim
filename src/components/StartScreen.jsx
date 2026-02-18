import { useState } from 'react';

export default function StartScreen({ onStart, loadError }) {
  const [name, setName] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onStart(trimmed);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal start-modal">
        <h2>Start Shift</h2>
        <p>Enter your name to begin. Your final score will be added to the leaderboard.</p>
        {loadError && <p className="load-error">{loadError}</p>}
        <form onSubmit={submit} className="start-form">
          <input
            className="start-input"
            type="text"
            maxLength={24}
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="close" disabled={!name.trim()}>
            Begin Shift
          </button>
        </form>
      </div>
    </div>
  );
}
