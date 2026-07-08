'use strict';
const { Router } = require('express');
const store = require('../lib/store');
const { verifyPassword, issueSession, revokeSession } = require('../lib/authz');

const router = Router();

// Role map for demo accounts (when Firebase Auth is not active)
const DEMO_ACCOUNTS = {
  'commander@rescueeye.ph':  { role: 'incident_commander', displayName: 'Cdr. Reyes',      organization: 'CDRRMO Cebu' },
  'operator@rescueeye.ph':   { role: 'drone_operator',     displayName: 'Tech. Santos',    organization: 'CDRRMO Cebu' },
  'coordinator@rescueeye.ph':{ role: 'coordinator',        displayName: 'Coord. Cruz',     organization: 'BFP Cebu' },
  'sar@rescueeye.ph':        { role: 'sar_responder',      displayName: 'SAR Team Alpha',  organization: 'CDRRMO Cebu' },
  'ems@rescueeye.ph':        { role: 'ems_responder',      displayName: 'EMS Team Bravo',  organization: 'Cebu City Health Office' },
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
      const finalUser = userDoc || {
        uid:         decoded.uid,
        email:       decoded.email,
        displayName: decoded.name || decoded.email.split('@')[0],
        role:        'coordinator',
      };
      return res.json({ token: issueSession(finalUser), user: finalUser });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid Firebase ID token', detail: err.message });
    }
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  // Real accounts created via the admin/agency-admin flow — require a real
  // password match against the stored hash.
  const realUser = store.getUserByEmail(email);
  if (realUser) {
    if (!realUser.active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    const ok = await verifyPassword(password, realUser.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    store.touchUserLogin(realUser.uid);
    const { passwordHash, ...safeUser } = realUser;
    return res.json({ token: issueSession(realUser), user: safeUser });
  }

  // Legacy demo accounts — any password accepted, unchanged behavior.
  const demo = DEMO_ACCOUNTS[email];
  if (!demo) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const demoUser = {
    uid:          `demo-${email.split('@')[0]}`,
    email,
    displayName:  demo.displayName,
    role:         demo.role,
    organization: demo.organization,
  };
  return res.json({ token: issueSession(demoUser), user: demoUser });
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) revokeSession(token);
  res.json({ success: true });
});

module.exports = router;
