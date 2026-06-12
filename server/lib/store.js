/**
 * Centralized in-memory store with optional Firestore sync.
 * When Firebase is not configured, everything stays in memory — the app
 * degrades gracefully without throwing.
 */
'use strict';

let _db = null;

function setDb(db) {
  _db = db;
}

function getDb() {
  return _db;
}

// ── In-memory collections ─────────────────────────────────────────────────────

const teams = [
  { id: 'T001', name: 'Alpha Team',   status: 'STANDBY',    members: ['Reyes', 'Santos'],       assignedTo: null },
  { id: 'T002', name: 'Bravo Team',   status: 'STANDBY',    members: ['Cruz', 'Dela Rosa'],     assignedTo: null },
  { id: 'T003', name: 'Charlie Team', status: 'DISPATCHED', members: ['Lim', 'Garcia', 'Tan'],  assignedTo: null },
  { id: 'T004', name: 'Delta Team',   status: 'ON_SITE',    members: ['Ramos', 'Torres'],       assignedTo: null },
  { id: 'T005', name: 'Echo Team',    status: 'STANDBY',    members: ['Bautista', 'Flores'],    assignedTo: null },
];

const incidents = [];

const messages = [];

// Active drill session (null if no drill running)
let activeDrill = null;
let drillInterval = null;

// ── Teams ─────────────────────────────────────────────────────────────────────

function getTeams() {
  return teams;
}

function getTeamById(id) {
  return teams.find(t => t.id === id) || null;
}

function updateTeamStatus(teamId, status) {
  const team = teams.find(t => t.id === teamId);
  if (!team) return null;
  team.status = status;
  team.updatedAt = new Date().toISOString();
  _syncTeam(team);
  return team;
}

function assignTeam(teamId, incidentId) {
  const team = teams.find(t => t.id === teamId);
  if (!team) return null;
  // Un-assign previous incident
  if (team.assignedTo && team.assignedTo !== incidentId) {
    const prev = incidents.find(i => i.id === team.assignedTo);
    if (prev && prev.status === 'ASSIGNED') prev.status = 'OPEN';
  }
  team.assignedTo = incidentId;
  team.status = incidentId ? 'DISPATCHED' : 'STANDBY';
  team.updatedAt = new Date().toISOString();
  // Update incident
  const incident = incidents.find(i => i.id === incidentId);
  if (incident) {
    incident.assignedTeam = teamId;
    incident.status = 'ASSIGNED';
    incident.updatedAt = new Date().toISOString();
    _syncIncident(incident);
  }
  _syncTeam(team);
  return { team, incident };
}

// ── Incidents ─────────────────────────────────────────────────────────────────

