import {
  formatDuration,
  getChiefComplaint,
  getPatientAgeSex,
  getPatientTitle,
  getRoomLabel,
  getRoomSort,
  getState,
  getVitalsDisplay,
} from '../engine/patientEngine.js';

export default function Overview({ patients, now, onEnterRoom }) {
  return (
    <main className="overview">
      <h2>ED Overview</h2>
      <div className="grid">
        {patients
          .slice()
          .sort((a, b) => getRoomSort(a.data) - getRoomSort(b.data))
          .map((patient) => {
            const state = getState(patient.data, patient.stateId);
            const vitals = getVitalsDisplay(patient, now);
            const lastSeen = now - patient.lastSeenAt;
            return (
              <button
                key={patient.data.id}
                className="patient-tile"
                onClick={() => onEnterRoom(patient.data.id)}
              >
                <div className="tile-header">
                  <div>
                    <div className="tile-room">{getRoomLabel(patient.data)}</div>
                    <div className="tile-name">
                      {getPatientTitle(patient.data)}
                      {getPatientAgeSex(patient.data) ? `, ${getPatientAgeSex(patient.data)}` : ''}
                    </div>
                    <div className="tile-complaint">{getChiefComplaint(patient.data)}</div>
                  </div>
                  <div
                    className="acuity"
                    style={{ background: state.acuityColor }}
                    title={state.acuity}
                  >
                    {state.acuity}
                  </div>
                </div>
                <div className="tile-meta">
                  <span>Last seen: {formatDuration(lastSeen)}</span>
                  <span>State: {state.label}</span>
                </div>
                <div className="vitals-mini">
                  <div>HR {vitals.hr}</div>
                  <div>BP {vitals.bp}</div>
                  <div>RR {vitals.rr}</div>
                  <div>SpO₂ {vitals.spo2}%</div>
                  <div>T {vitals.temp}°C</div>
                </div>
              </button>
            );
          })}
      </div>
    </main>
  );
}
