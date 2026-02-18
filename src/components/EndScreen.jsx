import { useRef, useState } from 'react';

export default function EndScreen({ summary, score, distractorStats, distractorEvents }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };
  return (
    <main className="end">
      <h2>End of Shift Summary</h2>
      <div className="end-grid">
        <section className="end-card">
          <h3>Overall Score</h3>
          <p className="big-score">{score}</p>
          <p>Multitask accuracy: {distractorStats.correct}/{distractorStats.total}</p>
          <div className="audio-controls">
            <button className="audio-button" onClick={toggleAudio}>
              {isPlaying ? 'Pause End Music' : 'Play End Music'}
            </button>
            <audio
              ref={audioRef}
              src="/assets/audio/end_screen.wav"
              autoPlay
              onEnded={() => setIsPlaying(false)}
            />
          </div>
        </section>
        <section className="end-card">
          <h3>Score Breakdown</h3>
          {summary.map((item) => (
            <div key={`${item.id}-score`} className="case-card">
              <div className="case-header">
                <div>
                  <strong>{typeof item.room === 'string' ? item.room : `Room ${item.room}`}: {item.name}</strong>
                  <div className="case-outcome">Patient score: {item.patientScore}</div>
                </div>
              </div>
              {item.scoreEvents.length > 0 ? (
                <ul className="case-list">
                  {item.scoreEvents.map((evt, idx) => (
                    <li key={`${item.id}-evt-${idx}`}>
                      {evt.label} ({evt.delta > 0 ? '+' : ''}{evt.delta})
                    </li>
                  ))}
                </ul>
              ) : (
                <div>No score events recorded.</div>
              )}
            </div>
          ))}
          <div className="case-card">
            <div className="case-header">
              <div>
                <strong>Distractors</strong>
              </div>
              <div className="case-status">Total: {distractorEvents.reduce((sum, e) => sum + (e.delta || 0), 0)}</div>
            </div>
            {distractorEvents.length > 0 ? (
              <ul className="case-list">
                {distractorEvents.map((evt, idx) => (
                  <li key={`distractor-${idx}`}>
                    {evt.choice} ({evt.delta > 0 ? '+' : ''}{evt.delta})
                  </li>
                ))}
              </ul>
            ) : (
              <div>No distractor responses recorded.</div>
            )}
          </div>
        </section>
        <section className="end-card">
          <h3>Case Review</h3>
          {summary.map((item) => {
            const completed = item.critical.length - item.missed.length;
            return (
              <div key={item.id} className="case-card">
                <div className="case-header">
                  <div>
                    <strong>{typeof item.room === 'string' ? item.room : `Room ${item.room}`}: {item.name}</strong>
                    <div className="case-outcome">{item.outcome}</div>
                  </div>
                  <div className="case-status">
                    Completed {completed}/{item.critical.length} critical actions
                  </div>
                </div>
                <div className="case-section">
                  <div className="case-label">Answer</div>
                  <div>{item.diagnoses.length > 0 ? item.diagnoses.join(', ') : 'No diagnosis listed.'}</div>
                </div>
                <div className="case-section">
                  <div className="case-label">Correct Workup</div>
                  {item.critical.length > 0 ? (
                    <ul className="case-list">
                      {item.critical.map((action) => (
                        <li key={action.id}>{action.label}</li>
                      ))}
                    </ul>
                  ) : (
                    <div>No critical actions defined.</div>
                  )}
                </div>
                <div className="case-section">
                  <div className="case-label">Your Workup</div>
                  {item.ordered.length > 0 ? (
                    <ul className="case-list">
                      {item.ordered.map((action) => (
                        <li key={action.id}>{action.label}</li>
                      ))}
                    </ul>
                  ) : (
                    <div>No orders placed.</div>
                  )}
                </div>
                <div className="case-section">
                  <div className="case-label">Missed</div>
                  <div className="missed">
                    {item.missed.length > 0
                      ? item.missed.map((m) => m.label).join(', ')
                      : 'All critical steps completed'}
                  </div>
                </div>
                {item.endSummary?.successText && (
                  <div className="case-section">
                    <div className="case-label">Recommended Approach</div>
                    <div>{item.endSummary.successText}</div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
        <section className="end-card">
          <h3>Thank You & Credits</h3>
          <p>Thank you to Dr. Willis and the Assistant Program Directors for giving me a shot and trusting me with the privilege of being a doctor here. I wanted this more than anything.</p>
          <p>Thank you to the APDs — Dr. Hassel, Dr. Janairo, Dr. Buckridge, and Dr. Camacho. Your guidance, support, and belief in us have meant more than you know.</p>
          <p>Dr. Youseff, thank you for always supporting this department and the people in it.</p>
          <p>To my co-residents — Kelsey, Collin, and Alice — thank you for showing a random kid from LA how to live, grow, and survive in NYC.</p>
          <p>To my future wife and the love of my life, Phoebe Draper — thank you for your endless support, day in and day out. Thank you for helping me find the best version of myself.</p>
          <p>And finally, Nahid and Massoud — I would not be who I am today without the love, support, and sacrifices you made for me.</p>
        </section>
      </div>
    </main>
  );
}
