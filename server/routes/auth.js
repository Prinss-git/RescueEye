'use strict';
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Router } = require('express');
const store = require('../lib/store');
const { verifyPassword, hashPassword, issueSession, revokeSession } = require('../lib/authz');

const router = Router();

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'agencies');
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024, files: 5 },
});

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

    // Agency-scoped accounts (everyone except System Admin) are locked out
    // until their agency clears the System Admin's registration review, and
    // shut out again if the agency's subscription lapses afterward. If the
    // agency record itself can't be found, there's nothing to gate on —
    // that only happens for orphaned/test data, not a real pending state.
    const agency = realUser.agencyId ? store.getAgencyById(realUser.agencyId) : null;
    if (agency) {
      if (agency.registrationStatus === 'PENDING') {
        return res.status(403).json({ error: 'Your agency\'s registration is still pending System Admin approval.' });
      }
      if (agency.registrationStatus === 'REJECTED') {
        return res.status(403).json({ error: 'Your agency\'s registration was not approved. Contact RescueEye support.' });
      }
      if (agency.subscriptionStatus !== 'ACTIVE') {
        return res.status(403).json({ error: `Your agency's subscription is ${agency.subscriptionStatus.toLowerCase()}. Contact your agency admin.` });
      }
    }

    store.touchUserLogin(realUser.uid);
    const { passwordHash, ...safeUser } = realUser;
    return res.json({ token: issueSession(realUser), user: safeUser });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

// POST /auth/register-agency — public self-service signup. Creates the
// AGENCY (locked at PENDING) and its first agency_admin USER together;
// neither can log in until a System Admin approves the agency. Requires at
// least one verification document (e.g. accreditation certificate,
// government-issued ID) — a name/email/password alone proves nothing about
// whether the organization is real, which is exactly what the System Admin
// is supposed to be checking before approving.
router.post('/register-agency', upload.array('documents', 5), async (req, res) => {
  const { agencyName, adminName, adminEmail, adminPassword } = req.body;

  if (!agencyName || !adminName || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: 'agencyName, adminName, adminEmail, and adminPassword are required' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'At least one verification document (e.g. accreditation certificate, government ID) is required' });
  }
  if (store.getUserByEmail(adminEmail)) {
    return res.status(409).json({ error: 'A user with this email already exists' });
  }

  const passwordHash = await hashPassword(adminPassword);
  const { agency } = store.registerAgency({ agencyName, adminName, adminEmail, passwordHash });

  const agencyDir = path.join(UPLOAD_ROOT, agency.id);
  fs.mkdirSync(agencyDir, { recursive: true });
  const docs = req.files.map((file) => {
    const storedName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    fs.writeFileSync(path.join(agencyDir, storedName), file.buffer);
    return { fileName: file.originalname, storedName, uploadedAt: new Date().toISOString() };
  });
  store.addAgencyDocuments(agency.id, docs);

  res.status(201).json({
    message: 'Registration submitted. A RescueEye System Admin will review your agency before you can log in.',
    agencyId: agency.id,
  });
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) revokeSession(token);
  res.json({ success: true });
});

module.exports = router;
