'use strict';
const path = require('path');
const { Router } = require('express');
const store = require('../lib/store');
const { requireAuth, requireRole } = require('../lib/authz');

const router = Router();

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'agencies');

router.use(requireAuth, requireRole('system_admin'));

function toSafeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function withAdminAndCount(agency) {
  const agencyUsers = store.getUsers({ agencyId: agency.id });
  const admin = agencyUsers.find((u) => u.role === 'agency_admin');
  return {
    ...agency,
    admin: toSafeUser(admin),
    userCount: agencyUsers.length,
  };
}

// GET /admin/agencies?status=PENDING|APPROVED|REJECTED — registration queue
// and subscription roster. System Admin's job is limited to reviewing
// registrations and monitoring subscription status — nothing else about an
// agency's internals (renaming, credentials, operational data) lives here.
router.get('/agencies', (req, res) => {
  const { status } = req.query;
  const agencies = store.getAgencies({ registrationStatus: status }).map(withAdminAndCount);
  res.json(agencies);
});

// GET /admin/agencies/:id/documents/:storedName — download a submitted
// verification document. storedName must match an entry already recorded
// on this agency (set only by the upload step itself), so an attacker
// can't use this to read arbitrary files off disk.
router.get('/agencies/:id/documents/:storedName', (req, res) => {
  const agency = store.getAgencyById(req.params.id);
  if (!agency) return res.status(404).json({ error: 'Agency not found' });

  const doc = (agency.verificationDocuments || []).find((d) => d.storedName === req.params.storedName);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  res.download(path.join(UPLOAD_ROOT, agency.id, doc.storedName), doc.fileName);
});

// PATCH /admin/agencies/:id/approve — clears a pending registration
router.patch('/agencies/:id/approve', (req, res) => {
  const agency = store.getAgencyById(req.params.id);
  if (!agency) return res.status(404).json({ error: 'Agency not found' });
  if (agency.registrationStatus !== 'PENDING') {
    return res.status(400).json({ error: 'Only pending agencies can be approved' });
  }

  const updated = store.approveAgency(req.params.id, req.user.uid);
  res.json(withAdminAndCount(updated));
});

// PATCH /admin/agencies/:id/reject — body: { reason }
router.patch('/agencies/:id/reject', (req, res) => {
  const { reason } = req.body;
  const agency = store.getAgencyById(req.params.id);
  if (!agency) return res.status(404).json({ error: 'Agency not found' });
  if (agency.registrationStatus !== 'PENDING') {
    return res.status(400).json({ error: 'Only pending agencies can be rejected' });
  }

  const updated = store.rejectAgency(req.params.id, req.user.uid, reason);
  res.json(withAdminAndCount(updated));
});

// PATCH /admin/agencies/:id/status — toggle an approved agency's subscription
router.patch('/agencies/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });

  const agency = store.getAgencyById(req.params.id);
  if (!agency) return res.status(404).json({ error: 'Agency not found' });
  if (agency.registrationStatus !== 'APPROVED') {
    return res.status(400).json({ error: 'Only approved agencies have a subscription to monitor' });
  }

  const updated = store.setAgencySubscriptionStatus(req.params.id, status, req.user.uid);
  res.json(withAdminAndCount(updated));
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

// GET /admin/actions — accountability feed of this System Admin's own
// approve/reject/suspend actions
router.get('/actions', (_req, res) => {
  const actions = store.getAdminActions().map((a) => {
    const agency = a.agencyId ? store.getAgencyById(a.agencyId) : null;
    return { ...a, agencyName: agency ? agency.name : null };
  });
  res.json(actions);
});

module.exports = router;
