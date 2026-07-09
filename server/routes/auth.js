'use strict';
const { Router } = require('express');
const store = require('../lib/store');
const { verifyPassword, issueSession, revokeSession } = require('../lib/authz');

const router = Router();

/**
 * POST /auth/login
 * Accepts a Firebase ID token (idToken) or falls back to real credentials.
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
          userDoc = {
            uid:          decoded.uid,
            email:        decoded.email,
            displayName:  decoded.name || decoded.email.split('@')[0],
            role:         'command_staff',
            organization: 'Unknown',
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
        role:        'command_staff',
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

  return res.status(401).json({ error: 'Invalid credentials' });
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) revokeSession(token);
  res.json({ success: true });
});

module.exports = router;
