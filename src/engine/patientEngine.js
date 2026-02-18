export const SHIFT_SECONDS = 20 * 60;
export const TIME_SCALE = 2.4; // 1 real second = 2.4 in-game seconds

export function isNewSchema(data) {
  return Boolean(data && data.initial && data.room && typeof data.room === 'object');
}

export function getRoomLabel(data) {
  if (!data) return 'Room';
  if (typeof data.room === 'object' && data.room.label) return data.room.label;
  if (data.room != null) return `Room ${data.room}`;
  return 'Room';
}

export function getRoomSort(data) {
  if (!data) return 0;
  if (typeof data.room === 'number') return data.room;
  if (typeof data.room === 'object' && data.room.label) {
    const match = data.room.label.match(/(\\d+)/);
    return match ? Number(match[1]) : 0;
  }
  return 0;
}

export function getPatientTitle(data) {
  if (isNewSchema(data)) return 'Patient';
  return data?.name || data?.title || 'Unknown';
}

export function getPatientAgeSex(data) {
  if (data?.age != null) return String(data.age);
  return data?.initial?.ageSex || '';
}

export function getChiefComplaint(data) {
  return data?.chiefComplaint || data?.initial?.chiefComplaint || '';
}

export function getPatientImage(data, stateId) {
  if (!data) return '/assets/room-placeholder.svg';
  if (typeof data.room === 'object') {
    const alt = data.room.altImages || {};
    if (stateId && alt[stateId]) return alt[stateId];
    return data.room.image || '/assets/room-placeholder.svg';
  }
  return data.image || '/assets/room-placeholder.svg';
}

export function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function getState(data, stateId) {
  if (data.states) {
    return data.states.find((state) => state.id === stateId) || data.states[0];
  }
  if (!data.initial) {
    return null;
  }
  const labelMap = {
    initial: 'Stable',
    worsening: 'Worsening',
    crashing: 'Critically ill',
    stabilizing: 'Improving',
    resolved: 'Stable',
  };
  const acuityMap = {
    initial: { acuity: 'High', acuityColor: '#f59e0b' },
    worsening: { acuity: 'Critical', acuityColor: '#ef4444' },
    crashing: { acuity: 'Critical', acuityColor: '#dc2626' },
    stabilizing: { acuity: 'Moderate', acuityColor: '#22c55e' },
    resolved: { acuity: 'Low', acuityColor: '#38bdf8' },
  };
  const defaults = acuityMap[stateId] || acuityMap.initial;
  return {
    id: stateId,
    label: labelMap[stateId] || stateId,
    acuity: defaults.acuity,
    acuityColor: defaults.acuityColor,
    vitals: data.initial.vitals,
    hpi: data.initial.hpi || [],
    exam: data.initial.exam || [],
    ordersAvailable: data.orders ? data.orders.map((order) => order.id) : [],
  };
}

export function initPatientRuntime(data, nowSeconds) {
  const newSchema = isNewSchema(data);
  const initialStateId = newSchema ? data.state?.current || 'initial' : data.initialState;
  const initialVitals = newSchema ? data.initial?.vitals || {} : null;
  return {
    data,
    stateId: initialStateId,
    lastSeenAt: nowSeconds,
    ordersPlaced: [],
    eventsFired: [],
    triggersFired: [],
    flags: newSchema ? { ...(data.state?.flags || {}) } : null,
    vitalsDelta: newSchema
      ? { hr: 0, bpSys: 0, bpDia: 0, rr: 0, spo2: 0, tempC: 0, ...initialVitals.delta }
      : null,
    orderEffectsApplied: [],
    timers: [],
    endScored: false,
    scoreEvents: [],
    log: [
      {
        time: nowSeconds,
        text: `Arrived in ${getRoomLabel(data)}: ${getChiefComplaint(data)}.`,
        type: 'info',
      },
    ],
    score: 0,
    outcome: null,
  };
}

function addScoreEvent(p, nowSeconds, label, delta, category = 'order') {
  if (!delta) return p;
  return {
    ...p,
    score: p.score + delta,
    scoreEvents: [
      { time: nowSeconds, label, delta, category },
      ...(p.scoreEvents || []),
    ],
  };
}

export function getOrder(data, orderId) {
  return data.orders.find((order) => order.id === orderId);
}

export function hasOrder(p, orderId) {
  return p.ordersPlaced.some((order) => order.id === orderId);
}

