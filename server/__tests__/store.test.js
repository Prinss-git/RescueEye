'use strict';
const store = require('../lib/store');

describe('store.hydrate()', () => {
  test('degrades gracefully with { skipped: true } when no Firestore db is set', async () => {
    // No store.setDb() call in this test file — _db stays null, matching
    // local/demo mode with no Firebase credentials configured.
    const result = await store.hydrate();
    expect(result.skipped).toBe(true);
  });
});
