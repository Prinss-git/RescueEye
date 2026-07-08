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
  { id: 'T001', name: 'Alpha Team',   status: 'STANDBY',    members: ['Reyes', 'Santos'],       assignedTo: null, agencyId: null, memberUserIds: [] },
  { id: 'T002', name: 'Bravo Team',   status: 'STANDBY',    members: ['Cruz', 'Dela Rosa'],     assignedTo: null, agencyId: null, memberUserIds: [] },
  { id: 'T003', name: 'Charlie Team', status: 'DISPATCHED', members: ['Lim', 'Garcia', 'Tan'],  assignedTo: null, agencyId: null, memberUserIds: [] },
  { id: 'T004', name: 'Delta Team',   status: 'ON_SITE',    members: ['Ramos', 'Torres'],       assignedTo: null, agencyId: null, memberUserIds: [] },
  { id: 'T005', name: 'Echo Team',    status: 'STANDBY',    members: ['Bautista', 'Flores'],    assignedTo: null, agencyId: null, memberUserIds: [] },
];

const incidents = [];

const messages = [];

const agencies = [];

const users = [];

const missions = [];

// Active drill session (null if no drill running)
let activeDrill = null;
let drillInterval = null;

// ── Teams ─────────────────────────────────────────────────────────────────────

// Computes a display-friendly `members` array (names) from memberUserIds,
// falling back to the legacy hardcoded `members` strings for the 5 seed
// teams that predate real account linkage.
function _withDisplayMembers(team) {
  if (team.memberUserIds && team.memberUserIds.length > 0) {
    const names = team.memberUserIds
      .map((uid) => users.find((u) => u.uid === uid)?.displayName)
      .filter(Boolean);
    return { ...team, members: names };
  }
  return team;
}

function getTeams(filter = {}) {
  let list = [...teams];
  if (filter.agencyId) list = list.filter(t => t.agencyId === filter.agencyId);
  return list.map(_withDisplayMembers);
}

function getTeamById(id) {
  const team = teams.find(t => t.id === id);
  return team ? _withDisplayMembers(team) : null;
}

function createTeam(data) {
  const team = {
    id:            `T-${Date.now()}`,
    name:          data.name,
    status:        'STANDBY',
    members:       [],
    memberUserIds: [],
    assignedTo:    null,
    agencyId:      data.agencyId || null,
    createdAt:     new Date().toISOString(),
  };
  teams.push(team);
  _syncTeam(team);
  return team;
}

function addTeamMember(teamId, userId) {
  const team = teams.find(t => t.id === teamId);
  if (!team) return null;
  if (!team.memberUserIds) team.memberUserIds = [];
  if (!team.memberUserIds.includes(userId)) team.memberUserIds.push(userId);
  team.updatedAt = new Date().toISOString();
  _syncTeam(team);
  return _withDisplayMembers(team);
}

function removeTeamMember(teamId, userId) {
  const team = teams.find(t => t.id === teamId);
  if (!team) return null;
  team.memberUserIds = (team.memberUserIds || []).filter(id => id !== userId);
  team.updatedAt = new Date().toISOString();
  _syncTeam(team);
  return _withDisplayMembers(team);
}

function updateTeamStatus(teamId, status) {
  const team = teams.find(t => t.id === teamId);
  if (!team) return null;
  team.status = status;
  team.updatedAt = new Date().toISOString();
  _syncTeam(team);
  return team;
}

