'use strict';
const { Router } = require('express');
const store = require('../lib/store');

const router = Router();
const VALID_STATUSES = ['STANDBY', 'DISPATCHED', 'ON_SITE', 'COMPLETE'];

// GET /teams
router.get('/', (_req, res) => {
  res.json(store.getTeams());
});

// GET /teams/:id
router.get('/:id', (req, res) => {
  const team = store.getTeamById(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  res.json(team);
});

// PATCH /teams/:id/status
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  const team = store.updateTeamStatus(req.params.id, status);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  store.incrementDrillCounter('teamActions');
  res.json(team);
});

// PATCH /teams/:teamId/assign
router.patch('/:teamId/assign', (req, res) => {
  const { incidentId, assignedBy } = req.body;
  if (!incidentId) return res.status(400).json({ error: 'incidentId is required' });
  const result = store.assignTeam(req.params.teamId, incidentId, assignedBy);
  if (!result) return res.status(404).json({ error: 'Team not found' });
  store.incrementDrillCounter('teamActions');
  res.json(result);
});

module.exports = router;
