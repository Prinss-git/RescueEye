'use strict';
const { Router } = require('express');
const store = require('../lib/store');

const router = Router();

const VALID_TYPES = ['SITUATION_REPORT', 'RESOURCE_REQUEST', 'UPDATE', 'ALERT'];

// GET /messages?incidentId=INC-xxx
router.get('/', (req, res) => {
  const { incidentId } = req.query;
  res.json(store.getMessages(incidentId || null));
});

// POST /messages
router.post('/', (req, res) => {
  const { incidentId, senderId, senderName, senderOrg, content, type } = req.body;
  if (!senderId || !senderName || !content) {
    return res.status(400).json({ error: 'senderId, senderName, and content are required' });
  }
  if (type && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const drill = store.getActiveDrill();
  const msg = store.addMessage({
    incidentId:  incidentId || null,
    senderId,
    senderName,
    senderOrg:   senderOrg || '',
    content,
    type:        type || 'UPDATE',
    isDrill:     !!drill,
  });
  store.incrementDrillCounter('messageCount');
  res.status(201).json(msg);
});

module.exports = router;
