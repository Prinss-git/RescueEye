/**
 * Express app construction — no `.listen()`, no Firebase/hydration logic.
 * Kept separate from index.js so tests can `require('./app')` and drive it
 * with Supertest without binding a real port or touching Firestore.
 */
'use strict';
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const store          = require('./lib/store');
const authRoutes     = require('./routes/auth');
const teamsRoutes    = require('./routes/teams');
const messagesRoutes = require('./routes/messages');
const incidentsRoutes = require('./routes/incidents');
const drillRoutes    = require('./routes/drill');
const evalRoutes     = require('./routes/evaluation');
const adminRoutes    = require('./routes/admin');
const agencyRoutes   = require('./routes/agency');
const missionsRoutes = require('./routes/missions');

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Route handlers read this via req.app.get('firebaseAdmin'); defaults to
// null (in-memory-only mode) until index.js overrides it after Firebase init.
app.set('firebaseAdmin', null);

app.get('/health', (_req, res) => {
  res.json({
    status:      'ok',
    service:     'rescueeye-server',
    version:     '0.4.0',
    phase:       '4-coordination',
    firebase:    !!app.get('firebaseAdmin'),
    drillActive: !!store.getActiveDrill(),
  });
});

app.use('/auth',       authRoutes);
app.use('/teams',      teamsRoutes);
app.use('/messages',   messagesRoutes);
app.use('/incidents',  incidentsRoutes);
app.use('/drill',      drillRoutes);
app.use('/evaluation', evalRoutes);
app.use('/admin',      adminRoutes);
app.use('/agency',     agencyRoutes);
app.use('/missions',   missionsRoutes);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
