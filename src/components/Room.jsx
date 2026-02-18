import { useMemo, useState } from 'react';
import {
  canOrder,
  formatClock,
  getOrderStatus,
  getOrderLabel,
  getPatientAgeSex,
  getPatientImage,
  getPatientTitle,
  getChiefComplaint,
  getRoomLabel,
  getResultText,
  getState,
  getVitalsDisplay,
} from '../engine/patientEngine.js';

const TABS = ['HPI', 'Exam', 'Orders', 'Results', 'Log'];

const ORDER_GROUPS = [
  { id: 'labs', label: 'Labs & Diagnostics', icon: '🧪' },
  { id: 'monitoring', label: 'Monitoring & Access', icon: '📡' },
  { id: 'fluids', label: 'Fluids & Electrolytes', icon: '💧' },
  { id: 'antibiotics', label: 'Antibiotics', icon: '💊' },
  { id: 'meds', label: 'Medications', icon: '🧪' },
  { id: 'imaging', label: 'Imaging', icon: '🧠' },
  { id: 'consults', label: 'Consults', icon: '🩺' },
  { id: 'other', label: 'Other', icon: '📋' },
];

function classifyOrder(order) {
  const label = (order.label || order.name || order.id || '').toLowerCase();
  if (order.type === 'lab') return 'labs';
  if (label.includes('ecg')) return 'labs';
  if (order.type === 'monitoring' || order.type === 'nursing') return 'monitoring';
  if (order.type === 'imaging') return 'imaging';
  if (
    /\biv\b/.test(label) ||
    /\bfluids?\b/.test(label) ||
    /\bdextrose\b/.test(label) ||
    /\bpotassium\b/.test(label)
  ) {
    return 'fluids';
  }
  if (
    label.includes('vanc') ||
    label.includes('zosyn') ||
    label.includes('pip') ||
    label.includes('tazo') ||
    label.includes('clinda') ||
    label.includes('azithro') ||
    label.includes('cef') ||
    label.includes('unasyn') ||
    label.includes('mero') ||
    label.includes('doxy') ||
    label.includes('bactrim') ||
    label.includes('metronidazole') ||
    label.includes('abx') ||
    label.includes('antibiotic')
  ) {
    return 'antibiotics';
  }
  if (order.type === 'med') return 'meds';
  if (order.type === 'consult') return 'consults';
  return 'other';
}

function groupOrders(patient, orderIds) {
  const defs = orderIds
    .map((id) => patient.data.orders.find((order) => order.id === id))
    .filter(Boolean);
  const byGroup = new Map();
  defs.forEach((order) => {
    const groupId = classifyOrder(order);
    if (!byGroup.has(groupId)) byGroup.set(groupId, []);
    byGroup.get(groupId).push(order.id);
  });
  return ORDER_GROUPS
    .map((group) => ({
      ...group,
      items: byGroup.get(group.id) || [],
    }))
    .filter((group) => group.items.length > 0);
}

