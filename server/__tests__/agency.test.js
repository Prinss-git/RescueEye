'use strict';
const request = require('supertest');
const app = require('../app');
const { createTestUser } = require('./helpers');

async function registerAgency(overrides = {}) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const body = {
    agencyName:    overrides.agencyName    || `Test Agency ${suffix}`,
    adminName:     overrides.adminName     || 'Agency Admin',
    adminEmail:    overrides.adminEmail    || `admin-${suffix}@test.ph`,
    adminPassword: overrides.adminPassword || 'pass123456',
  };
  const req = request(app).post('/auth/register-agency');
  for (const [key, value] of Object.entries(body)) req.field(key, value);
  if (overrides.skipDocument !== true) {
    req.attach('documents', Buffer.from('fake accreditation certificate'), 'accreditation.pdf');
  }
  const res = await req;
  return { res, body };
}

async function createPendingAgency() {
  const { res, body } = await registerAgency();
  return { agencyId: res.body.agencyId, adminEmail: body.adminEmail, adminPassword: body.adminPassword };
}

describe('POST /auth/register-agency (self-service)', () => {
  test('creates a PENDING agency and its agency admin together', async () => {
    const { res, body } = await registerAgency();
    expect(res.status).toBe(201);
    expect(res.body.agencyId).toBeTruthy();

    const { token: sysToken } = await createTestUser('system_admin');
    const list = await request(app).get('/admin/agencies?status=PENDING').set('Authorization', `Bearer ${sysToken}`);
    const created = list.body.find((a) => a.id === res.body.agencyId);
    expect(created).toBeTruthy();
    expect(created.name).toBe(body.agencyName);
    expect(created.admin.email).toBe(body.adminEmail);
  });

  test('rejects registration with no verification document attached', async () => {
    const { res } = await registerAgency({ skipDocument: true });
    expect(res.status).toBe(400);
  });

  test('rejects a duplicate admin email', async () => {
    const email = `dupe-${Date.now()}@test.ph`;
    const first = await registerAgency({ adminEmail: email });
    expect(first.res.status).toBe(201);

    const second = await registerAgency({ adminEmail: email });
    expect(second.res.status).toBe(409);
  });

  test('the new agency admin cannot log in until approved', async () => {
    const { body } = await registerAgency();
    const login = await request(app)
      .post('/auth/login')
      .send({ email: body.adminEmail, password: body.adminPassword });
    expect(login.status).toBe(403);
  });
});