function assignTeam(teamId, incidentId, assignedBy) {
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

  let mission = null;
  if (incidentId) {
    const existing = missions.find(m =>
      m.teamId === teamId && m.incidentId === incidentId &&
      !['COMPLETED', 'DECLINED'].includes(m.status)
    );
    mission = existing || createMission({
      incidentId,
      teamId,
      assignedBy: assignedBy || null,
      responderUserIds: team.memberUserIds || [],
    });
  }

  return { team: _withDisplayMembers(team), incident, mission };
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

// ── Agencies ──────────────────────────────────────────────────────────────────

function getAgencies() {
  return agencies;
}

function getAgencyById(id) {
  return agencies.find(a => a.id === id) || null;
}

function createAgency(data) {
  const agency = {
    id:                 `AGCY-${Date.now()}`,
    name:                data.name,
    subscriptionStatus:  data.subscriptionStatus || 'ACTIVE',
    createdBy:           data.createdBy,
    createdAt:           new Date().toISOString(),
  };
  agencies.push(agency);
  _syncAgency(agency);
  return agency;
}

function setAgencySubscriptionStatus(id, status) {
  const agency = agencies.find(a => a.id === id);
  if (!agency) return null;
  agency.subscriptionStatus = status;
  agency.updatedAt = new Date().toISOString();
  _syncAgency(agency);
  return agency;
}

// ── Users ─────────────────────────────────────────────────────────────────────

function getUsers(filter = {}) {
  let list = [...users];
  if (filter.agencyId) list = list.filter(u => u.agencyId === filter.agencyId);
  if (filter.role)     list = list.filter(u => u.role === filter.role);
  return list;
}

function getUserByEmail(email) {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function getUserById(uid) {
  return users.find(u => u.uid === uid) || null;
}

function createUser(data) {
  const user = {
    uid:          `U-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    email:        data.email,
    displayName:  data.displayName,
    role:         data.role,
    organization: data.organization || null,
    agencyId:     data.agencyId || null,
    passwordHash: data.passwordHash,
    active:       true,
    createdAt:    new Date().toISOString(),
    lastLogin:    null,
  };
  users.push(user);
  _syncUser(user);
  return user;
}

function touchUserLogin(uid) {
  const user = users.find(u => u.uid === uid);
  if (!user) return null;
  user.lastLogin = new Date().toISOString();
  _syncUser(user);
  return user;
}

function setUserActive(uid, active) {
  const user = users.find(u => u.uid === uid);
  if (!user) return null;
  user.active = active;
  _syncUser(user);
  return user;
}

// ── Missions ──────────────────────────────────────────────────────────────────

const MISSION_TERMINAL_STATUSES = ['COMPLETED', 'DECLINED'];

function getMissions(filter = {}) {
  let list = [...missions];
  if (filter.userId)     list = list.filter(m => (m.responderUserIds || []).includes(filter.userId));
  if (filter.incidentId) list = list.filter(m => m.incidentId === filter.incidentId);
  if (filter.teamId)     list = list.filter(m => m.teamId === filter.teamId);
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getMissionById(id) {
  return missions.find(m => m.id === id) || null;
}

function createMission(data) {
  const mission = {
    id:               `MISS-${Date.now()}`,
    incidentId:       data.incidentId,
    teamId:           data.teamId,
    assignedBy:       data.assignedBy || null,
    responderUserIds: data.responderUserIds || [],
    status:           'ASSIGNED',
    medicalRequired:  null,
    notes:            '',
    createdAt:        new Date().toISOString(),
    acceptedAt:       null,
    completedAt:      null,
  };
  missions.push(mission);
  _syncMission(mission);
  return mission;
}

function updateMissionStatus(id, updates) {
  const mission = missions.find(m => m.id === id);
  if (!mission) return null;
  if (updates.status !== undefined)          mission.status = updates.status;
  if (updates.notes !== undefined)           mission.notes = updates.notes;
  if (updates.medicalRequired !== undefined) mission.medicalRequired = updates.medicalRequired;
  if (updates.status === 'ACCEPTED') mission.acceptedAt = new Date().toISOString();
  if (updates.status === 'COMPLETED') mission.completedAt = new Date().toISOString();
  mission.updatedAt = new Date().toISOString();
  _syncMission(mission);
  return mission;
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

async function _syncAgency(agency) {
  if (!_db) return;
  try {
    await _db.collection('agencies').doc(agency.id).set(agency, { merge: true });
  } catch (e) {
    console.warn('[store] Firestore agency sync failed:', e.message);
  }
}

async function _syncUser(user) {
  if (!_db) return;
  try {
    await _db.collection('users').doc(user.uid).set(user, { merge: true });
  } catch (e) {
    console.warn('[store] Firestore user sync failed:', e.message);
  }
}

async function _syncMission(mission) {
  if (!_db) return;
  try {
    await _db.collection('missions').doc(mission.id).set(mission, { merge: true });
  } catch (e) {
    console.warn('[store] Firestore mission sync failed:', e.message);
  }
}

// ── Hydration ─────────────────────────────────────────────────────────────────
// Reads existing Firestore data into the in-memory arrays at startup, so the
// in-memory store becomes a warm cache of Firestore rather than the source of
// truth. Must run (and be awaited) before the server starts accepting requests.

async function hydrate() {
  if (!_db) return { skipped: true };

  try {
    const [teamsSnap, incidentsSnap, messagesSnap, agenciesSnap, usersSnap, missionsSnap] = await Promise.all([
      _db.collection('teams').get(),
      _db.collection('incidents').get(),
      _db.collection('messages').get(),
      _db.collection('agencies').get(),
      _db.collection('users').get(),
      _db.collection('missions').get(),
    ]);

    if (!teamsSnap.empty) {
      teams.length = 0;
      teamsSnap.forEach((doc) => teams.push(doc.data()));
    } else {
      // Fresh Firestore project — keep the hardcoded seed teams and write
      // them through so future restarts read them back from here on.
      await Promise.all(teams.map((t) => _syncTeam(t)));
    }

    incidents.length = 0;
    incidentsSnap.forEach((doc) => incidents.push(doc.data()));

    messages.length = 0;
    messagesSnap.forEach((doc) => messages.push(doc.data()));

    agencies.length = 0;
    agenciesSnap.forEach((doc) => agencies.push(doc.data()));

    users.length = 0;
    usersSnap.forEach((doc) => users.push(doc.data()));

    missions.length = 0;
    missionsSnap.forEach((doc) => missions.push(doc.data()));

    return {
      skipped: false,
      teams: teams.length,
      incidents: incidents.length,
      messages: messages.length,
      agencies: agencies.length,
      users: users.length,
      missions: missions.length,
    };
  } catch (e) {
    console.warn('[store] Firestore hydration failed, falling back to in-memory defaults:', e.message);
    return { skipped: true, error: e.message };
  }
}

module.exports = {
  hydrate,
  setDb,
  getDb,
  getTeams,
  getTeamById,
  createTeam,
  addTeamMember,
  removeTeamMember,
  updateTeamStatus,
  assignTeam,
  getIncidents,
  getIncidentById,
  createIncident,
  resolveIncident,
  getMessages,
  addMessage,
  getAgencies,
  getAgencyById,
  createAgency,
  setAgencySubscriptionStatus,
  getUsers,
  getUserByEmail,
  getUserById,
  createUser,
  touchUserLogin,
  setUserActive,
  getMissions,
  getMissionById,
  createMission,
  updateMissionStatus,
  startDrill,
  stopDrill,
  getDrillStatus,
  getActiveDrill,
  recordDrillResponseTime,
  incrementDrillCounter,
};
