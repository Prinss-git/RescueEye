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
});
