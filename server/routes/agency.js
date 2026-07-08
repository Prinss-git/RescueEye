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

const TEAM_MEMBER_ROLES = ['sar_responder', 'ems_responder'];

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

// GET /agency/teams — list the caller's agency's teams
router.get('/teams', (req, res) => {
  res.json(store.getTeams({ agencyId: req.user.agencyId }));
});

// POST /agency/teams — create a team scoped to the caller's agency
router.post('/teams', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const team = store.createTeam({ name, agencyId: req.user.agencyId });
  res.status(201).json(team);
});

// POST /agency/teams/:teamId/members — add a Field Responder to a team roster
router.post('/teams/:teamId/members', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const team = store.getTeamById(req.params.teamId);
  if (!team || team.agencyId !== req.user.agencyId) {
    return res.status(404).json({ error: 'Team not found in your agency' });
  }

  const member = store.getUserById(userId);
  if (!member || member.agencyId !== req.user.agencyId) {
    return res.status(404).json({ error: 'User not found in your agency' });
  }
  if (!TEAM_MEMBER_ROLES.includes(member.role)) {
    return res.status(400).json({ error: `Only these roles can join a team: ${TEAM_MEMBER_ROLES.join(', ')}` });
  }

  const updated = store.addTeamMember(req.params.teamId, userId);
  res.json(updated);
});

// DELETE /agency/teams/:teamId/members/:userId — remove a responder from a team roster
router.delete('/teams/:teamId/members/:userId', (req, res) => {
  const team = store.getTeamById(req.params.teamId);
  if (!team || team.agencyId !== req.user.agencyId) {
    return res.status(404).json({ error: 'Team not found in your agency' });
  }

  const updated = store.removeTeamMember(req.params.teamId, req.params.userId);
  res.json(updated);
});

module.exports = router;