describe('System Admin agency queue access', () => {
  test('non-system_admin tokens are rejected with 403', async () => {
    const { token } = await createTestUser('agency_admin');
    const res = await request(app).get('/admin/agencies').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('requests with no token are rejected with 401', async () => {
    const res = await request(app).get('/admin/agencies');
    expect(res.status).toBe(401);
  });
});

describe('POST /agency/users (agency_admin)', () => {
  test('creates a user scoped to the caller\'s own agency', async () => {
    const agencyId = `AGCY-test-${Date.now()}`;
    const { token } = await createTestUser('agency_admin', { agencyId });

    const res = await request(app)
      .post('/agency/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Responder', email: `resp-${Date.now()}@test.ph`, password: 'pass123456', role: 'field_responder' });

    expect(res.status).toBe(201);
    expect(res.body.agencyId).toBe(agencyId);
    expect(res.body.passwordHash).toBeUndefined();
  });

  test('rejects an invalid role', async () => {
    const { token } = await createTestUser('agency_admin', { agencyId: `AGCY-test-${Date.now()}` });

    const res = await request(app)
      .post('/agency/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad Role', email: `bad-${Date.now()}@test.ph`, password: 'pass123456', role: 'system_admin' });

    expect(res.status).toBe(400);
  });

  test('agency admins cannot see or modify another agency\'s users', async () => {
    const agencyA = `AGCY-a-${Date.now()}`;
    const agencyB = `AGCY-b-${Date.now()}`;
    const { token: tokenA } = await createTestUser('agency_admin', { agencyId: agencyA });
    const { user: userB } = await createTestUser('field_responder', { agencyId: agencyB });

    const list = await request(app).get('/agency/users').set('Authorization', `Bearer ${tokenA}`);
    expect(list.body.find(u => u.uid === userB.uid)).toBeUndefined();

    const patch = await request(app)
      .patch(`/agency/users/${userB.uid}/active`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ active: false });
    expect(patch.status).toBe(404);
  });

  test('agency admin can edit a managed user\'s name/email', async () => {
    const agencyId = `AGCY-edit-${Date.now()}`;
    const { token } = await createTestUser('agency_admin', { agencyId });
    const { user } = await createTestUser('field_responder', { agencyId });

    const res = await request(app)
      .patch(`/agency/users/${user.uid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Responder', email: `renamed-${Date.now()}@test.ph` });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Renamed Responder');
  });

  test('agency admin edit rejects an email already used by someone else', async () => {
    const agencyId = `AGCY-edit-${Date.now()}`;
    const { token } = await createTestUser('agency_admin', { agencyId });
    const { user: userA } = await createTestUser('field_responder', { agencyId });
    const { user: userB } = await createTestUser('field_responder', { agencyId });

    const res = await request(app)
      .patch(`/agency/users/${userA.uid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: userB.email });

    expect(res.status).toBe(409);
  });

  test('agency admin can reset a managed user\'s password', async () => {
    const agencyId = `AGCY-pw-${Date.now()}`;
    const { token } = await createTestUser('agency_admin', { agencyId });
    const { user } = await createTestUser('field_responder', { agencyId });

    const reset = await request(app)
      .patch(`/agency/users/${user.uid}/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'brand-new-pass' });
    expect(reset.status).toBe(200);

    const login = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: 'brand-new-pass' });
    expect(login.status).toBe(200);
  });
});

describe('System Admin agency management', () => {
  test('approves a pending agency, unlocking its admin\'s login', async () => {
    const { token: sysToken } = await createTestUser('system_admin');
    const { agencyId, adminEmail, adminPassword } = await createPendingAgency();

    const approve = await request(app)
      .patch(`/admin/agencies/${agencyId}/approve`)
      .set('Authorization', `Bearer ${sysToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.registrationStatus).toBe('APPROVED');
    expect(approve.body.validatedBy).toBeTruthy();

    const login = await request(app).post('/auth/login').send({ email: adminEmail, password: adminPassword });
    expect(login.status).toBe(200);
  });

  test('rejects a pending agency with a reason, keeping its admin locked out', async () => {
    const { token: sysToken } = await createTestUser('system_admin');
    const { agencyId, adminEmail, adminPassword } = await createPendingAgency();

    const reject = await request(app)
      .patch(`/admin/agencies/${agencyId}/reject`)
      .set('Authorization', `Bearer ${sysToken}`)
      .send({ reason: 'Missing accreditation documents' });
    expect(reject.status).toBe(200);
    expect(reject.body.registrationStatus).toBe('REJECTED');
    expect(reject.body.rejectionReason).toBe('Missing accreditation documents');

    const login = await request(app).post('/auth/login').send({ email: adminEmail, password: adminPassword });
    expect(login.status).toBe(403);
  });

  test('cannot approve an agency that is not pending', async () => {
    const { token: sysToken } = await createTestUser('system_admin');
    const { agencyId } = await createPendingAgency();
    await request(app).patch(`/admin/agencies/${agencyId}/approve`).set('Authorization', `Bearer ${sysToken}`);

    const res = await request(app).patch(`/admin/agencies/${agencyId}/approve`).set('Authorization', `Bearer ${sysToken}`);
    expect(res.status).toBe(400);
  });

  test('subscription status can only be toggled once an agency is approved', async () => {
    const { token: sysToken } = await createTestUser('system_admin');
    const { agencyId } = await createPendingAgency();

    const beforeApproval = await request(app)
      .patch(`/admin/agencies/${agencyId}/status`)
      .set('Authorization', `Bearer ${sysToken}`)
      .send({ status: 'SUSPENDED' });
    expect(beforeApproval.status).toBe(400);

    await request(app).patch(`/admin/agencies/${agencyId}/approve`).set('Authorization', `Bearer ${sysToken}`);

    const afterApproval = await request(app)
      .patch(`/admin/agencies/${agencyId}/status`)
      .set('Authorization', `Bearer ${sysToken}`)
      .send({ status: 'SUSPENDED' });
    expect(afterApproval.status).toBe(200);
    expect(afterApproval.body.subscriptionStatus).toBe('SUSPENDED');
  });

  test('records approve/reject/suspend actions in the action log', async () => {
    const { token: sysToken } = await createTestUser('system_admin');
    const { agencyId } = await createPendingAgency();
    await request(app).patch(`/admin/agencies/${agencyId}/approve`).set('Authorization', `Bearer ${sysToken}`);

    const actions = await request(app).get('/admin/actions').set('Authorization', `Bearer ${sysToken}`);
    expect(actions.status).toBe(200);
    expect(actions.body.some((a) => a.type === 'AGENCY_APPROVED' && a.agencyId === agencyId)).toBe(true);
  });

  test('deletes an empty (no dispatched teams) agency', async () => {
    const { token: sysToken } = await createTestUser('system_admin');
    const { agencyId } = await createPendingAgency();
    await request(app).patch(`/admin/agencies/${agencyId}/approve`).set('Authorization', `Bearer ${sysToken}`);

    const del = await request(app)
      .delete(`/admin/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${sysToken}`);
    expect(del.status).toBe(200);

    const list = await request(app).get('/admin/agencies').set('Authorization', `Bearer ${sysToken}`);
    expect(list.body.find((a) => a.id === agencyId)).toBeUndefined();
  });

  test('blocks deleting an agency with a dispatched team', async () => {
    const { token: sysToken } = await createTestUser('system_admin');
    const { agencyId, adminEmail, adminPassword } = await createPendingAgency();
    await request(app).patch(`/admin/agencies/${agencyId}/approve`).set('Authorization', `Bearer ${sysToken}`);

    const agencyLogin = await request(app).post('/auth/login').send({ email: adminEmail, password: adminPassword });
    const agencyAdminToken = agencyLogin.body.token;

    const teamRes = await request(app)
      .post('/agency/teams')
      .set('Authorization', `Bearer ${agencyAdminToken}`)
      .send({ name: 'Dispatch Team' });
    await request(app).patch(`/teams/${teamRes.body.id}/status`).send({ status: 'DISPATCHED' });

    const del = await request(app)
      .delete(`/admin/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${sysToken}`);
    expect(del.status).toBe(400);
  });
});
