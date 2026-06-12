'use strict';
const { Router } = require('express');
const store = require('../lib/store');

const router = Router();

const VALID_TYPES     = ['VICTIM_DETECTED', 'FLOOD', 'FIRE', 'STRUCTURAL', 'UNKNOWN'];
const VALID_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// GET /incidents?status=OPEN&type=FLOOD
router.get('/', (req, res) => {
  const { status, type } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (type)   filter.type   = type;
  res.json(store.getIncidents(filter));
});

// GET /incidents/:id
router.get('/:id', (req, res) => {
  const incident = store.getIncidentById(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json(incident);
});

// POST /incidents
router.post('/', (req, res) => {
  const { type, severity, lat, lng, description, reportedBy } = req.body;
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  if (severity && !VALID_SEVERITIES.includes(severity)) {
    return res.status(400).json({ error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}` });
  }
  const drill = store.getActiveDrill();
  const incident = store.createIncident({
    type,
    severity:      severity || 'MEDIUM',
    lat:           lat   ?? 10.3157,
    lng:           lng   ?? 123.8854,
    description:   description || '',
    reportedBy:    reportedBy || 'AI_SYSTEM',
    isDrill:       !!drill,
    drillSessionId: drill?.id || null,
  });
  store.incrementDrillCounter('incidentCount');
  res.status(201).json(incident);
});

// PATCH /incidents/:id/resolve
router.patch('/:id/resolve', (req, res) => {
  const incident = store.resolveIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json(incident);
});

module.exports = router;
