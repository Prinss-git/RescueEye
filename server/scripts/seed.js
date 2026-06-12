/**
 * Seed script — populates in-memory store with demo data.
 * Run:  node server/scripts/seed.js
 * With Firestore:  FIREBASE_CREDENTIAL_PATH=/path/to/creds.json node server/scripts/seed.js
 */
'use strict';

const store = require('../lib/store');

// ── Seed incidents ─────────────────────────────────────────────────────────────
const SEED_INCIDENTS = [
  { type: 'VICTIM_DETECTED', severity: 'CRITICAL', lat: 10.3157, lng: 123.8854, description: 'Multiple victims trapped in collapsed structure near Mabolo.', reportedBy: 'AI_SYSTEM' },
  { type: 'FLOOD',           severity: 'HIGH',     lat: 10.3220, lng: 123.8972, description: 'Rising floodwaters reported in Talamban barangay.', reportedBy: 'coordinator-001' },
  { type: 'FIRE',            severity: 'CRITICAL', lat: 10.3089, lng: 123.9012, description: 'Structure fire in Lahug market area.', reportedBy: 'coordinator-001' },
  { type: 'STRUCTURAL',      severity: 'MEDIUM',   lat: 10.3301, lng: 123.8801, description: 'Bridge damage on N. Escario St. — assessment needed.', reportedBy: 'drone-op-001' },
  { type: 'VICTIM_DETECTED', severity: 'HIGH',     lat: 10.2998, lng: 123.8930, description: 'Survivor signal detected near Pardo flooded area.', reportedBy: 'AI_SYSTEM' },
  { type: 'FLOOD',           severity: 'LOW',      lat: 10.3410, lng: 123.9100, description: 'Minor flooding in Mandaue border zone.', reportedBy: 'coordinator-001' },
];

// ── Seed messages ──────────────────────────────────────────────────────────────
const SEED_MESSAGES = [
  { senderId: 'demo-commander', senderName: 'Cdr. Reyes',    senderOrg: 'CDRRMO Cebu', content: 'Alpha team ETA to INC-001 is 8 minutes. Stand by.', type: 'SITUATION_REPORT' },
  { senderId: 'demo-operator',  senderName: 'Tech. Santos',  senderOrg: 'CDRRMO Cebu', content: 'Drone feed active. Confirming 3 victims on roof, structure unstable.', type: 'UPDATE' },
  { senderId: 'demo-coord',     senderName: 'Coord. Cruz',   senderOrg: 'BFP Cebu',    content: 'Requesting additional water pumps for Talamban site.', type: 'RESOURCE_REQUEST' },
  { senderId: 'demo-commander', senderName: 'Cdr. Reyes',    senderOrg: 'CDRRMO Cebu', content: 'ALERT: Lahug fire spreading east. All units redirect.', type: 'ALERT' },
  { senderId: 'demo-coord',     senderName: 'Coord. Cruz',   senderOrg: 'BFP Cebu',    content: 'Bravo Medical on site at Mabolo. Two casualties, stable condition.', type: 'SITUATION_REPORT' },
  { senderId: 'demo-operator',  senderName: 'Tech. Santos',  senderOrg: 'CDRRMO Cebu', content: 'Drone battery at 40%. Returning for swap. Coverage gap ~12 min.', type: 'UPDATE' },
  { senderId: 'demo-commander', senderName: 'Cdr. Reyes',    senderOrg: 'CDRRMO Cebu', content: 'N. Escario bridge cleared for emergency vehicles only.', type: 'UPDATE' },
  { senderId: 'demo-coord',     senderName: 'Nurse Dela Rosa', senderOrg: 'DOH Cebu',  content: 'Field hospital established at Mabolo gym. Capacity: 50 beds.', type: 'SITUATION_REPORT' },
  { senderId: 'demo-operator',  senderName: 'Tech. Santos',  senderOrg: 'CDRRMO Cebu', content: 'Pardo area covered. New victim signature at grid 10.300 / 123.893.', type: 'UPDATE' },
  { senderId: 'demo-commander', senderName: 'Cdr. Reyes',    senderOrg: 'CDRRMO Cebu', content: 'All teams: sitrep at 13:00. Mandatory check-in.', type: 'ALERT' },
];

function seed() {
  console.log('[seed] Creating 6 incidents ...');
  const createdIncidents = SEED_INCIDENTS.map(inc => store.createIncident(inc));
  createdIncidents.forEach(i => console.log(`  ✓ ${i.id}  ${i.type}  (${i.severity})`));

  console.log('\n[seed] Assigning teams to first 2 incidents ...');
  store.assignTeam('T001', createdIncidents[0].id);
  console.log(`  ✓ T001 (Alpha) → ${createdIncidents[0].id}`);
  store.assignTeam('T002', createdIncidents[1].id);
  console.log(`  ✓ T002 (Bravo) → ${createdIncidents[1].id}`);

  console.log('\n[seed] Adding 10 messages ...');
  SEED_MESSAGES.forEach((msg, i) => {
    const m = store.addMessage({ ...msg, incidentId: createdIncidents[i % createdIncidents.length].id });
    console.log(`  ✓ ${m.id}  [${m.type}]  "${m.content.slice(0, 50)}..."`);
  });

  console.log('\n[seed] Done. Store now contains:');
  console.log(`  Teams:     ${store.getTeams().length}`);
  console.log(`  Incidents: ${store.getIncidents().length}`);
  console.log(`  Messages:  ${store.getMessages().length}`);
}

seed();