export default function Room({ patient, now, onOrder, onLeave }) {
  const [tab, setTab] = useState('HPI');
  const state = getState(patient.data, patient.stateId);
  const vitals = getVitalsDisplay(patient, now);

  const ordersAvailable = state.ordersAvailable || [];
  const results = useMemo(() => {
    return patient.ordersPlaced
      .map((order) => getOrderStatus(patient, order.id, now))
      .filter(Boolean)
      .sort((a, b) => b.placedAt - a.placedAt);
  }, [patient, now]);

  return (
    <main className="room">
      <div className="room-left">
        <div className="room-image">
          <img
            src={getPatientImage(patient.data, patient.stateId)}
            alt={getRoomLabel(patient.data)}
            onError={(e) => {
              e.currentTarget.src = '/assets/room-placeholder.svg';
            }}
          />
          <div className="vitals-monitor">
            <div className="monitor-title">Vitals Monitor</div>
            <div className="monitor-grid">
              <div>
                <span>HR</span>
                <strong>{vitals.hr}</strong>
              </div>
              <div>
                <span>BP</span>
                <strong>{vitals.bp}</strong>
              </div>
              <div>
                <span>RR</span>
                <strong>{vitals.rr}</strong>
              </div>
              <div>
                <span>SpO₂</span>
                <strong>{vitals.spo2}%</strong>
              </div>
              <div>
                <span>Temp</span>
                <strong>{vitals.temp}°C</strong>
              </div>
            </div>
          </div>
        </div>
        <button className="leave" onClick={onLeave}>Leave room</button>
      </div>

      <aside className="room-right">
        <div className="room-header">
          <div>
            <h2>
              {getRoomLabel(patient.data)} - {getPatientTitle(patient.data)}
              {getPatientAgeSex(patient.data) ? `, ${getPatientAgeSex(patient.data)}` : ''}
            </h2>
            <p>{getChiefComplaint(patient.data)}</p>
            <p className="room-state">{state.label}</p>
          </div>
          <div className="room-timestamp">{formatClock(now)}</div>
        </div>

        <div className="tabs">
          {TABS.map((name) => (
            <button
              key={name}
              className={tab === name ? 'tab active' : 'tab'}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="tab-body">
          {tab === 'HPI' && (
            <>
              {Array.isArray(state.hpi) && state.hpi.length > 1 && (
                <ul>
                  {state.hpi.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              {Array.isArray(state.hpi) && state.hpi.length === 1 && (
                <p>{state.hpi[0]}</p>
              )}
              {!Array.isArray(state.hpi) && state.hpi && <p>{state.hpi}</p>}
            </>
          )}
          {tab === 'Exam' && (
            <>
              {Array.isArray(state.exam) && (
                <ul>
                  {state.exam.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              {!Array.isArray(state.exam) && state.exam && (
                <div className="exam-groups">
                  {Object.entries(state.exam).map(([system, findings]) => (
                    <details key={system} className="exam-group">
                      <summary>{system}</summary>
                      <ul>
                        {findings.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              )}
            </>
          )}
          {tab === 'Orders' && (
            <div className="orders">
              {patient.flags?.admitted && (
                <p className="case-closed">Case closed: admitted to medicine.</p>
              )}
              {ordersAvailable.length === 0 && <p>No orders available in this state.</p>}
              {ordersAvailable.length > 0 && (
                <div className="order-groups">
                  {groupOrders(patient, ordersAvailable).map((group) => (
                    <details key={group.label} className="order-group" open>
                      <summary>
                        <span className="order-group-icon">{group.icon}</span>
                        <span>{group.label}</span>
                        <span className="order-group-count">{group.items.length}</span>
                      </summary>
                      <div className="orders">
                        {group.items.map((orderId) => (
                          <button
                            key={orderId}
                            onClick={() => onOrder(patient.data.id, orderId)}
                            disabled={
                              patient.ordersPlaced.some((o) => o.id === orderId) ||
                              !canOrder(patient, orderId, now)
                            }
                          >
                            {getOrderLabel(patient.data, orderId)}
                          </button>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'Results' && (
            <div className="results">
              {results.length === 0 && <p>No results yet.</p>}
              {results.map((result) => (
                <div key={result.order.id} className="result-card">
                  <div className="result-header">
                    <strong>{getOrderLabel(patient.data, result.order.id)}</strong>
                    <span>
                      Ordered {formatClock(result.placedAt)}
                    </span>
                  </div>
                  <div className="result-body">
                    {result.ready ? getResultText(patient.data, result.order.id) : 'Pending...'}
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === 'Log' && (
            <div className="log">
              {patient.log.map((entry, idx) => (
                <div key={`${entry.time}-${idx}`} className={`log-entry ${entry.type}`}>
                  <span>{formatClock(entry.time)}</span>
                  <span>{entry.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}
