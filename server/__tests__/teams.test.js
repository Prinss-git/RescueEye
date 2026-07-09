'use strict';
const request = require('supertest');
const app = require('../app');
const { createTestUser } = require('./helpers');

describe('POST /agency/teams + roster management', () => {
  test('creates a team and adds two field responders to its roster', async () => {
    const agencyId = `AGCY-team-${Date.now()}`;
    const { token } = await createTestUser('agency_admin', { agencyId });
    const { user: sar } = await createTestUser('field_responder', { agencyId });
    const { user: ems } = await createTestUser('field_responder', { agencyId });

    const teamRes = await request(app)
      .post('/agency/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Team' });
    expect(teamRes.status).toBe(201);
    const teamId = teamRes.body.id;

    const add1 = await request(app)
      .post(`/agency/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: sar.uid });
    expect(add1.status).toBe(200);
    expect(add1.body.memberUserIds).toContain(sar.uid);

    const add2 = await request(app)
      .post(`/agency/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: ems.uid });
    expect(add2.status).toBe(200);
    expect(add2.body.memberUserIds).toEqual(expect.arrayContaining([sar.uid, ems.uid]));
    expect(add2.body.members).toEqual(expect.arrayContaining([sar.displayName, ems.displayName]));
  });

  test('rejects adding a Command Staff account to a team roster', async () => {
    const agencyId = `AGCY-team-${Date.now()}`;
    const { token } = await createTestUser('agency_admin', { agencyId });
    const { user: commander } = await createTestUser('command_staff', { agencyId });

    const teamRes = await request(app)
      .post('/agency/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Team 2' });
    const teamId = teamRes.body.id;

    const res = await request(app)
      .post(`/agency/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: commander.uid });

    expect(res.status).toBe(400);
  });

  test('cannot modify a team belonging to another agency', async () => {
    const agencyA = `AGCY-a-${Date.now()}`;
    const agencyB = `AGCY-b-${Date.now()}`;
    const { token: tokenA } = await createTestUser('agency_admin', { agencyId: agencyA });
    const { token: tokenB } = await createTestUser('agency_admin', { agencyId: agencyB });
    const { user: responderB } = await createTestUser('field_responder', { agencyId: agencyB });

    const teamB = await request(app)
      .post('/agency/teams')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Bravo Agency Team' });

    const res = await request(app)
      .post(`/agency/teams/${teamB.body.id}/members`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ userId: responderB.uid });

    expect(res.status).toBe(404);
  });

  test('GET /agency/teams only returns the caller\'s own agency teams', async () => {
    const agencyA = `AGCY-list-a-${Date.now()}`;
    const agencyB = `AGCY-list-b-${Date.now()}`;
    const { token: tokenA } = await createTestUser('agency_admin', { agencyId: agencyA });
    const { token: tokenB } = await createTestUser('agency_admin', { agencyId: agencyB });

    await request(app).post('/agency/teams').set('Authorization', `Bearer ${tokenA}`).send({ name: 'A Team' });
    await request(app).post('/agency/teams').set('Authorization', `Bearer ${tokenB}`).send({ name: 'B Team' });

    const listA = await request(app).get('/agency/teams').set('Authorization', `Bearer ${tokenA}`);
    expect(listA.body.every(t => t.agencyId === agencyA)).toBe(true);
    expect(listA.body.some(t => t.name === 'B Team')).toBe(false);
  });
});
