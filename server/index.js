require('dotenv').config();
const app   = require('./app');
const store = require('./lib/store');
const { hashPassword } = require('./lib/authz');

// ── Firebase Admin SDK ────────────────────────────────────────────────────────
let firebaseAdmin = null;
const admin    = require('firebase-admin');
const credPath = process.env.FIREBASE_CREDENTIAL_PATH;
if (credPath) {
  try {
    const serviceAccount = require(credPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseAdmin = admin;
    // Wire Firestore into the store for real-time sync
    store.setDb(admin.firestore());
    console.log('[firebase] Admin SDK initialized — Firestore sync active');
  } catch (err) {
    console.warn('[firebase] Could not load credentials — running in-memory only:', err.message);
  }
} else {
  console.warn('[firebase] FIREBASE_CREDENTIAL_PATH not set — in-memory mode');
}

app.set('firebaseAdmin', firebaseAdmin);

const PORT = process.env.PORT || 3001;

// ── Startup sequence ──────────────────────────────────────────────────────────
// Hydration must complete (or gracefully fail) before the bootstrap System
// Admin check and before the server accepts traffic — otherwise a restart
// would recreate a brand-new System Admin every time, orphaning any agencies
// whose createdBy pointed at the previous one.
async function start() {
  const result = await store.hydrate();
  if (result.skipped) {
    console.log('[store] Hydration skipped — running in-memory only');
  } else {
    console.log(
      `[store] Hydrated from Firestore — teams:${result.teams} incidents:${result.incidents} ` +
      `messages:${result.messages} agencies:${result.agencies} users:${result.users}`
    );
  }

  // Seed the first System Admin account — otherwise nobody could ever create
  // one through the app (System Admins are the ones who create Agency Admins).
  const email = 'sysadmin@rescueeye.ph';
  if (!store.getUserByEmail(email)) {
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'admin12345';
    store.createUser({
      email,
      displayName:  'RescueEye System Admin',
      role:         'system_admin',
      organization: 'RescueEye',
      agencyId:     null,
      passwordHash: await hashPassword(password),
    });
    console.log(`[bootstrap] System Admin created — ${email} / (see BOOTSTRAP_ADMIN_PASSWORD)`);
  } else {
    console.log(`[bootstrap] System Admin already present — ${email}`);
  }

  // Seed one demo agency + one demo account per remaining role, so the app
  // is fully explorable out of the box without going through the admin UI.
  let demoAgency = store.getAgencies().find((a) => a.name === 'CDRRMO Cebu Demo');
  if (!demoAgency) {
    demoAgency = store.createAgency({
      name:               'CDRRMO Cebu Demo',
      subscriptionStatus: 'ACTIVE',
      createdBy:          'bootstrap',
    });
  }

  const demoAccounts = [
    { email: 'agencyadmin@rescueeye.ph', displayName: 'Demo Agency Admin', role: 'agency_admin',   agencyId: demoAgency.id },
    { email: 'commander@rescueeye.ph',   displayName: 'Cdr. Reyes',        role: 'command_staff',  agencyId: demoAgency.id },
    { email: 'responder@rescueeye.ph',   displayName: 'Field Responder',   role: 'field_responder', agencyId: demoAgency.id },
  ];
  for (const acc of demoAccounts) {
    if (store.getUserByEmail(acc.email)) {
      console.log(`[bootstrap] Demo account already present — ${acc.email}`);
      continue;
    }
    store.createUser({
      email:        acc.email,
      displayName:  acc.displayName,
      role:         acc.role,
      organization: demoAgency.name,
      agencyId:     acc.agencyId,
      passwordHash: await hashPassword('password123'),
    });
    console.log(`[bootstrap] Demo account created — ${acc.email} (${acc.role})`);
  }

  app.listen(PORT, () => {
    console.log(`[server] RescueEye server v0.4.0 running on http://localhost:${PORT}`);
  });
}

start();
