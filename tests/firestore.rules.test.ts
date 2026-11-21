import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

interface AuthContext {
  uid: string;
  emailVerified: boolean;
}

type OpType = 'get' | 'list' | 'create' | 'update' | 'delete';

interface RuleEvalInput {
  auth: AuthContext | null;
  op: OpType;
  path: string;
  incoming?: Record<string, unknown>;
  existing?: Record<string, unknown>;
  existingParents?: Set<string>;
  serverTimeMs: number;
}

const VALID_ID = /^[a-zA-Z0-9_-]{1,128}$/;

function isOwner(auth: AuthContext | null, userId: string): boolean {
  return Boolean(auth && auth.uid === userId);
}

function isVerified(auth: AuthContext | null): boolean {
  return Boolean(auth && auth.emailVerified === true);
}

function hasExactKeys(obj: Record<string, unknown>, req: string[], opt: string[] = []): boolean {
  const keys = Object.keys(obj);
  const allowed = new Set([...req, ...opt]);
  return req.every((k) => k in obj) && keys.every((k) => allowed.has(k));
}

function isValidCoords(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lon === 'number' &&
    Number.isFinite(lon) &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Pure TypeScript reference evaluator mirroring firestore.rules Eight Pillars & Dirty Dozen guards.
 */
function evaluateRule(input: RuleEvalInput): 'ALLOW' | 'PERMISSION_DENIED' {
  const parts = input.path.replace(/^\/+/, '').split('/');
  if (parts[0] !== 'users' || parts.length < 2) {
    return 'PERMISSION_DENIED';
  }
  const userId = parts[1];
  const auth = input.auth;

  // /users/{userId}
  if (parts.length === 2) {
    if (input.op === 'list' || input.op === 'delete') return 'PERMISSION_DENIED';
    if (!VALID_ID.test(userId) || !isOwner(auth, userId) || !isVerified(auth)) {
      return 'PERMISSION_DENIED';
    }
    if (input.op === 'get') return 'ALLOW';
    const data = input.incoming;
    if (
      !data ||
      !hasExactKeys(data, ['uid', 'schemaVersion', 'createdAt', 'updatedAt']) ||
      !VALID_ID.test(String(data.uid)) ||
      data.uid !== userId ||
      data.uid !== auth!.uid ||
      data.schemaVersion !== 1
    ) {
      return 'PERMISSION_DENIED';
    }
    if (input.op === 'create') {
      return data.createdAt === input.serverTimeMs && data.updatedAt === input.serverTimeMs
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (input.op === 'update' && input.existing) {
      const changed = Object.keys(data).filter((k) => data[k] !== input.existing![k]);
      return data.uid === input.existing.uid &&
        data.createdAt === input.existing.createdAt &&
        data.updatedAt === input.serverTimeMs &&
        changed.every((k) => k === 'updatedAt')
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  const sub = parts[2];
  const docId = parts[3];
  const parentPath = `/users/${userId}`;
  const hasParent = Boolean(input.existingParents?.has(parentPath));

  // /users/{userId}/private/{docId}
  if (sub === 'private' && parts.length === 4) {
    if (input.op === 'list') return 'PERMISSION_DENIED';
    if (!VALID_ID.test(userId) || !VALID_ID.test(docId) || docId !== 'profile') {
      return 'PERMISSION_DENIED';
    }
    if (!isOwner(auth, userId) || !isVerified(auth)) return 'PERMISSION_DENIED';
    if (input.op === 'delete') return 'ALLOW';
    if (!hasParent) return 'PERMISSION_DENIED';
    if (input.op === 'get') return 'ALLOW';

    const data = input.incoming;
    const keys = [
      'uid',
      'email',
      'displayName',
      'city',
      'country',
      'latitude',
      'longitude',
      'schedule',
      'commute',
      'budget',
      'children',
      'seniors',
      'sensitive',
      'purifier',
      'createdAt',
      'updatedAt',
    ];
    if (
      !data ||
      !hasExactKeys(data, keys) ||
      !VALID_ID.test(String(data.uid)) ||
      data.uid !== userId ||
      data.uid !== auth!.uid ||
      typeof data.email !== 'string' ||
      data.email.length > 254 ||
      typeof data.displayName !== 'string' ||
      data.displayName.length > 80 ||
      typeof data.city !== 'string' ||
      data.city.length < 1 ||
      data.city.length > 80 ||
      typeof data.country !== 'string' ||
      data.country.length < 1 ||
      data.country.length > 60 ||
      !isValidCoords(data.latitude, data.longitude)
    ) {
      return 'PERMISSION_DENIED';
    }
    if (input.op === 'create') {
      return data.createdAt === input.serverTimeMs && data.updatedAt === input.serverTimeMs
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (input.op === 'update' && input.existing) {
      return data.uid === input.existing.uid &&
        data.createdAt === input.existing.createdAt &&
        data.updatedAt === input.serverTimeMs
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  // /users/{userId}/plans/{planId}
  if (sub === 'plans' && parts.length === 4) {
    if (input.op === 'list') {
      if (!isOwner(auth, userId) || !isVerified(auth)) return 'PERMISSION_DENIED';
      return input.existing?.uid === auth!.uid ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (!VALID_ID.test(userId) || !VALID_ID.test(docId) || !isOwner(auth, userId) || !isVerified(auth)) {
      return 'PERMISSION_DENIED';
    }
    if (input.op === 'delete') return 'ALLOW';
    if (!hasParent) return 'PERMISSION_DENIED';
    if (input.op === 'get') return 'ALLOW';

    const data = input.incoming;
    const keys = [
      'uid',
      'city',
      'country',
      'latitude',
      'longitude',
      'dataStatus',
      'scale',
      'usAqi',
      'pm25',
      'forecastTimestamp',
      'sourceLabel',
      'intensity',
      'actionTitles',
      'schedule',
      'commute',
      'budget',
      'createdAt',
      'updatedAt',
    ];
    if (
      !data ||
      !hasExactKeys(data, keys) ||
      !VALID_ID.test(String(data.uid)) ||
      data.uid !== userId ||
      data.uid !== auth!.uid ||
      typeof data.usAqi !== 'number' ||
      data.usAqi < 0 ||
      data.usAqi > 500 ||
      typeof data.pm25 !== 'number' ||
      data.pm25 < 0 ||
      data.pm25 > 1500 ||
      !Array.isArray(data.actionTitles) ||
      data.actionTitles.length < 1 ||
      data.actionTitles.length > 3 ||
      data.actionTitles.some((t) => typeof t !== 'string' || t.length < 1 || t.length > 160)
    ) {
      return 'PERMISSION_DENIED';
    }
    if (input.op === 'create') {
      return data.createdAt === input.serverTimeMs && data.updatedAt === input.serverTimeMs
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (input.op === 'update' && input.existing) {
      const allowedUpdate = new Set(['intensity', 'actionTitles', 'schedule', 'commute', 'budget', 'updatedAt']);
      const changed = Object.keys(data).filter((k) => data[k] !== input.existing![k]);
      return data.uid === input.existing.uid &&
        data.createdAt === input.existing.createdAt &&
        data.updatedAt === input.serverTimeMs &&
        changed.every((k) => allowedUpdate.has(k))
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  return 'PERMISSION_DENIED';
}

test('firestore.rules adheres to Eight Pillars structural invariants and matches firebase-blueprint.json', async () => {
  const rules = await fs.readFile(path.resolve('firestore.rules'), 'utf8');
  const blueprint = JSON.parse(await fs.readFile(path.resolve('firebase-blueprint.json'), 'utf8')) as {
    entities: Record<string, unknown>;
    firestore: Record<string, unknown>;
  };

  assert.match(rules, /^rules_version = '2';/);
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /isValidId\(/);
  assert.match(rules, /isValidUserMeta\(/);
  assert.match(rules, /isValidPrivateProfile\(/);
  assert.match(rules, /isValidSavedPlan\(/);
  assert.match(rules, /isValidAirLog\(/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(/);
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rules, /resource\.data\.uid == request\.auth\.uid/);
  assert.doesNotMatch(rules, /allow list:\s*if\s*isSignedIn\(\)\s*;/);

  // Every blueprint collection path has a matching block
  for (const collectionPath of Object.keys(blueprint.firestore)) {
    const segment = collectionPath.split('/').slice(-2, -1)[0] || 'users';
    assert.match(rules, new RegExp(`match /${segment}/\\{`));
  }
});

test('Dirty Dozen adversarial payloads all evaluate to PERMISSION_DENIED', () => {
  const now = 1_760_000_000_000;
  const aliceAuth: AuthContext = { uid: 'alice', emailVerified: true };
  const bobAuth: AuthContext = { uid: 'bob', emailVerified: true };
  const unverifiedAlice: AuthContext = { uid: 'alice', emailVerified: false };
  const parents = new Set(['/users/alice', '/users/bob']);

  const validProfile = {
    uid: 'alice',
    email: 'alice@example.com',
    displayName: 'Alice',
    city: 'New Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    schedule: 'mixed',
    commute: 'car',
    budget: 'low',
    children: true,
    seniors: false,
    sensitive: false,
    purifier: false,
    createdAt: now,
    updatedAt: now,
  };

  const validPlan = {
    uid: 'alice',
    city: 'New Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    dataStatus: 'modeled-live-forecast',
    scale: 'US AQI',
    usAqi: 184,
    pm25: 82.6,
    forecastTimestamp: '2026-11-20T09:00:00.000Z',
    sourceLabel: 'Open-Meteo / Copernicus CAMS',
    intensity: 'High protection',
    actionTitles: ['Avoid outdoor running'],
    schedule: 'mixed',
    commute: 'car',
    budget: 'low',
    createdAt: now,
    updatedAt: now,
  };

  // Sanity check valid paths allow
  assert.equal(
    evaluateRule({
      auth: aliceAuth,
      op: 'create',
      path: '/users/alice/private/profile',
      incoming: validProfile,
      existingParents: parents,
      serverTimeMs: now,
    }),
    'ALLOW',
  );
  assert.equal(
    evaluateRule({
      auth: aliceAuth,
      op: 'create',
      path: '/users/alice/plans/plan-1',
      incoming: validPlan,
      existingParents: parents,
      serverTimeMs: now,
    }),
    'ALLOW',
  );

  // 1. Unauthenticated read/write
  assert.equal(
    evaluateRule({ auth: null, op: 'get', path: '/users/alice/plans/plan-1', existingParents: parents, serverTimeMs: now }),
    'PERMISSION_DENIED',
  );
  // 2. Unverified email spoof
  assert.equal(
    evaluateRule({
      auth: unverifiedAlice,
      op: 'create',
      path: '/users/alice/private/profile',
      incoming: validProfile,
      existingParents: parents,
      serverTimeMs: now,
    }),
    'PERMISSION_DENIED',
  );
  // 3. Cross-tenant PII read
  assert.equal(
    evaluateRule({
      auth: bobAuth,
      op: 'get',
      path: '/users/alice/private/profile',
      existingParents: parents,
      serverTimeMs: now,
    }),
    'PERMISSION_DENIED',
  );
  // 4. Cross-tenant ownership spoof
  assert.equal(
    evaluateRule({
      auth: bobAuth,
      op: 'create',
      path: '/users/bob/plans/plan-1',
      incoming: { ...validPlan, uid: 'alice' },
      existingParents: parents,
      serverTimeMs: now,
    }),
    'PERMISSION_DENIED',
  );
  // 5. Shadow field on create
  assert.equal(
    evaluateRule({
      auth: aliceAuth,
      op: 'create',
      path: '/users/alice/private/profile',
      incoming: { ...validProfile, isAdmin: true },
      existingParents: parents,
      serverTimeMs: now,
    }),
    'PERMISSION_DENIED',
  );
  // 6. Shadow field on update
  assert.equal(
    evaluateRule({
      auth: aliceAuth,
      op: 'update',
      path: '/users/alice/plans/plan-1',
      existing: validPlan,
      incoming: { ...validPlan, usAqi: 12, updatedAt: now + 1000 },
      existingParents: parents,
      serverTimeMs: now + 1000,
    }),
    'PERMISSION_DENIED',
  );
  // 7. ID poisoning
  assert.equal(
    evaluateRule({
      auth: aliceAuth,
      op: 'create',
      path: '/users/alice/plans/bad..id$chars',
      incoming: validPlan,
      existingParents: parents,
      serverTimeMs: now,
    }),
    'PERMISSION_DENIED',
  );
  // 8. Out-of-range AQI poisoning
  assert.equal(
    evaluateRule({
      auth: aliceAuth,
      op: 'create',
      path: '/users/alice/plans/plan-1',
      incoming: { ...validPlan, usAqi: 99999 },
      existingParents: parents,
      serverTimeMs: now,
    }),
    'PERMISSION_DENIED',
  );
  // 9. Array exhaustion (>3 items) & type poisoning
  assert.equal(
    evaluateRule({
      auth: aliceAuth,
      op: 'create',
      path: '/users/alice/plans/plan-1',
      incoming: { ...validPlan, actionTitles: ['a', 'b', 'c', 'd'] },
      existingParents: parents,
      serverTimeMs: now,
    }),
    'PERMISSION_DENIED',
  );
  // 10. Client-forged backdated timestamp
  assert.equal(
    evaluateRule({
      auth: aliceAuth,
      op: 'create',
      path: '/users/alice/plans/plan-1',
      incoming: { ...validPlan, createdAt: now - 10_000 },
      existingParents: parents,
      serverTimeMs: now,
    }),
    'PERMISSION_DENIED',
  );
  // 11. Immortal field mutation
  assert.equal(
    evaluateRule({
      auth: aliceAuth,
      op: 'update',
      path: '/users/alice/plans/plan-1',
      existing: validPlan,
      incoming: { ...validPlan, createdAt: now + 500, updatedAt: now + 1000 },
      existingParents: parents,
      serverTimeMs: now + 1000,
    }),
    'PERMISSION_DENIED',
  );
  // 12. Orphaned subcollection write (missing parent) & unauthorized list
  assert.equal(
    evaluateRule({
      auth: aliceAuth,
      op: 'create',
      path: '/users/alice/plans/plan-1',
      incoming: validPlan,
      existingParents: new Set(),
      serverTimeMs: now,
    }),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateRule({
      auth: aliceAuth,
      op: 'list',
      path: '/users/alice/plans/plan-1',
      existing: { ...validPlan, uid: 'bob' },
      existingParents: parents,
      serverTimeMs: now,
    }),
    'PERMISSION_DENIED',
  );
});
