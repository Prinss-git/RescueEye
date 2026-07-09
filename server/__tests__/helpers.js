'use strict';
const store = require('../lib/store');
const { hashPassword, issueSession } = require('../lib/authz');

let counter = 0;

/**
 * Creates a real user directly in the store (bypassing HTTP) and mints a
 * ready-to-use session token, for fast test setup. `auth.test.js` covers the
 * real POST /auth/login path end-to-end separately.
 */
async function createTestUser(role, overrides = {}) {
  counter += 1;
  const password = overrides.password || 'testpass123';
  const email = overrides.email || `test-${role}-${Date.now()}-${counter}@test.ph`;

  const user = store.createUser({
    email,
    displayName:  overrides.displayName || `Test ${role}`,
    role,
    organization: overrides.organization ?? null,
    agencyId:     overrides.agencyId ?? null,
    passwordHash: await hashPassword(password),
  });

  const token = issueSession(user);
  return { user, token, password };
}

module.exports = { createTestUser };
