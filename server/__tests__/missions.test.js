'use strict';
const request = require('supertest');
const app = require('../app');
const { createTestUser } = require('./helpers');

async function setupTeamWithResponders() {
  const agencyId = `AGCY-miss-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { token: agencyToken } = await createTestUser('agency_admin', { agencyId });
  const { user: sar } = await createTestUser('field_responder', { agencyId });
  const { user: ems } = await createTestUser('field_responder', { agencyId });
  const { user: commander } = await createTestUser('command_staff', { agencyId });

  const teamRes = await request(app)
    .post('/agency/teams')
    .set('Authorization', `Bearer ${agencyToken}`)
    .send({ name: 'Mission Test Team' });
  const teamId = teamRes.body.id;

  await request(app).post(`/agency/teams/${teamId}/members`).set('Authorization', `Bearer ${agencyToken}`).send({ userId: sar.uid });
  await request(app).post(`/agency/teams/${teamId}/members`).set('Authorization', `Bearer ${agencyToken}`).send({ userId: ems.uid });

  return { teamId, sar, ems, commander };
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
    const { teamId, commander } = await setupTeamWithResponders();
    const incident = await createIncident();

    const first = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });
    const second = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });

    expect(second.body.mission.id).toBe(first.body.mission.id);

    const list = await request(app).get(`/missions?incidentId=${incident.id}`);
    expect(list.body.length).toBe(1);
  });

  test('assigning again after the prior mission completes creates a new one', async () => {
    const { teamId, commander } = await setupTeamWithResponders();
    const incident = await createIncident();

    const first = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });
    await request(app).patch(`/missions/${first.body.mission.id}/status`).send({ status: 'COMPLETED' });

    const second = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });
    expect(second.body.mission.id).not.toBe(first.body.mission.id);

    const list = await request(app).get(`/missions?incidentId=${incident.id}`);
    expect(list.body.length).toBe(2);
  });
});

describe('Mission state machine', () => {
  test('happy path: ASSIGNED → ACCEPTED → EN_ROUTE → ON_SITE → TREATING → COMPLETED', async () => {
    const { teamId, commander } = await setupTeamWithResponders();
    const incident = await createIncident();
    const dispatch = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });
    const missionId = dispatch.body.mission.id;

    const accepted = await request(app).patch(`/missions/${missionId}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('ACCEPTED');
    expect(accepted.body.acceptedAt).toBeTruthy();

    const enRoute = await request(app).patch(`/missions/${missionId}/status`).send({ status: 'EN_ROUTE' });
    expect(enRoute.body.status).toBe('EN_ROUTE');

    const onSite = await request(app).patch(`/missions/${missionId}/status`).send({ status: 'ON_SITE' });
    expect(onSite.body.status).toBe('ON_SITE');

    const treating = await request(app).patch(`/missions/${missionId}/status`).send({ status: 'TREATING', medicalRequired: true });
    expect(treating.body.status).toBe('TREATING');
    expect(treating.body.medicalRequired).toBe(true);

    const completed = await request(app).patch(`/missions/${missionId}/status`).send({ status: 'COMPLETED' });
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.completedAt).toBeTruthy();
  });

  test('decline sets status to DECLINED', async () => {
    const { teamId, commander } = await setupTeamWithResponders();
    const incident = await createIncident();
    const dispatch = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });

    const res = await request(app).patch(`/missions/${dispatch.body.mission.id}/decline`);
    expect(res.body.status).toBe('DECLINED');
  });

  test('rejects an invalid status value', async () => {
    const { teamId, commander } = await setupTeamWithResponders();
    const incident = await createIncident();
    const dispatch = await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });

    const res = await request(app).patch(`/missions/${dispatch.body.mission.id}/status`).send({ status: 'NOT_A_REAL_STATUS' });
    expect(res.status).toBe(400);
  });

  test('GET /missions?userId= returns missions where the user is a responder', async () => {
    const { teamId, sar, commander } = await setupTeamWithResponders();
    const incident = await createIncident();
    await request(app).patch(`/teams/${teamId}/assign`).send({ incidentId: incident.id, assignedBy: commander.uid });

    const res = await request(app).get(`/missions?userId=${sar.uid}`);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every(m => m.responderUserIds.includes(sar.uid))).toBe(true);
  });
});