export function getOrderLabel(data, orderId) {
  const order = getOrder(data, orderId);
  return order?.label || order?.name || orderId;
}

function getOrderTatSeconds(order) {
  if (order.tatSec != null) return order.tatSec;
  if (order.timeToResultMin != null) return order.timeToResultMin * 60;
  return 0;
}

function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function evaluateRule(rule, value, target) {
  if (rule === 'LT') return value < target;
  if (rule === 'GT') return value > target;
  if (rule === 'EQ') return value === target;
  return false;
}

function applyVitalsDelta(p, delta) {
  if (!p.vitalsDelta) return p;
  const updated = { ...p };
  updated.vitalsDelta = {
    ...p.vitalsDelta,
    hr: (p.vitalsDelta.hr || 0) + (delta.hr || 0),
    bpSys: (p.vitalsDelta.bpSys || 0) + (delta.bpSys || 0),
    bpDia: (p.vitalsDelta.bpDia || 0) + (delta.bpDia || 0),
    rr: (p.vitalsDelta.rr || 0) + (delta.rr || 0),
    spo2: (p.vitalsDelta.spo2 || 0) + (delta.spo2 || 0),
    tempC: (p.vitalsDelta.tempC || 0) + (delta.tempC || 0),
  };
  return updated;
}

function applyRuleActions(p, actions, nowSeconds) {
  let updated = p;
  actions.forEach((action) => {
    const actionType = action.effectType || action.type;
    if (actionType === 'setFlag') {
      updated = {
        ...updated,
        flags: { ...updated.flags, [action.flag]: action.value },
      };
    }
    if (actionType === 'setState') {
      updated = {
        ...updated,
        stateId: action.value,
        log: [
          {
            time: nowSeconds,
            text: `State changed to ${action.value}.`,
            type: 'info',
          },
          ...updated.log,
        ],
      };
    }
    if (actionType === 'modifyVitals') {
      updated = applyVitalsDelta(updated, action.delta || {});
    }
    if (actionType === 'score') {
      updated = addScoreEvent(
        updated,
        nowSeconds,
        action.label || 'Score adjustment',
        action.delta || 0,
        action.category || 'adjustment'
      );
    }
    if (actionType === 'startTimer') {
      const timerId = action.timerId || `${nowSeconds}-${Math.random().toString(36).slice(2)}`;
      if (updated.timers?.some((timer) => timer.id === timerId)) return;
      const dueAt = nowSeconds + (action.delaySec || 0);
      updated = {
        ...updated,
        timers: [
          ...(updated.timers || []),
          {
            id: timerId,
            dueAt,
            actions: action.do || [],
            message: action.message || null,
          },
        ],
      };
    }
  });
  return updated;
}

function guardAllows(p, guard) {
  if (!guard) return true;
  if (guard.requiresFlags) {
    const ok = guard.requiresFlags.every((flag) => p.flags?.[flag]);
    if (!ok) return false;
  }
  if (guard.disallowIf) {
    const blocked = guard.disallowIf.some(
      (cond) => (p.flags?.[cond.flag] ?? false) === cond.value
    );
    if (blocked) return false;
  }
  return true;
}

function applyOrderEffectsForNewSchema(p, orderId, nowSeconds) {
  const effects = p.data.rules?.onOrderEffects || [];
  let updated = p;
  effects
    .filter((effect) => effect.when === orderId)
    .forEach((effect) => {
      if (!guardAllows(updated, effect.guard)) return;
      updated = applyRuleActions(updated, effect.do || [], nowSeconds);
    });
  return updated;
}

function applyReadyOrderEffects(p, nowSeconds) {
  if (!isNewSchema(p.data)) return p;
  let updated = p;
  const applied = new Set(updated.orderEffectsApplied || []);
  let ordersUpdated = false;
  const nextOrders = updated.ordersPlaced.map((order) => {
    if (order.effectsApplied) return order;
    if (applied.has(order.id)) return;
    const def = getOrder(updated.data, order.id);
    if (!def) return order;
    const tatSec = getOrderTatSeconds(def);
    if (tatSec === 0 || nowSeconds - order.placedAt >= tatSec) {
      updated = applyOrderEffectsForNewSchema(updated, order.id, nowSeconds);
      applied.add(order.id);
      ordersUpdated = true;
      return { ...order, effectsApplied: true };
    }
    return order;
  });
  return {
    ...updated,
    ordersPlaced: ordersUpdated ? nextOrders : updated.ordersPlaced,
    orderEffectsApplied: Array.from(applied),
  };
}

