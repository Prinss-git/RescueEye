'use strict';
const request = require('supertest');
const app = require('../app');
const { createTestUser } = require('./helpers');

describe('POST /admin/agencies (system_admin)', () => {
  test('creates an agency and its agency admin together', async () => {
    const { token } = await createTestUser('system_admin');

    const res = await request(app)
      .post('/admin/agencies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        agencyName:   'Test Agency Alpha',
        adminName:    'Alpha Admin',
        adminEmail:   `alpha-admin-${Date.now()}@test.ph`,
        adminPassword: 'pass123456',
      });

    expect(res.status).toBe(201);
    expect(res.body.agency.name).toBe('Test Agency Alpha');
    expect(res.body.admin.role).toBe('agency_admin');
    expect(res.body.admin.agencyId).toBe(res.body.agency.id);
    expect(res.body.admin.passwordHash).toBeUndefined();
  });

  test('rejects a duplicate admin email', async () => {
    const { token } = await createTestUser('system_admin');
    const email = `dupe-${Date.now()}@test.ph`;
    const body = { agencyName: 'Dupe Agency', adminName: 'Dupe Admin', adminEmail: email, adminPassword: 'pass123456' };

    const first = await request(app).post('/admin/agencies').set('Authorization', `Bearer ${token}`).send(body);
    expect(first.status).toBe(201);

    const second = await request(app).post('/admin/agencies').set('Authorization', `Bearer ${token}`).send({
      ...body, agencyName: 'Dupe Agency 2',
    });
    expect(second.status).toBe(409);
  });

  test('non-system_admin tokens are rejected with 403', async () => {
    const { token } = await createTestUser('agency_admin');

    const res = await request(app)
      .get('/admin/agencies')
      .set('Authorization', `Bearer ${token}`);

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
  async function createRealAgency(sysToken) {
    const res = await request(app)
      .post('/admin/agencies')
      .set('Authorization', `Bearer ${sysToken}`)
      .send({
        agencyName:    `Manage Agency ${Date.now()}`,
        adminName:     'Real Admin',
        adminEmail:    `real-admin-${Date.now()}@test.ph`,
        adminPassword: 'pass123456',
      });
    return res.body;
  }

  test('renames an agency', async () => {
    const { token } = await createTestUser('system_admin');
    const { agency } = await createRealAgency(token);

    const res = await request(app)
      .patch(`/admin/agencies/${agency.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Agency' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Agency');
  });

  test('resets an agency admin\'s password', async () => {
    const { token } = await createTestUser('system_admin');
    const { agency, admin } = await createRealAgency(token);

    const reset = await request(app)
      .patch(`/admin/agencies/${agency.id}/admin-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'reset-pass-123' });
    expect(reset.status).toBe(200);

    const login = await request(app)
      .post('/auth/login')
      .send({ email: admin.email, password: 'reset-pass-123' });
    expect(login.status).toBe(200);
  });

  test('deletes an empty (no dispatched teams) agency', async () => {
    const { token } = await createTestUser('system_admin');
    const { agency } = await createRealAgency(token);

    const del = await request(app)
      .delete(`/admin/agencies/${agency.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const list = await request(app).get('/admin/agencies').set('Authorization', `Bearer ${token}`);
    expect(list.body.find(a => a.id === agency.id)).toBeUndefined();
  });

  test('blocks deleting an agency with a dispatched team', async () => {
    const { token } = await createTestUser('system_admin');
    const { agency } = await createRealAgency(token);
    const { token: agencyAdminToken } = await createTestUser('agency_admin', { agencyId: agency.id });

    const teamRes = await request(app)
      .post('/agency/teams')
      .set('Authorization', `Bearer ${agencyAdminToken}`)
      .send({ name: 'Dispatch Team' });
    await request(app).patch(`/teams/${teamRes.body.id}/status`).send({ status: 'DISPATCHED' });

    const del = await request(app)
      .delete(`/admin/agencies/${agency.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(400);
  });
});
