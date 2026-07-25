'use strict';
const { Router } = require('express');
const store = require('../lib/store');
const { requireAuth, requireRole } = require('../lib/authz');

const router = Router();

router.use(requireAuth, requireRole('command_staff'));

const TERMINAL = ['COMPLETED', 'DECLINED'];

function toSafe(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// GET /command/responders — the caller's agency field responders with
// availability, last location check-in, and their current active mission.
router.get('/responders', (req, res) => {
  const responders = store.getUsers({ agencyId: req.user.agencyId, role: 'field_responder' });
  const enriched = responders.map((u) => {
    const active = store.getMissions({ userId: u.uid }).find((m) => !TERMINAL.includes(m.status));
    const incident = active ? store.getIncidentById(active.incidentId) : null;
    return {
      ...toSafe(u),
      currentMission: active
        ? {
            id: active.id,
            status: active.status,
            incidentId: active.incidentId,
            incidentType: incident ? incident.type : null,
            incidentSeverity: incident ? incident.severity : null,
          }
        : null,
    };
  });
  res.json(enriched);
});

// GET /command/missions — enriched missions for the caller's own agency,
// with the assigned responders' display names resolved.
router.get('/missions', (req, res) => {
  const missions = store.getMissionsEnriched({ agencyId: req.user.agencyId }).map((m) => ({
    ...m,
    responderNames: (m.responderUserIds || [])
      .map((uid) => store.getUserById(uid)?.displayName)
      .filter(Boolean),
  }));
  res.json(missions);
});

module.exports = router;