function applyDerivedFlags(p, nowSeconds) {
  if (!isNewSchema(p.data)) return p;
  const derived = p.data.rules?.derivedFlags || [];
  if (derived.length === 0) return p;
  let updated = p;
  derived.forEach((rule) => {
    if (updated.flags?.[rule.id]) return;
    const [orderId] = rule.fromResult.split('.');
    const status = getOrderStatus(updated, orderId, nowSeconds);
    if (!status || !status.ready) return;
    const value = getNestedValue(updated.data.results, rule.fromResult);
    if (value == null) return;
    if (evaluateRule(rule.rule, value, rule.value)) {
      updated = {
        ...updated,
        flags: { ...updated.flags, [rule.id]: true },
      };
    }
  });
  return updated;
}

function applyTimeEvents(p, nowSeconds) {
  if (!isNewSchema(p.data)) return p;
  const events = p.data.rules?.timeEvents || [];
  if (events.length === 0) return p;
  let updated = p;
  events.forEach((event) => {
    if (updated.eventsFired.includes(event.atSec)) return;
    if (nowSeconds < event.atSec) return;
    if (event.ifNotFlags) {
      const blocked = event.ifNotFlags.some((flag) => updated.flags?.[flag]);
      if (blocked) return;
    }
    updated = applyRuleActions(updated, event.do || [], nowSeconds);
    if (event.message) {
      updated = {
        ...updated,
        log: [
          { time: nowSeconds, text: event.message, type: 'warn' },
          ...updated.log,
        ],
      };
    }
    updated.eventsFired = [...updated.eventsFired, event.atSec];
  });
  return updated;
}

function applyTimers(p, nowSeconds) {
  if (!isNewSchema(p.data)) return p;
  if (!p.timers || p.timers.length === 0) return p;
  let updated = p;
  const remaining = [];
  p.timers.forEach((timer) => {
    if (nowSeconds < timer.dueAt) {
      remaining.push(timer);
      return;
    }
    updated = applyRuleActions(updated, timer.actions || [], nowSeconds);
    if (timer.message) {
      updated = {
        ...updated,
        log: [{ time: nowSeconds, text: timer.message, type: 'info' }, ...updated.log],
      };
    }
  });
  return { ...updated, timers: remaining };
}

function applyEndScoring(p, nowSeconds) {
  if (!isNewSchema(p.data)) return p;
  if (p.endScored || nowSeconds < SHIFT_SECONDS) return p;
  const mustDo = p.data.scoring?.mustDo || [];
  let updated = p;
  mustDo.forEach((item) => {
    const didOrder = p.ordersPlaced.some((order) => order.id === item.id);
    if (!didOrder && item.missPenalty) {
      const label = getOrderLabel(p.data, item.id);
      updated = addScoreEvent(
        updated,
        nowSeconds,
        `Missed: ${label}`,
        item.missPenalty,
        'miss'
      );
    }
  });
  return { ...updated, endScored: true };
}