function getIncidents(filter = {}) {
  let list = [...incidents];
  if (filter.status) list = list.filter(i => i.status === filter.status);
  if (filter.type)   list = list.filter(i => i.type === filter.type);
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getIncidentById(id) {
  return incidents.find(i => i.id === id) || null;
}

function createIncident(data) {
  const incident = {
    id:            `INC-${Date.now()}`,
    type:          data.type          || 'UNKNOWN',
    severity:      data.severity      || 'MEDIUM',
    status:        'OPEN',
    lat:           data.lat           || 0,
    lng:           data.lng           || 0,
    description:   data.description   || '',
    reportedBy:    data.reportedBy    || 'AI_SYSTEM',
    assignedTeam:  null,
    isDrill:       data.isDrill       || false,
    drillSessionId: data.drillSessionId || null,
    createdAt:     new Date().toISOString(),
    resolvedAt:    null,
  };
  incidents.push(incident);
  _syncIncident(incident);
  return incident;
}

function resolveIncident(incidentId) {
  const incident = incidents.find(i => i.id === incidentId);
  if (!incident) return null;
  incident.status = 'RESOLVED';
  incident.resolvedAt = new Date().toISOString();
  // Free up assigned team
  if (incident.assignedTeam) {
    const team = teams.find(t => t.id === incident.assignedTeam);
    if (team) {
      team.assignedTo = null;
      team.status = 'STANDBY';
      team.updatedAt = new Date().toISOString();
      _syncTeam(team);
    }
  }
  _syncIncident(incident);
  return incident;
}

// ── Messages ──────────────────────────────────────────────────────────────────

function getMessages(incidentId) {
  const list = incidentId
    ? messages.filter(m => m.incidentId === incidentId)
    : messages;
  return list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function addMessage(data) {
  const msg = {
    id:         `MSG-${Date.now()}`,
    incidentId: data.incidentId  || null,
    senderId:   data.senderId    || 'unknown',
    senderName: data.senderName  || 'Unknown',
    senderOrg:  data.senderOrg   || '',
    content:    data.content     || '',
    type:       data.type        || 'UPDATE',
    timestamp:  new Date().toISOString(),
    isDrill:    data.isDrill     || false,
  };
  messages.push(msg);
  _syncMessage(msg);
  return msg;
}

// ── Drill ─────────────────────────────────────────────────────────────────────

const DRILL_INCIDENT_TYPES = ['VICTIM_DETECTED', 'FLOOD', 'FIRE', 'STRUCTURAL'];
const DRILL_COORDS = [
  { lat: 10.3157, lng: 123.8854 },
  { lat: 10.3220, lng: 123.8972 },
  { lat: 10.3089, lng: 123.9012 },
  { lat: 10.3301, lng: 123.8801 },
  { lat: 10.2998, lng: 123.8930 },
];

function startDrill(userId) {
  if (activeDrill) return activeDrill;
  activeDrill = {
    id:             `DRILL-${Date.now()}`,
    startedBy:      userId,
    startedAt:      new Date().toISOString(),
    stoppedAt:      null,
    active:         true,
    incidentCount:  0,
    messageCount:   0,
    teamActions:    0,
    detectionCount: 0,
    avgResponseMs:  0,
    _responseTimes: [],
  };
  // Auto-generate drill incidents every 30 seconds
  drillInterval = setInterval(() => {
    if (!activeDrill) return;
    const type = DRILL_INCIDENT_TYPES[Math.floor(Math.random() * DRILL_INCIDENT_TYPES.length)];
    const coord = DRILL_COORDS[Math.floor(Math.random() * DRILL_COORDS.length)];
    createIncident({
      type,
      severity:      Math.random() > 0.5 ? 'HIGH' : 'MEDIUM',
      lat:           coord.lat + (Math.random() - 0.5) * 0.01,
      lng:           coord.lng + (Math.random() - 0.5) * 0.01,
      description:   `[SIMULATED] ${type.replace('_', ' ')} — drill exercise`,
      reportedBy:    'DRILL_SYSTEM',
      isDrill:       true,
      drillSessionId: activeDrill.id,
    });
    activeDrill.incidentCount += 1;
  }, 30000);
  return activeDrill;
}

function stopDrill() {
  if (!activeDrill) return null;
  clearInterval(drillInterval);
  drillInterval = null;
  activeDrill.active = false;
  activeDrill.stoppedAt = new Date().toISOString();
  if (activeDrill._responseTimes.length > 0) {
    activeDrill.avgResponseMs = Math.round(
      activeDrill._responseTimes.reduce((a, b) => a + b, 0) / activeDrill._responseTimes.length
    );
  }
  const result = { ...activeDrill };
  delete result._responseTimes;
  activeDrill = null;
  return result;
}

function getDrillStatus(sessionId) {
  if (activeDrill && activeDrill.id === sessionId) {
    const result = { ...activeDrill };
    delete result._responseTimes;
    return result;
  }
  return null;
}

function getActiveDrill() {
  if (!activeDrill) return null;
  const result = { ...activeDrill };
  delete result._responseTimes;
  return result;
}

function recordDrillResponseTime(ms) {
  if (activeDrill) activeDrill._responseTimes.push(ms);
}

function incrementDrillCounter(field) {
  if (activeDrill && field in activeDrill) activeDrill[field] += 1;
}

// ── Firestore sync helpers (fire-and-forget) ──────────────────────────────────

async function _syncTeam(team) {
  if (!_db) return;
  try {
    await _db.collection('teams').doc(team.id).set(team, { merge: true });
  } catch (e) {
    console.warn('[store] Firestore team sync failed:', e.message);
  }
}

async function _syncIncident(incident) {
  if (!_db) return;
  try {
    await _db.collection('incidents').doc(incident.id).set(incident, { merge: true });
  } catch (e) {
    console.warn('[store] Firestore incident sync failed:', e.message);
  }
}

async function _syncMessage(msg) {
  if (!_db) return;
  try {
    await _db.collection('messages').doc(msg.id).set(msg);
  } catch (e) {
    console.warn('[store] Firestore message sync failed:', e.message);
  }
}

module.exports = {
  setDb,
  getDb,
  getTeams,
  getTeamById,
  updateTeamStatus,
  assignTeam,
  getIncidents,
  getIncidentById,
  createIncident,
  resolveIncident,
  getMessages,
  addMessage,
  startDrill,
  stopDrill,
  getDrillStatus,
  getActiveDrill,
  recordDrillResponseTime,
  incrementDrillCounter,
};
