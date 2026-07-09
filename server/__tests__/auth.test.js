'use strict';
const request = require('supertest');
const app = require('../app');
const { createTestUser } = require('./helpers');

describe('POST /auth/login', () => {
  test('real account logs in with the correct password', async () => {
    const { user, password } = await createTestUser('command_staff');

    const res = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('real account rejects the wrong password', async () => {
    const { user } = await createTestUser('command_staff');

    const res = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: 'definitely-wrong' });

    expect(res.status).toBe(401);
  });

  test('unknown email is rejected', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@nowhere.test', password: 'anything' });

    expect(res.status).toBe(401);
  });

  test('deactivated accounts cannot log in', async () => {
    const { user, password } = await createTestUser('field_responder');
    const store = require('../lib/store');
    store.setUserActive(user.uid, false);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password });

    expect(res.status).toBe(403);
  });

  test('missing email or password is rejected', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'x@y.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/logout', () => {
  test('revokes the session so subsequent requests are unauthenticated', async () => {
    const { token } = await createTestUser('system_admin');

    const before = await request(app)
      .get('/admin/agencies')
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    await request(app).post('/auth/logout').set('Authorization', `Bearer ${token}`);

    const after = await request(app)
      .get('/admin/agencies')
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });
});
