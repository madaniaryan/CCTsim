import { useEffect, useMemo, useState } from 'react';
import Overview from './components/Overview.jsx';
import Room from './components/Room.jsx';
import DistractorModal from './components/DistractorModal.jsx';
import EndScreen from './components/EndScreen.jsx';
import {
  SHIFT_SECONDS,
  TIME_SCALE,
  evolvePatient,
  formatClock,
  getOrderLabel,
  initPatientRuntime,
  placeOrder,
  summarizeOutcome,
} from './engine/patientEngine.js';
import './styles.css';

async function loadJSON(path) {
  const res = await fetch(new URL(path, import.meta.url));
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

async function loadPatients() {
  const index = await loadJSON('./data/patients/index.json');
  const patients = [];
  for (const file of index.files) {
    const data = await loadJSON(`./data/patients/${file}`);
    patients.push(data);
  }
  return patients;
}

export default function App() {
  const [now, setNow] = useState(0);
  const [patients, setPatients] = useState([]);
  const [activePatientId, setActivePatientId] = useState(null);
  const [view, setView] = useState('overview');
  const [distractorScore, setDistractorScore] = useState(0);
  const [remainingDistractors, setRemainingDistractors] = useState([]);
  const [activeDistractor, setActiveDistractor] = useState(null);
  const [distractorStats, setDistractorStats] = useState({ correct: 0, total: 0 });
  const [distractorEvents, setDistractorEvents] = useState([]);
  const [adminQueue, setAdminQueue] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadPatients(), loadJSON('./data/distractors.json')]).then(
      ([patientData, distractorData]) => {
        if (!mounted) return;
        setPatients(patientData.map((data) => initPatientRuntime(data, 0)));
        const list = Array.isArray(distractorData)
          ? distractorData
          : distractorData.items || [];
        setRemainingDistractors(list);
      }
    );
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setNow((prev) => Math.min(prev + TIME_SCALE, SHIFT_SECONDS));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setPatients((prev) => prev.map((p) => evolvePatient(p, now, activePatientId)));
    if (now >= SHIFT_SECONDS) {
      setView('end');
      setActivePatientId(null);
    }
  }, [now, activePatientId]);

  const activePatient = useMemo(
    () => patients.find((p) => p.data.id === activePatientId),
    [patients, activePatientId]
  );
  const activeAdminMessage = adminQueue[0] || null;
  const totalScore = useMemo(() => {
    const patientScore = patients.reduce((sum, p) => sum + (p.score || 0), 0);
    return patientScore + distractorScore;
  }, [patients, distractorScore]);

  const handleEnterRoom = (patientId) => {
    setActivePatientId(patientId);
    setView('room');
  };

  const handleLeaveRoom = () => {
    if (activePatient?.flags?.admitTooEarly && !activePatient?.flags?.adminMessageScheduled) {
      const adminText =
        activePatient?.data?.id === 'P003'
          ? 'Message from Admin: Early antiplatelet therapy is a critical component of STEMI management and reduces thrombus propagation before PCI. We need to make sure those steps arent missed in time-sensitive cases like this.'
          : "Message from Admin: Hey -- we need to talk about the patient you admitted. There were a few important things that were missed, and I'm concerned about how some of these decisions were made. Let's sit down and go through the case together so we can tighten up your approach moving forward.";
      setPatients((prev) =>
        prev.map((p) =>
          p.data.id === activePatient.data.id
            ? {
                ...p,
                flags: { ...(p.flags || {}), adminMessageScheduled: true },
              }
            : p
        )
      );
      setTimeout(() => {
        setAdminQueue((prev) => [
          ...prev,
          {
            id: activePatient.data.id,
            text: adminText,
          },
        ]);
      }, 10000);
    }
    setActivePatientId(null);
    setView('overview');
    if (activeDistractor) return;
    if (remainingDistractors.length > 0) {
      const index = Math.floor(Math.random() * remainingDistractors.length);
      const card = remainingDistractors[index];
      setRemainingDistractors((prev) => prev.filter((_, i) => i !== index));
      setActiveDistractor({ card, answered: false, selected: null, correct: null });
    }
  };

  const handleOrder = (patientId, orderId) => {
    setPatients((prev) =>
      prev.map((p) => (p.data.id === patientId ? placeOrder(p, orderId, now) : p))
    );
  };

  const handleDistractorAnswer = (index) => {
    if (!activeDistractor || activeDistractor.answered) return;
    const choice = activeDistractor.card.choices[index];
    const delta = choice?.score || 0;
    const correct = delta > 0;
    setDistractorScore((s) => s + delta);
    setDistractorStats((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));
    setDistractorEvents((prev) => [
      {
        time: now,
        prompt: activeDistractor.card.prompt,
        choice: choice?.label || 'Unknown choice',
        delta,
      },
      ...prev,
    ]);
    setActiveDistractor({
      ...activeDistractor,
      answered: true,
      selected: index,
      selectedChoice: choice || null,
      correct,
    });
  };

  const handleCloseDistractor = () => {
    setActiveDistractor(null);
  };

  const summary = useMemo(() => {
    return patients.map((p) => {
      const outcome = summarizeOutcome(p, now);
      const critical = p.data.criticalActions
        || (p.data.scoring?.mustDo || []).map((item) => ({
          id: item.id,
          label: getOrderLabel(p.data, item.id),
        }));
      const missed = critical.filter(
        (action) => !p.ordersPlaced.some((order) => order.id === action.id)
      );
      const ordered = p.ordersPlaced.map((order) => ({
        id: order.id,
        label: getOrderLabel(p.data, order.id),
      }));
      return {
        id: p.data.id,
        name: p.data.name || p.data.title,
        room: p.data.room?.label || p.data.room,
        outcome,
        missed,
        critical,
        ordered,
        diagnoses: p.data.truth?.diagnoses || [],
        endSummary: p.data.endSummary || null,
        scoreEvents: p.scoreEvents || [],
        patientScore: p.score || 0,
      };
    });
  }, [patients, now]);

  const handleSignOut = () => {
    setNow(SHIFT_SECONDS);
    setView('end');
    setActivePatientId(null);
  };

  return (
    <div className="app">
      <header className="top-bar">
        <div>
          <h1>Emergency Medicine Shift Simulator</h1>
          <p>Global Time: {formatClock(now)} / {formatClock(SHIFT_SECONDS)}</p>
        </div>
        <div className="score-box">
          <div className="score-label">Score</div>
          <div className="score-value">{totalScore}</div>
        </div>
        <button className="signout" onClick={handleSignOut}>Sign out</button>
      </header>

      {view === 'overview' && (
        <Overview patients={patients} now={now} onEnterRoom={handleEnterRoom} />
      )}

      {view === 'room' && activePatient && (
        <Room
          patient={activePatient}
          now={now}
          onOrder={handleOrder}
          onLeave={handleLeaveRoom}
        />
      )}

      {view === 'end' && (
        <EndScreen
          summary={summary}
          score={totalScore}
          distractorStats={distractorStats}
          distractorEvents={distractorEvents}
        />
      )}

      {activeDistractor && (
        <DistractorModal
          data={activeDistractor}
          onAnswer={handleDistractorAnswer}
          onClose={handleCloseDistractor}
        />
      )}
      {activeAdminMessage && !activeDistractor && view !== 'end' && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3>Message from Admin</h3>
            </div>
            <p className="modal-question">{activeAdminMessage.text}</p>
            <button className="close" onClick={() => setAdminQueue((q) => q.slice(1))}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
