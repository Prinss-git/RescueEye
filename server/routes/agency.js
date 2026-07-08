'use strict';
const { Router } = require('express');
const store = require('../lib/store');
const { hashPassword, requireAuth, requireRole } = require('../lib/authz');

const router = Router();

const CREATABLE_ROLES = [
  'incident_commander',
  'drone_operator',
  'coordinator',
  'sar_responder',
  'ems_responder',
];

router.use(requireAuth, requireRole('agency_admin'));

function toSafeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// GET /agency/users — list users belonging to the caller's own agency
router.get('/users', (req, res) => {
  const users = store.getUsers({ agencyId: req.user.agencyId }).map(toSafeUser);
  res.json(users);
});

// POST /agency/users — create a Command Staff or Field Responder account
// scoped to the caller's own agency
router.post('/users', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }
  if (!CREATABLE_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${CREATABLE_ROLES.join(', ')}` });
  }
  if (store.getUserByEmail(email)) {
    return res.status(409).json({ error: 'A user with this email already exists' });
  }

  const agency = store.getAgencyById(req.user.agencyId);
  const passwordHash = await hashPassword(password);
  const user = store.createUser({
    email,
    displayName:  name,
    role,
    organization: agency ? agency.name : null,
    agencyId:     req.user.agencyId,
    passwordHash,
  });

  res.status(201).json(toSafeUser(user));
});

// PATCH /agency/users/:id/active — activate/deactivate a responder without deleting them
router.patch('/users/:id/active', (req, res) => {
  const { active } = req.body;
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'active must be a boolean' });
  }

  const target = store.getUserById(req.params.id);
  if (!target || target.agencyId !== req.user.agencyId) {
    return res.status(404).json({ error: 'User not found in your agency' });
  }

  const updated = store.setUserActive(req.params.id, active);
  res.json(toSafeUser(updated));
});

module.exports = router;
