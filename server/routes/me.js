'use strict';
const { Router } = require('express');
const store = require('../lib/store');
const { requireAuth, requireRole } = require('../lib/authz');

const router = Router();

// PATCH /me/location — a field responder's mobile app reports its current
// GPS position, so verified incidents can be auto-dispatched to whoever is
// physically closest.
router.patch('/location', requireAuth, requireRole('field_responder'), (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng must be numbers' });
  }

  const user = store.updateUserLocation(req.user.uid, lat, lng);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { passwordHash, ...safe } = user;
  res.json(safe);
});

module.exports = router;
