'use strict';
const { Router } = require('express');
const store = require('../lib/store');
const { requireAuth, requireRole } = require('../lib/authz');
const { isExpoPushToken } = require('../lib/push');

const router = Router();

// A user record carries a password hash and a device push token; neither
// belongs in an API response.
function safeUser(user) {
  const { passwordHash, pushToken, ...safe } = user;
  return { ...safe, pushRegistered: !!pushToken };
}

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

  res.json(safeUser(user));
});

// PATCH /me/push-token — the mobile app registers the Expo push token for the
// device it's running on. Without this, dispatch can only reach a responder
// who happens to have the app open, which is not a dispatch system.
//
// The token is bound to req.user.uid from the session, never to a uid in the
// body — otherwise any caller could redirect another responder's dispatches
// to their own device.
router.patch('/push-token', requireAuth, (req, res) => {
  const { token, platform } = req.body;

  if (!isExpoPushToken(token)) {
    return res.status(400).json({
      error: 'token must be an Expo push token (ExponentPushToken[...])',
    });
  }

  const user = store.setUserPushToken(req.user.uid, token, platform);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json(safeUser(user));
});

// DELETE /me/push-token — called on logout. A token left behind would keep
// delivering this responder's dispatches to a device someone else now uses.
router.delete('/push-token', requireAuth, (req, res) => {
  const user = store.clearUserPushToken(req.user.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(safeUser(user));
});

module.exports = router;
