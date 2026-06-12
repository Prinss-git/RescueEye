require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const store         = require('./lib/store');
const authRoutes    = require('./routes/auth');
const teamsRoutes   = require('./routes/teams');
const messagesRoutes = require('./routes/messages');
const incidentsRoutes = require('./routes/incidents');
const drillRoutes   = require('./routes/drill');
const evalRoutes    = require('./routes/evaluation');

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

// ── Express app ───────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Make firebaseAdmin accessible in route handlers via req.app.get()
app.set('firebaseAdmin', firebaseAdmin);

app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'rescueeye-server',
    version:   '0.4.0',
    phase:     '4-coordination',
    firebase:  !!firebaseAdmin,
    drillActive: !!store.getActiveDrill(),
  });
});

app.use('/auth',       authRoutes);
app.use('/teams',      teamsRoutes);
app.use('/messages',   messagesRoutes);
app.use('/incidents',  incidentsRoutes);
app.use('/drill',      drillRoutes);
app.use('/evaluation', evalRoutes);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[server] RescueEye server v0.4.0 running on http://localhost:${PORT}`);
});
