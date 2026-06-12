'use strict';
const { Router } = require('express');
const store = require('../lib/store');
const path = require('path');
const fs = require('fs');

const router = Router();

// GET /evaluation/report/:sessionId
// Returns the drill evaluation report. If sessionId is "latest", returns
// the most recently completed session or the AI model evaluation report.
router.get('/report/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  // Try to build a drill-based report from store state
  const drill = store.getDrillStatus(sessionId);
  if (drill) {
    return res.json(_buildDrillReport(drill));
  }

  // Fallback: try reading the AI model evaluation report from disk
  const reportPath = path.join(__dirname, '../../api/models/evaluation_report.json');
  if (fs.existsSync(reportPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      return res.json({ type: 'model_evaluation', sessionId, ...raw });
    } catch {
      // ignore parse errors
    }
  }

  // Return empty report skeleton so the frontend always gets valid JSON
  return res.json(_emptyReport(sessionId));
});

// GET /evaluation/report/latest
router.get('/report', (_req, res) => {
  const reportPath = path.join(__dirname, '../../api/models/evaluation_report.json');
  if (fs.existsSync(reportPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      return res.json({ type: 'model_evaluation', ...raw });
    } catch {
      // ignore
    }
  }
  res.json(_emptyReport('latest'));
});

function _buildDrillReport(drill) {
  const durationMs = drill.stoppedAt
    ? new Date(drill.stoppedAt) - new Date(drill.startedAt)
    : Date.now() - new Date(drill.startedAt);
  return {
    type:           'drill_session',
    sessionId:      drill.id,
    startedAt:      drill.startedAt,
    stoppedAt:      drill.stoppedAt,
    durationMs,
    active:         drill.active,
    metrics: {
      incidentCount:  drill.incidentCount,
      messageCount:   drill.messageCount,
      teamActions:    drill.teamActions,
      detectionCount: drill.detectionCount,
      avgResponseMs:  drill.avgResponseMs,
    },
  };
}

function _emptyReport(sessionId) {
  return {
    type:      'empty',
    sessionId,
    message:   'No report data available. Run a drill or train the AI models first.',
    metrics:   {},
  };
}

module.exports = router;
