'use strict';
const { Router } = require('express');
const store = require('../lib/store');

const router = Router();

// Role map for demo accounts (when Firebase Auth is not active)
const DEMO_ACCOUNTS = {
  'commander@rescueeye.ph':  { role: 'incident_commander', displayName: 'Cdr. Reyes',    organization: 'CDRRMO Cebu' },
  'operator@rescueeye.ph':   { role: 'drone_operator',     displayName: 'Tech. Santos',  organization: 'CDRRMO Cebu' },
  'coordinator@rescueeye.ph':{ role: 'coordinator',        displayName: 'Coord. Cruz',   organization: 'BFP Cebu' },
};

/**
 * POST /auth/login
 * Accepts a Firebase ID token (idToken) or falls back to demo credentials.
 */
router.post('/login', async (req, res) => {
  const { email, password, idToken } = req.body;

  // Firebase ID token verification path
  const admin = req.app.get('firebaseAdmin');
  if (idToken && admin) {
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const db = store.getDb();
      let userDoc = null;
      if (db) {
        const snap = await db.collection('users').doc(decoded.uid).get();
        if (snap.exists) {
          userDoc = snap.data();
        } else {
          // First login — create user document
          const demo = DEMO_ACCOUNTS[decoded.email] || {};
          userDoc = {
            uid:          decoded.uid,
            email:        decoded.email,
            displayName:  decoded.name || decoded.email.split('@')[0],
            role:         demo.role || 'coordinator',
            organization: demo.organization || 'Unknown',
            createdAt:    new Date().toISOString(),
            lastLogin:    new Date().toISOString(),
          };
          await db.collection('users').doc(decoded.uid).set(userDoc);
        }
        await db.collection('users').doc(decoded.uid).update({ lastLogin: new Date().toISOString() });
      }
      return res.json({
        token: idToken,
        user: userDoc || {
          uid:         decoded.uid,
          email:       decoded.email,
          displayName: decoded.name || decoded.email.split('@')[0],
          role:        'coordinator',
        },
      });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid Firebase ID token', detail: err.message });
    }
  }

  // Demo credential fallback
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const demo = DEMO_ACCOUNTS[email];
  const mockToken = Buffer.from(`${email}:${Date.now()}`).toString('base64');
  return res.json({
    token: mockToken,
    user: {
      uid:          `demo-${email.split('@')[0]}`,
      email,
      displayName:  demo?.displayName || email.split('@')[0],
      role:         demo?.role        || 'coordinator',
      organization: demo?.organization|| 'Unknown',
    },
  });
});

// POST /auth/logout
router.post('/logout', (_req, res) => {
  res.json({ success: true });
});

module.exports = router;
