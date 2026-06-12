'use strict';
const { Router } = require('express');
const store = require('../lib/store');

const router = Router();

// POST /drill/start
router.post('/start', (req, res) => {
  const userId = req.body.userId || 'incident_commander';
  const session = store.startDrill(userId);
  res.status(201).json(session);
});

// POST /drill/stop
router.post('/stop', (_req, res) => {
  const result = store.stopDrill();
  if (!result) return res.status(400).json({ error: 'No active drill session' });
  res.json(result);
});

// GET /drill/active
router.get('/active', (_req, res) => {
  const drill = store.getActiveDrill();
  res.json(drill || { active: false });
});

// GET /drill/:sessionId/status
router.get('/:sessionId/status', (req, res) => {
  const status = store.getDrillStatus(req.params.sessionId);
  if (!status) return res.status(404).json({ error: 'Drill session not found or ended' });
  res.json(status);
});

module.exports = router;
