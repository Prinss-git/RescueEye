'use strict';
const { Router } = require('express');
const store = require('../lib/store');
const { hashPassword, requireAuth, requireRole } = require('../lib/authz');

const router = Router();

router.use(requireAuth, requireRole('system_admin'));

function toSafeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// GET /admin/agencies — list every agency with its admin and user count
router.get('/agencies', (_req, res) => {
  const agencies = store.getAgencies().map((agency) => {
    const agencyUsers = store.getUsers({ agencyId: agency.id });
    const admin = agencyUsers.find((u) => u.role === 'agency_admin');
    return {
      ...agency,
      admin: admin ? toSafeUser(admin) : null,
      userCount: agencyUsers.length,
    };
  });
  res.json(agencies);
});

// POST /admin/agencies — create an agency and its first Agency Admin together
router.post('/agencies', async (req, res) => {
  const { agencyName, subscriptionStatus, adminName, adminEmail, adminPassword } = req.body;

  if (!agencyName || !adminName || !adminEmail || !adminPassword) {
    return res.status(400).json({
      error: 'agencyName, adminName, adminEmail, and adminPassword are required',
    });
  }
  if (store.getUserByEmail(adminEmail)) {
    return res.status(409).json({ error: 'A user with this email already exists' });
  }

  const agency = store.createAgency({
    name:               agencyName,
    subscriptionStatus: subscriptionStatus || 'ACTIVE',
    createdBy:           req.user.uid,
  });

  const passwordHash = await hashPassword(adminPassword);
  const admin = store.createUser({
    email:        adminEmail,
    displayName:  adminName,
    role:         'agency_admin',
    organization: agencyName,
    agencyId:     agency.id,
    passwordHash,
  });

  res.status(201).json({ agency, admin: toSafeUser(admin) });
});

// PATCH /admin/agencies/:id/status — toggle an agency's subscription status
router.patch('/agencies/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });

  const agency = store.setAgencySubscriptionStatus(req.params.id, status);
  if (!agency) return res.status(404).json({ error: 'Agency not found' });
  res.json(agency);
});

// PATCH /admin/agencies/:id — rename an agency
router.patch('/agencies/:id', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const agency = store.renameAgency(req.params.id, name.trim());
  if (!agency) return res.status(404).json({ error: 'Agency not found' });
  res.json(agency);
});

// DELETE /admin/agencies/:id — cascade-deletes the agency, its users, and its teams
router.delete('/agencies/:id', (req, res) => {
  const agency = store.getAgencyById(req.params.id);
  if (!agency) return res.status(404).json({ error: 'Agency not found' });

  const teams = store.getTeams({ agencyId: agency.id });
  if (teams.some((t) => t.status !== 'STANDBY')) {
    return res.status(400).json({ error: 'Cannot delete an agency with teams currently dispatched' });
  }

  store.deleteAgencyCascade(agency.id);
  res.json({ success: true });
});

// PATCH /admin/agencies/:id/admin-password — reset the agency's admin's password
router.patch('/agencies/:id/admin-password', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password is required' });

  const agencyUsers = store.getUsers({ agencyId: req.params.id });
  const admin = agencyUsers.find((u) => u.role === 'agency_admin');
  if (!admin) return res.status(404).json({ error: 'No agency admin found for this agency' });

  const passwordHash = await hashPassword(password);
  store.setUserPassword(admin.uid, passwordHash);
  res.json({ success: true });
});

// GET /admin/missions — every mission system-wide, with owning agency name attached
router.get('/missions', (_req, res) => {
  const missions = store.getMissionsEnriched().map((m) => {
    const agency = m.agencyId ? store.getAgencyById(m.agencyId) : null;
    return { ...m, agencyName: agency ? agency.name : null };
  });
  res.json(missions);
});

module.exports = router;
