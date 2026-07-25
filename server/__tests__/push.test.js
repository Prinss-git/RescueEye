'use strict';
const request = require('supertest');
const app = require('../app');
const store = require('../lib/store');
const { isExpoPushToken } = require('../lib/push');
const { createTestUser } = require('./helpers');

const VALID_TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

describe('isExpoPushToken', () => {
  test('accepts Expo token formats', () => {
    expect(isExpoPushToken(VALID_TOKEN)).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc]')).toBe(true);
  });

  test('rejects raw device tokens and junk', () => {
    // A raw FCM token would need the Firebase path, not Expo's push service.
    expect(isExpoPushToken('fGc9x:APA91bHun...')).toBe(false);
    expect(isExpoPushToken('')).toBe(false);
    expect(isExpoPushToken(null)).toBe(false);
    expect(isExpoPushToken(undefined)).toBe(false);
    expect(isExpoPushToken(12345)).toBe(false);
  });
});

describe('PATCH /me/push-token', () => {
  test('requires authentication', async () => {
    const res = await request(app).patch('/me/push-token').send({ token: VALID_TOKEN });
    expect(res.status).toBe(401);
  });

  test('stores the token against the authenticated user', async () => {
    const { user, token } = await createTestUser('field_responder', { agencyId: 'AGCY-push' });

    const res = await request(app).patch('/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: VALID_TOKEN, platform: 'android' });

    expect(res.status).toBe(200);
    expect(store.getUserById(user.uid).pushToken).toBe(VALID_TOKEN);
    expect(store.getUserById(user.uid).pushPlatform).toBe('android');
  });

  test('never echoes the token or password hash back', async () => {
    const { token } = await createTestUser('field_responder', { agencyId: 'AGCY-push' });

    const res = await request(app).patch('/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: VALID_TOKEN, platform: 'ios' });

    expect(res.body.pushToken).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.pushRegistered).toBe(true);
  });

  test('rejects a malformed token rather than storing something undeliverable', async () => {
    const { user, token } = await createTestUser('field_responder', { agencyId: 'AGCY-push' });

    const res = await request(app).patch('/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'not-a-real-token', platform: 'android' });

    expect(res.status).toBe(400);
    expect(store.getUserById(user.uid).pushToken).toBeFalsy();
  });

  test('binds to the session user, ignoring any uid in the body', async () => {
    const { user: victim } = await createTestUser('field_responder', { agencyId: 'AGCY-push' });
    const { user: attacker, token: attackerToken } = await createTestUser('field_responder', { agencyId: 'AGCY-push' });

    await request(app).patch('/me/push-token')
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ token: VALID_TOKEN, platform: 'android', uid: victim.uid });

    // The attacker's own record was updated; the victim's was not hijacked.
    expect(store.getUserById(attacker.uid).pushToken).toBe(VALID_TOKEN);
    expect(store.getUserById(victim.uid).pushToken).toBeFalsy();
  });
});

describe('DELETE /me/push-token', () => {
  test('clears the token so a shared device stops receiving old dispatches', async () => {
    const { user, token } = await createTestUser('field_responder', { agencyId: 'AGCY-push' });

    await request(app).patch('/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: VALID_TOKEN, platform: 'android' });
    expect(store.getUserById(user.uid).pushToken).toBe(VALID_TOKEN);

    const res = await request(app).delete('/me/push-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pushRegistered).toBe(false);
    expect(store.getUserById(user.uid).pushToken).toBeNull();
  });

  test('requires authentication', async () => {
    const res = await request(app).delete('/me/push-token');
    expect(res.status).toBe(401);
  });
});