export function placeOrder(p, orderId, nowSeconds) {
  if (hasOrder(p, orderId)) return p;
  const order = getOrder(p.data, orderId);
  if (!order) return p;
  const tatSec = getOrderTatSeconds(order);
  const baseDelta = order.scoreDelta || 0;
  let bonusDelta = 0;
  let penaltyDelta = 0;
  if (isNewSchema(p.data) && p.flags?.admitted) return p;
  if (isNewSchema(p.data)) {
    const mustDo = p.data.scoring?.mustDo || [];
    const match = mustDo.find((item) => item.id === orderId);
    if (match && nowSeconds <= match.bySec) {
      bonusDelta += match.points || 0;
    }
    const applyPenaltyList = (list) => {
      list.forEach((penalty) => {
        if (penalty.ifOrdered === orderId) {
          const blocked = penalty.andNotFlags?.some((flag) => p.flags?.[flag]);
          if (!blocked) {
            penaltyDelta += penalty.penalty || 0;
          }
        }
      });
    };
    applyPenaltyList(p.data.scoring?.softPenalties || []);
    applyPenaltyList(p.data.scoring?.hardPenalties || []);
  }
  const updated = {
    ...p,
    ordersPlaced: [
      ...p.ordersPlaced,
      { id: orderId, placedAt: nowSeconds, effectsApplied: tatSec === 0 },
    ],
    log: [
      {
        time: nowSeconds,
        text: `Ordered: ${order.label || order.name || orderId}.`,
        type: order.harmful ? 'warn' : 'action',
      },
      ...p.log,
    ],
  };

  let scored = updated;
  if (baseDelta) {
    scored = addScoreEvent(scored, nowSeconds, `Order: ${order.label || order.name || orderId}`, baseDelta);
  }
  if (bonusDelta) {
    scored = addScoreEvent(
      scored,
      nowSeconds,
      `On-time: ${order.label || order.name || orderId}`,
      bonusDelta,
      'bonus'
    );
  }
  if (penaltyDelta) {
    scored = addScoreEvent(
      scored,
      nowSeconds,
      `Penalty: ${order.label || order.name || orderId}`,
      penaltyDelta,
      'penalty'
    );
  }

  let afterEffects = scored;
  if (isNewSchema(p.data) && orderId === 'admit_medicine') {
    const mustDo = p.data.scoring?.mustDo || [];
    const missing = mustDo.filter((item) => !hasOrder(scored, item.id));
    afterEffects = {
      ...afterEffects,
      flags: {
        ...(afterEffects.flags || {}),
        admitted: true,
        admitTooEarly: missing.length > 0,
      },
      stateId: 'resolved',
      log: [
        { time: nowSeconds, text: 'Admitted to medicine.', type: 'info' },
        ...afterEffects.log,
      ],
    };
  }
  if (isNewSchema(p.data) && tatSec === 0) {
    afterEffects = applyOrderEffectsForNewSchema(afterEffects, orderId, nowSeconds);
  }

  if (isNewSchema(p.data) && orderId === 'cath') {
    let missing = [];
    if (p.data.id === 'P003') {
      const required = ['asa', 'heparin', 'p2y12'];
      missing = required.filter((id) => !hasOrder(afterEffects, id));
    } else {
      const mustDo = p.data.scoring?.mustDo || [];
      missing = mustDo.filter((item) => !hasOrder(afterEffects, item.id));
    }
    afterEffects = {
      ...afterEffects,
      flags: {
        ...(afterEffects.flags || {}),
        admitted: true,
        admitTooEarly: missing.length > 0,
      },
      stateId: 'resolved',
      log: [
        { time: nowSeconds, text: 'Cath lab activated. Case closed.', type: 'info' },
        ...afterEffects.log,
      ],
    };
  }

  if (p.data.actionTriggers) {
    return applyActionTriggers(afterEffects, nowSeconds, orderId);
  }
  return afterEffects;
}

function triggerTransition(p, toState, nowSeconds, logText, scoreDelta) {
  const next = {
    ...p,
    stateId: toState,
    score: p.score + (scoreDelta || 0),
    log: [
      {
        time: nowSeconds,
        text: logText,
        type: scoreDelta < 0 ? 'warn' : 'info',
      },
      ...p.log,
    ],
  };
  const state = getState(next.data, toState);
  if (state.terminal) {
    next.outcome = state.label;
  }
  return next;
}

export function applyActionTriggers(p, nowSeconds) {
  if (!p.data.actionTriggers) return p;
  let updated = p;
  p.data.actionTriggers.forEach((trigger) => {
    if (updated.triggersFired.includes(trigger.id)) return;
    if (trigger.fromStates && !trigger.fromStates.includes(updated.stateId)) return;
    const hasAll = trigger.requires.every((id) => hasOrder(updated, id));
    if (!hasAll) return;

    updated = triggerTransition(
      updated,
      trigger.toState,
      nowSeconds,
      trigger.log || 'Patient responded to interventions.',
      trigger.scoreDelta || 0
    );
    updated.triggersFired = [...updated.triggersFired, trigger.id];
  });
  return updated;
}

