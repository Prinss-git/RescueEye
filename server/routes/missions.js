'use strict';
const { Router } = require('express');
const store = require('../lib/store');

const router = Router();

const VALID_STATUSES = ['ASSIGNED', 'ACCEPTED', 'DECLINED', 'EN_ROUTE', 'ON_SITE', 'TREATING', 'COMPLETED'];

// GET /missions?userId=&incidentId=&teamId=
router.get('/', (req, res) => {
  const { userId, incidentId, teamId } = req.query;
  res.json(store.getMissions({ userId, incidentId, teamId }));
});

// GET /missions/:id
router.get('/:id', (req, res) => {
  const mission = store.getMissionById(req.params.id);
  if (!mission) return res.status(404).json({ error: 'Mission not found' });
  res.json(mission);
});

// PATCH /missions/:id/accept
router.patch('/:id/accept', (req, res) => {
  const mission = store.updateMissionStatus(req.params.id, { status: 'ACCEPTED' });
  if (!mission) return res.status(404).json({ error: 'Mission not found' });
  res.json(mission);
});

// PATCH /missions/:id/decline
router.patch('/:id/decline', (req, res) => {
  const mission = store.updateMissionStatus(req.params.id, { status: 'DECLINED' });
  if (!mission) return res.status(404).json({ error: 'Mission not found' });
  res.json(mission);
});

// PATCH /missions/:id/status — body: { status, notes?, medicalRequired? }
router.patch('/:id/status', (req, res) => {
  const { status, notes, medicalRequired } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  const mission = store.updateMissionStatus(req.params.id, { status, notes, medicalRequired });
  if (!mission) return res.status(404).json({ error: 'Mission not found' });
  res.json(mission);
});

module.exports = router;
