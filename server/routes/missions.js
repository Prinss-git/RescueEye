'use strict';
const { Router } = require('express');
const store = require('../lib/store');
const { requireAuth } = require('../lib/authz');

const router = Router();

const VALID_STATUSES = ['ASSIGNED', 'ACCEPTED', 'DECLINED', 'EN_ROUTE', 'ON_SITE', 'TREATING', 'COMPLETED'];

// Missions created by nearest-responder auto-dispatch carry agencyId directly;
// older team-dispatched ones only carry teamId and derive it via the team.
function missionAgencyId(mission) {
  if (mission.agencyId) return mission.agencyId;
  const team = mission.teamId ? store.getTeamById(mission.teamId) : null;
  return team ? team.agencyId : null;
}

function isAssignedResponder(mission, uid) {
  return (mission.responderUserIds || []).includes(uid);
}

// Who may see a mission: the responders it was dispatched to, and staff in the
// owning agency. System admins oversee agency registration, not operations, so
// they get no read access to mission content here.
function canView(mission, user) {
  if (isAssignedResponder(mission, user.uid)) return true;
  if (['command_staff', 'agency_admin'].includes(user.role)) {
    return missionAgencyId(mission) === user.agencyId;
  }
  return false;
}

// GET /missions — a field responder always gets exactly their own missions;
// the userId query param is ignored for them rather than trusted, since it
// used to be the only thing identifying the caller. Command staff and agency
// admins may filter freely but are scoped to their own agency.
router.get('/', requireAuth, (req, res) => {
  const { incidentId, teamId, userId } = req.query;

  if (req.user.role === 'field_responder') {
    return res.json(store.getMissions({ userId: req.user.uid, incidentId, teamId }));
  }

  if (['command_staff', 'agency_admin'].includes(req.user.role)) {
    const list = store.getMissions({ userId, incidentId, teamId })
      .filter(m => missionAgencyId(m) === req.user.agencyId);
    return res.json(list);
  }

  return res.status(403).json({ error: 'Insufficient permissions' });
});

// GET /missions/:id
router.get('/:id', requireAuth, (req, res) => {
  const mission = store.getMissionById(req.params.id);
  if (!mission) return res.status(404).json({ error: 'Mission not found' });
  // 404 rather than 403 — confirming a mission exists to someone with no claim
  // on it leaks the incident ID space.
  if (!canView(mission, req.user)) return res.status(404).json({ error: 'Mission not found' });
  res.json(mission);
});

// Accept/decline/status are the responder's own report of what they are doing
// on the ground, so only the responders actually dispatched to the mission may
// write them. Previously any unauthenticated caller could mark any mission
// complete.
function requireAssignedResponder(req, res, next) {
  const mission = store.getMissionById(req.params.id);
  if (!mission) return res.status(404).json({ error: 'Mission not found' });
  if (!isAssignedResponder(mission, req.user.uid)) {
    if (!canView(mission, req.user)) return res.status(404).json({ error: 'Mission not found' });
    return res.status(403).json({ error: 'Only a responder assigned to this mission can update it' });
  }
  req.mission = mission;
  next();
}

// PATCH /missions/:id/accept
router.patch('/:id/accept', requireAuth, requireAssignedResponder, (req, res) => {
  res.json(store.updateMissionStatus(req.params.id, { status: 'ACCEPTED' }));
});

// PATCH /missions/:id/decline
router.patch('/:id/decline', requireAuth, requireAssignedResponder, (req, res) => {
  res.json(store.updateMissionStatus(req.params.id, { status: 'DECLINED' }));
});

// PATCH /missions/:id/status — body: { status, notes?, medicalRequired? }
router.patch('/:id/status', requireAuth, requireAssignedResponder, (req, res) => {
  const { status, notes, medicalRequired } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  res.json(store.updateMissionStatus(req.params.id, { status, notes, medicalRequired }));
});

module.exports = router;
