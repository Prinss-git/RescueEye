'use strict';
const request = require('supertest');
const app = require('../app');
const { createTestUser } = require('./helpers');

async function setupTeamWithResponders() {
  const agencyId = `AGCY-miss-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { token: agencyToken } = await createTestUser('agency_admin', { agencyId });
  const { user: sar, token: sarToken } = await createTestUser('field_responder', { agencyId });
  const { user: ems, token: emsToken } = await createTestUser('field_responder', { agencyId });
  const { user: commander, token: commanderToken } = await createTestUser('command_staff', { agencyId });

  const teamRes = await request(app)
    .post('/agency/teams')
    .set('Authorization', `Bearer ${agencyToken}`)
    .send({ name: 'Mission Test Team' });
  const teamId = teamRes.body.id;

  await request(app).post(`/agency/teams/${teamId}/members`).set('Authorization', `Bearer ${agencyToken}`).send({ userId: sar.uid });
  await request(app).post(`/agency/teams/${teamId}/members`).set('Authorization', `Bearer ${agencyToken}`).send({ userId: ems.uid });

  return { agencyId, teamId, sar, sarToken, ems, emsToken, commander, commanderToken };
}

async function createIncident(overrides = {}) {
  const res = await request(app)
    .post('/incidents')
    .send({ type: 'VICTIM_DETECTED', severity: 'CRITICAL', lat: 10.3, lng: 123.9, ...overrides });
  return res.body;
}

describe('PATCH /teams/:id/assign — mission creation', () => {
  test('creates a Mission snapshotting the team roster', async () => {
    const { teamId, sar, ems, commander } = await setupTeamWithResponders();
    const incident = await createIncident();

    const res = await request(app)
      .patch(`/teams/${teamId}/assign`)
      .send({ incidentId: incident.id, assignedBy: commander.uid });

    expect(res.status).toBe(200);
    expect(res.body.mission).toBeTruthy();
    expect(res.body.mission.status).toBe('ASSIGNED');
    expect(res.body.mission.assignedBy).toBe(commander.uid);
    expect(res.body.mission.responderUserIds).toEqual(expect.arrayContaining([sar.uid, ems.uid]));
  });

  test('re-assigning the same team+incident while active reuses the mission (no duplicate)', async () => {
    const { teamId, commander, commanderToken } = await setupTeamWithResponders();
    const incident = await createIncident();

    const first = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });
    const second = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });

    expect(second.body.mission.id).toBe(first.body.mission.id);

    const list = await request(app).get(`/missions?incidentId=${incident.id}`)
      .set('Authorization', `Bearer ${commanderToken}`);
    expect(list.body.length).toBe(1);
  });

  test('assigning again after the prior mission completes creates a new one', async () => {
    const { teamId, commander, commanderToken, sarToken } = await setupTeamWithResponders();
    const incident = await createIncident();

    const first = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });
    await request(app).patch(`/missions/${first.body.mission.id}/status`)
      .set('Authorization', `Bearer ${sarToken}`).send({ status: 'COMPLETED' });

    const second = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });
    expect(second.body.mission.id).not.toBe(first.body.mission.id);

    const list = await request(app).get(`/missions?incidentId=${incident.id}`)
      .set('Authorization', `Bearer ${commanderToken}`);
    expect(list.body.length).toBe(2);
  });
});

describe('Mission state machine', () => {
  test('happy path: ASSIGNED → ACCEPTED → EN_ROUTE → ON_SITE → TREATING → COMPLETED', async () => {
    const { teamId, commander, sarToken } = await setupTeamWithResponders();
    const incident = await createIncident();
    const dispatch = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });
    const missionId = dispatch.body.mission.id;
    const as = (req) => req.set('Authorization', `Bearer ${sarToken}`);

    const accepted = await as(request(app).patch(`/missions/${missionId}/accept`));
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('ACCEPTED');
    expect(accepted.body.acceptedAt).toBeTruthy();

    const enRoute = await as(request(app).patch(`/missions/${missionId}/status`)).send({ status: 'EN_ROUTE' });
    expect(enRoute.body.status).toBe('EN_ROUTE');

    const onSite = await as(request(app).patch(`/missions/${missionId}/status`)).send({ status: 'ON_SITE' });
    expect(onSite.body.status).toBe('ON_SITE');

    const treating = await as(request(app).patch(`/missions/${missionId}/status`)).send({ status: 'TREATING', medicalRequired: true });
    expect(treating.body.status).toBe('TREATING');
    expect(treating.body.medicalRequired).toBe(true);

    const completed = await as(request(app).patch(`/missions/${missionId}/status`)).send({ status: 'COMPLETED' });
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.completedAt).toBeTruthy();
  });

  test('decline sets status to DECLINED', async () => {
    const { teamId, commander, sarToken } = await setupTeamWithResponders();
    const incident = await createIncident();
    const dispatch = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });

    const res = await request(app).patch(`/missions/${dispatch.body.mission.id}/decline`)
      .set('Authorization', `Bearer ${sarToken}`);
    expect(res.body.status).toBe('DECLINED');
  });

  test('rejects an invalid status value', async () => {
    const { teamId, commander, sarToken } = await setupTeamWithResponders();
    const incident = await createIncident();
    const dispatch = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });

    const res = await request(app).patch(`/missions/${dispatch.body.mission.id}/status`)
      .set('Authorization', `Bearer ${sarToken}`).send({ status: 'NOT_A_REAL_STATUS' });
    expect(res.status).toBe(400);
  });

  test('GET /missions returns the authenticated responder\'s own missions', async () => {
    const { teamId, sar, sarToken, commander } = await setupTeamWithResponders();
    const incident = await createIncident();
    await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });

    const res = await request(app).get('/missions').set('Authorization', `Bearer ${sarToken}`);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every(m => m.responderUserIds.includes(sar.uid))).toBe(true);
  });
});

// The mission routes were previously wide open: identity came from a userId
// query param and the write endpoints had no auth at all.
describe('Mission authorization', () => {
  test('rejects unauthenticated reads and writes', async () => {
    const { teamId, commander } = await setupTeamWithResponders();
    const incident = await createIncident();
    const dispatch = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });
    const missionId = dispatch.body.mission.id;

    expect((await request(app).get('/missions')).status).toBe(401);
    expect((await request(app).get(`/missions/${missionId}`)).status).toBe(401);
    expect((await request(app).patch(`/missions/${missionId}/accept`)).status).toBe(401);
    expect((await request(app).patch(`/missions/${missionId}/decline`)).status).toBe(401);
    expect((await request(app).patch(`/missions/${missionId}/status`).send({ status: 'COMPLETED' })).status).toBe(401);
  });

  test('a responder cannot read another responder\'s missions via the userId param', async () => {
    const { teamId, sar, commander } = await setupTeamWithResponders();
    // An unrelated responder in a different agency.
    const { token: outsiderToken } = await createTestUser('field_responder', { agencyId: 'AGCY-outsider' });

    const incident = await createIncident();
    await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });

    const res = await request(app).get(`/missions?userId=${sar.uid}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  test('a responder cannot update a mission they were not dispatched to', async () => {
    const { teamId, commander } = await setupTeamWithResponders();
    const { token: outsiderToken } = await createTestUser('field_responder', { agencyId: 'AGCY-outsider-2' });

    const incident = await createIncident();
    const dispatch = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });
    const missionId = dispatch.body.mission.id;

    const res = await request(app).patch(`/missions/${missionId}/status`)
      .set('Authorization', `Bearer ${outsiderToken}`).send({ status: 'COMPLETED' });
    expect(res.status).toBe(404);

    // And the mission is genuinely untouched.
    const check = await request(app).get(`/missions/${missionId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(check.status).toBe(404);
  });

  test('command staff can read their own agency\'s missions but not another agency\'s', async () => {
    const { teamId, commander, commanderToken } = await setupTeamWithResponders();
    const { token: otherCommanderToken } = await createTestUser('command_staff', { agencyId: 'AGCY-other-cmd' });

    const incident = await createIncident();
    const dispatch = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });
    const missionId = dispatch.body.mission.id;

    expect((await request(app).get(`/missions/${missionId}`)
      .set('Authorization', `Bearer ${commanderToken}`)).status).toBe(200);

    expect((await request(app).get(`/missions/${missionId}`)
      .set('Authorization', `Bearer ${otherCommanderToken}`)).status).toBe(404);
  });

  test('command staff cannot write a responder\'s mission status', async () => {
    const { teamId, commander, commanderToken } = await setupTeamWithResponders();
    const incident = await createIncident();
    const dispatch = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });

    const res = await request(app).patch(`/missions/${dispatch.body.mission.id}/status`)
      .set('Authorization', `Bearer ${commanderToken}`).send({ status: 'COMPLETED' });
    expect(res.status).toBe(403);
  });
});

describe('GET /agency/missions — mission history', () => {
  test('returns only the caller\'s own agency missions, enriched with team/incident context', async () => {
    const agencyId = `AGCY-mh-${Date.now()}`;
    const { token: agencyToken } = await createTestUser('agency_admin', { agencyId });
    const { user: sar } = await createTestUser('field_responder', { agencyId });
    const { user: commander } = await createTestUser('command_staff', { agencyId });

    const teamRes = await request(app)
      .post('/agency/teams')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ name: 'History Team' });
    await request(app).post(`/agency/teams/${teamRes.body.id}/members`)
      .set('Authorization', `Bearer ${agencyToken}`).send({ userId: sar.uid });

    const incident = await createIncident({ type: 'FIRE', severity: 'HIGH' });
    await request(app).patch(`/teams/${teamRes.body.id}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });

    const res = await request(app).get('/agency/missions').set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].teamName).toBe('History Team');
    expect(res.body[0].incidentType).toBe('FIRE');
    expect(res.body[0].agencyId).toBe(agencyId);
  });

  test('does not include another agency\'s missions', async () => {
    const agencyA = `AGCY-mh-a-${Date.now()}`;
    const agencyB = `AGCY-mh-b-${Date.now()}`;
    const { token: tokenA } = await createTestUser('agency_admin', { agencyId: agencyA });
    const { token: tokenB } = await createTestUser('agency_admin', { agencyId: agencyB });
    const { user: commanderB } = await createTestUser('command_staff', { agencyId: agencyB });

    const teamB = await request(app)
      .post('/agency/teams')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Agency B Team' });
    const incident = await createIncident();
    await request(app).patch(`/teams/${teamB.body.id}/assign`).send({ incidentId: incident.id, assignedBy: commanderB.uid });

    const res = await request(app).get('/agency/missions').set('Authorization', `Bearer ${tokenA}`);
    expect(res.body.every(m => m.agencyId === agencyA)).toBe(true);
  });
});

