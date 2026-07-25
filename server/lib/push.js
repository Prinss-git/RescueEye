/**
 * Expo push delivery.
 *
 * The mobile app registers an Expo push token (see PATCH /me/push-token) and
 * we POST to Expo's push service when a mission is dispatched. This is what
 * makes dispatch actually reach a responder whose phone is in their pocket —
 * the app's foreground polling loop can't do that.
 *
 * Delivery is best-effort and never blocks or fails the request that triggered
 * it: a responder not receiving a push is bad, but a verify call rolling back
 * because Expo's API was slow is worse.
 */
'use strict';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const SEND_TIMEOUT_MS = 8000;

// Expo rejects anything that isn't one of its own token formats. Device (raw
// FCM/APNs) tokens would need the Firebase/APNs path instead, so screen them
// out here rather than sending a request we know will 400.
function isExpoPushToken(token) {
  return typeof token === 'string' &&
    (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

/**
 * @param {Array<{to: string, title: string, body: string, data?: object}>} messages
 * @returns {Promise<{sent: number, skipped: number, errors: string[]}>}
 */
async function sendExpoPush(messages) {
  const valid = (messages || []).filter(m => m && isExpoPushToken(m.to));
  const skipped = (messages || []).length - valid.length;

  if (valid.length === 0) {
    return { sent: 0, skipped, errors: [] };
  }

  const payload = valid.map(m => ({
    to:       m.to,
    title:    m.title,
    body:     m.body,
    data:     m.data || {},
    sound:    'default',
    priority: 'high',
    // Must match the channel the app creates before requesting a token,
    // otherwise Android silently drops it into the default channel.
    channelId: 'dispatch',
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn(`[push] Expo push service returned ${res.status}: ${detail.slice(0, 200)}`);
      return { sent: 0, skipped, errors: [`HTTP ${res.status}`] };
    }

    const body = await res.json();
    const tickets = Array.isArray(body.data) ? body.data : [];
    const errors = tickets
      .filter(t => t.status === 'error')
      .map(t => t.details?.error || t.message || 'unknown');

    if (errors.length > 0) {
      console.warn(`[push] ${errors.length}/${tickets.length} tickets errored: ${errors.join(', ')}`);
    }

    return { sent: tickets.length - errors.length, skipped, errors };
  } catch (err) {
    console.warn('[push] Delivery failed:', err.message);
    return { sent: 0, skipped, errors: [err.message] };
  }
}

/**
 * Builds and sends the "you've been dispatched" push for a mission.
 * Resolves the responder's stored token via the store to keep callers from
 * having to know about user records.
 *
 * @param {object} store    the store module (passed in to avoid a require cycle)
 * @param {object} mission  the mission that was just created
 * @param {object} incident the incident it was created for
 */
async function notifyMissionDispatched(store, mission, incident) {
  const uids = mission?.responderUserIds || [];
  if (uids.length === 0) return { sent: 0, skipped: 0, errors: [] };

  const messages = uids
    .map((uid) => {
      const user = store.getUserById(uid);
      if (!user?.pushToken) return null;
      return {
        to:    user.pushToken,
        title: `${incident?.severity || 'NEW'} — you have been dispatched`,
        body:  incident?.description
          ? incident.description
          : `A ${String(incident?.type || 'incident').replace(/_/g, ' ').toLowerCase()} needs your response.`,
        data:  { missionId: mission.id, incidentId: mission.incidentId },
      };
    })
    .filter(Boolean);

  return sendExpoPush(messages);
}

module.exports = { sendExpoPush, notifyMissionDispatched, isExpoPushToken };
