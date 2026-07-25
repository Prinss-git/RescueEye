'use strict';
const { Router } = require('express');
const store = require('../lib/store');
const { requireAuth, requireRole } = require('../lib/authz');

const router = Router();

const VALID_TYPES     = ['VICTIM_DETECTED', 'FLOOD', 'FIRE', 'STRUCTURAL', 'UNKNOWN'];
const VALID_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// GET /incidents?status=OPEN&type=FLOOD&verified=true
router.get('/', (req, res) => {
  const { status, type, verified } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (type)   filter.type   = type;
  if (verified !== undefined) filter.verified = verified === 'true';
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
  const { type, severity, lat, lng, description, reportedBy, droneId, droneCallsign } = req.body;
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  if (severity && !VALID_SEVERITIES.includes(severity)) {
    return res.status(400).json({ error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}` });
  }

  const source = reportedBy || 'AI_SYSTEM';
  const isAI = source === 'AI_SYSTEM';

  // AI detections are spotted by a drone — resolve which one, defaulting to
  // the platform's single feed drone.
  let drone = droneId ? store.getDroneById(droneId) : null;
  if (!drone && isAI) drone = store.getDefaultDrone();

  // The casualty is directly below where the drone spotted it, so the
  // incident's location is the drone's position at detection time. If an AI
  // detection arrives with no coordinate, scatter it across the AOI rather
  // than piling every incident onto one hardcoded point.
  let coordLat = lat, coordLng = lng;
  if (coordLat == null || coordLng == null) {
    if (isAI) { const c = store.randomAoiCoord(); coordLat = c.lat; coordLng = c.lng; }
    else      { coordLat = 10.3157; coordLng = 123.8854; }
  }

  const drill = store.getActiveDrill();
  const incident = store.createIncident({
    type,
    severity:      severity || 'MEDIUM',
    lat:           coordLat,
    lng:           coordLng,
    description:   description || '',
    reportedBy:    source,
    droneId:       drone ? drone.id : null,
    droneCallsign: droneCallsign || (drone ? drone.callsign : null),
    isDrill:       !!drill,
    drillSessionId: drill?.id || null,
  });

  // Record where the drone last operated.
  if (drone) store.updateDronePosition(drone.id, coordLat, coordLng);

  store.incrementDrillCounter('incidentCount');
  res.status(201).json(incident);
});

// PATCH /incidents/:id/resolve
router.patch('/:id/resolve', (req, res) => {
  const incident = store.resolveIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json(incident);
});

// PATCH /incidents/:id/verify — Command Staff confirms a detected casualty
// is real. Immediately dispatches the nearest active field responder in
// the verifying Command Staff's own agency, by last reported location.
router.patch('/:id/verify', requireAuth, requireRole('command_staff'), (req, res) => {
  const incident = store.getIncidentById(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  if (incident.verified) return res.status(400).json({ error: 'Incident already verified' });

  const result = store.verifyIncident(req.params.id, req.user.uid, req.user.agencyId);
  res.json(result);
});

module.exports = router;
