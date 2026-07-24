'use strict';
const request = require('supertest');
const app = require('../app');
const { createTestUser } = require('./helpers');

async function createIncident(overrides = {}) {
  const res = await request(app)
    .post('/incidents')
    .send({ type: 'VICTIM_DETECTED', severity: 'CRITICAL', lat: 10.30, lng: 123.90, ...overrides });
  return res.body;
}

describe('PATCH /me/location', () => {
  test('a field responder can report their location', async () => {
    const { token } = await createTestUser('field_responder');

    const res = await request(app)
      .patch('/me/location')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: 10.31, lng: 123.89 });

    expect(res.status).toBe(200);
    expect(res.body.lastLat).toBe(10.31);
    expect(res.body.lastLng).toBe(123.89);
    expect(res.body.locationUpdatedAt).toBeTruthy();
    expect(res.body.passwordHash).toBeUndefined();
  });

  test('rejects non-numeric coordinates', async () => {
    const { token } = await createTestUser('field_responder');
    const res = await request(app)
      .patch('/me/location')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: 'north', lng: 123.89 });
    expect(res.status).toBe(400);
  });

  test('only field responders can report location', async () => {
    const { token } = await createTestUser('command_staff');
    const res = await request(app)
      .patch('/me/location')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: 10.31, lng: 123.89 });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /incidents/:id/verify', () => {
  test('only command_staff can verify an incident', async () => {
    const agencyId = `AGCY-verify-${Date.now()}`;
    const { token } = await createTestUser('field_responder', { agencyId });
    const incident = await createIncident();

    const res = await request(app)
      .patch(`/incidents/${incident.id}/verify`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('verifying with no located responders leaves the incident unassigned', async () => {
    const agencyId = `AGCY-verify-${Date.now()}`;
    const { token: commanderToken } = await createTestUser('command_staff', { agencyId });
    const incident = await createIncident();

    const res = await request(app)
      .patch(`/incidents/${incident.id}/verify`)
      .set('Authorization', `Bearer ${commanderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.incident.verified).toBe(true);
    expect(res.body.incident.verifiedBy).toBeTruthy();
    expect(res.body.mission).toBeNull();
    expect(res.body.dispatchedTo).toBeNull();
  });

  test('dispatches the nearest field responder by reported location', async () => {
    const agencyId = `AGCY-verify-${Date.now()}`;
    const { token: commanderToken } = await createTestUser('command_staff', { agencyId });
    const { token: farToken, user: farUser } = await createTestUser('field_responder', { agencyId });
    const { token: nearToken, user: nearUser } = await createTestUser('field_responder', { agencyId });

    // Incident at 10.30, 123.90
    const incident = await createIncident({ lat: 10.30, lng: 123.90 });

    // Far responder — several km away
    await request(app).patch('/me/location').set('Authorization', `Bearer ${farToken}`).send({ lat: 10.50, lng: 124.10 });
    // Near responder — right next to the incident
    await request(app).patch('/me/location').set('Authorization', `Bearer ${nearToken}`).send({ lat: 10.301, lng: 123.901 });

    const res = await request(app)
      .patch(`/incidents/${incident.id}/verify`)
      .set('Authorization', `Bearer ${commanderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.dispatchedTo.uid).toBe(nearUser.uid);
    expect(res.body.dispatchedTo.uid).not.toBe(farUser.uid);
    expect(res.body.mission).toBeTruthy();
    expect(res.body.mission.responderUserIds).toEqual([nearUser.uid]);
    expect(res.body.mission.teamId).toBeNull();
    expect(res.body.incident.status).toBe('ASSIGNED');
  });

  test('cannot verify the same incident twice', async () => {
    const agencyId = `AGCY-verify-${Date.now()}`;
    const { token: commanderToken } = await createTestUser('command_staff', { agencyId });
    const incident = await createIncident();

    await request(app).patch(`/incidents/${incident.id}/verify`).set('Authorization', `Bearer ${commanderToken}`);
    const second = await request(app).patch(`/incidents/${incident.id}/verify`).set('Authorization', `Bearer ${commanderToken}`);

    expect(second.status).toBe(400);
  });

  test('only searches for responders within the verifying command staff\'s own agency', async () => {
    const agencyA = `AGCY-verify-a-${Date.now()}`;
    const agencyB = `AGCY-verify-b-${Date.now()}`;
    const { token: commanderToken } = await createTestUser('command_staff', { agencyId: agencyA });
    const { token: otherAgencyToken } = await createTestUser('field_responder', { agencyId: agencyB });

    const incident = await createIncident({ lat: 10.30, lng: 123.90 });
    await request(app).patch('/me/location').set('Authorization', `Bearer ${otherAgencyToken}`).send({ lat: 10.300, lng: 123.900 });

    const res = await request(app)
      .patch(`/incidents/${incident.id}/verify`)
      .set('Authorization', `Bearer ${commanderToken}`);

    expect(res.body.dispatchedTo).toBeNull();
  });
});

describe('GET /incidents?verified=', () => {
  test('filters incidents by verification state', async () => {
    const agencyId = `AGCY-verify-${Date.now()}`;
    const { token: commanderToken } = await createTestUser('command_staff', { agencyId });
    const unverified = await createIncident();
    const toVerify = await createIncident();
    await request(app).patch(`/incidents/${toVerify.id}/verify`).set('Authorization', `Bearer ${commanderToken}`);

    const verifiedList = await request(app).get('/incidents?verified=true');
    expect(verifiedList.body.some((i) => i.id === toVerify.id)).toBe(true);
    expect(verifiedList.body.some((i) => i.id === unverified.id)).toBe(false);

    const unverifiedList = await request(app).get('/incidents?verified=false');
    expect(unverifiedList.body.some((i) => i.id === unverified.id)).toBe(true);
    expect(unverifiedList.body.some((i) => i.id === toVerify.id)).toBe(false);
  });
});