export function evolvePatient(p, nowSeconds, activePatientId) {
  let updated = p;
  if (p.data.id === activePatientId) {
    if (p.lastSeenAt !== nowSeconds) {
      updated = { ...updated, lastSeenAt: nowSeconds };
    }
    if (!isNewSchema(p.data)) {
      return updated;
    }
  }

  if (isNewSchema(p.data)) {
    updated = applyReadyOrderEffects(updated, nowSeconds);
    updated = applyDerivedFlags(updated, nowSeconds);
    if (!updated.flags?.admitted) {
      updated = applyTimeEvents(updated, nowSeconds);
      updated = applyTimers(updated, nowSeconds);
    }
    updated = applyEndScoring(updated, nowSeconds);
    return updated;
  }
  const awayMin = (nowSeconds - p.lastSeenAt) / 60;
  if (p.data.timeline && awayMin >= 0.1) {
    p.data.timeline.forEach((event) => {
      if (updated.eventsFired.includes(event.id)) return;
      if (event.fromStates && !event.fromStates.includes(updated.stateId)) return;
      if (event.minAway != null && awayMin < event.minAway) return;
      if (event.minShift != null && nowSeconds / 60 < event.minShift) return;
      updated = triggerTransition(
        updated,
        event.toState,
        nowSeconds,
        event.log || 'Patient status changed.',
        event.scoreDelta || 0
      );
      updated.eventsFired = [...updated.eventsFired, event.id];
    });
  }

  return updated;
}

export function getVitalsDisplay(p, nowSeconds) {
  const state = getState(p.data, p.stateId);
  const base = state.vitals;
  const wobble = (seed, range = 2) => {
    const t = nowSeconds / 10 + seed * 13.1;
    return Math.round(Math.sin(t) * range);
  };
  if (isNewSchema(p.data)) {
    const delta = p.vitalsDelta || {};
    const hr = (base.hr || 0) + (delta.hr || 0) + wobble(getRoomSort(p.data), 4);
    const bpSys = (base.bpSys || 0) + (delta.bpSys || 0);
    const bpDia = (base.bpDia || 0) + (delta.bpDia || 0);
    const rr = (base.rr || 0) + (delta.rr || 0) + wobble(getRoomSort(p.data) + 1, 2);
    const spo2 = Math.max(
      70,
      (base.spo2 || 0) + (delta.spo2 || 0) + wobble(getRoomSort(p.data) + 2, 1)
    );
    const temp = ((base.tempC || 0) + (delta.tempC || 0) + wobble(getRoomSort(p.data) + 3, 0.2)).toFixed(1);
    return {
      hr,
      bp: `${bpSys}/${bpDia}`,
      rr,
      spo2,
      temp,
    };
  }
  return {
    hr: base.hr + wobble(p.data.room, 4),
    bp: base.bp,
    rr: base.rr + wobble(p.data.room + 1, 2),
    spo2: Math.max(70, base.spo2 + wobble(p.data.room + 2, 1)),
    temp: (base.temp + wobble(p.data.room + 3, 0.2)).toFixed(1),
  };
}

export function getOrderStatus(p, orderId, nowSeconds) {
  const order = getOrder(p.data, orderId);
  if (!order) return null;
  const placed = p.ordersPlaced.find((o) => o.id === orderId);
  if (!placed) return null;
  const elapsedSec = nowSeconds - placed.placedAt;
  const tatSec = getOrderTatSeconds(order);
  const ready = tatSec === 0 || elapsedSec >= tatSec;
  return {
    order,
    placedAt: placed.placedAt,
    ready,
  };
}

export function getResultText(data, orderId) {
  if (data.results && data.results[orderId]) {
    const result = data.results[orderId];
    if (typeof result === 'string') return result;
    if (result.summary) return result.summary;
    return Object.entries(result)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }
  const order = getOrder(data, orderId);
  return order?.resultText || '';
}

export function canOrder(p, orderId, nowSeconds) {
  const order = getOrder(p.data, orderId);
  if (!order) return false;
  if (p.flags?.admitted) return false;
  if (order.requires && !order.requires.every((flag) => p.flags?.[flag])) {
    return false;
  }
  if (isNewSchema(p.data)) {
    const effects = p.data.rules?.onOrderEffects || [];
    const guard = effects.find((effect) => effect.when === orderId)?.guard;
    if (guard && !guardAllows(p, guard)) return false;
  }
  return true;
}

export function summarizeOutcome(p, nowSeconds) {
  const currentState = getState(p.data, p.stateId);
  if (p.outcome) return p.outcome;
  if (currentState.terminal) return currentState.label;
  if (currentState.label.toLowerCase().includes('stabil')) return 'Stabilized';
  if (nowSeconds >= SHIFT_SECONDS) return currentState.label;
  return currentState.label;
}
