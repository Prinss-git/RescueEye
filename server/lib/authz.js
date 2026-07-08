/**
 * Password hashing and a lightweight in-memory session/role-auth layer.
 * There is no JWT infra in this project — sessions are an opaque token
 * mapped to the authenticated user, held in memory for the process
 * lifetime (mirrors the rest of store.js's in-memory-first design).
 */
'use strict';

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

// token -> { uid, email, role, agencyId }
const sessions = new Map();

function issueSession(user) {
  const token = Buffer.from(`${user.email}:${user.uid}:${Date.now()}`).toString('base64');
  sessions.set(token, {
    uid:      user.uid,
    email:    user.email,
    role:     user.role,
    agencyId: user.agencyId || null,
  });
  return token;
}

function resolveSession(token) {
  return sessions.get(token) || null;
}

function revokeSession(token) {
  sessions.delete(token);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  const session = token && resolveSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = session;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  issueSession,
  resolveSession,
  revokeSession,
  requireAuth,
  requireRole,
};
