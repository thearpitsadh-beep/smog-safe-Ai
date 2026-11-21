# SmogSafe AI — Firestore Security Specification & Red-Team Invariants

## 1. Data Invariants

1. **Default-Deny Safety Net**: Every path not explicitly matched under `/users/{userId}` (including `/test/connection` and unknown collections) denies all `read` and `write` operations.
2. **Verified Identity Gate**: All read/write operations require `request.auth != null`, and all writes mandate `request.auth.token.email_verified == true`.
3. **Path Variable & ID Poisoning Protection**: Single-document operations validate `isValidId(id)` (`^[a-zA-Z0-9_\\-]+$`, length `1..128`) and strictly constrain string/array bounds to block Denial-of-Wallet oversized payloads.
4. **Master Gate Relational Integrity**: Subcollections (`/users/{userId}/private/profile`, `/users/{userId}/plans/{planId}`, `/users/{userId}/airLogs/{logId}`) verify that the parent `/users/{userId}` anchor document exists (`exists(...)`) on `get`, `create`, and `update`.
5. **PII Isolation (Split Collection Strategy)**: Email and displayName reside exclusively in `/users/{userId}/private/profile` (readable/writable only by `request.auth.uid == userId`, with `list` disabled). `/users/{userId}` stores only non-PII ownership metadata (`uid`, `schemaVersion`, `createdAt`, `updatedAt`).
6. **Temporal Integrity & Immortal Fields**: `createdAt == request.time` on create; `updatedAt == request.time` on update. `uid` and `createdAt` are immutable across updates.
7. **Anti-Update-Gap & Action-Based Updates**: Every `create` enforces `hasAll` + `hasOnly` (blocking shadow/ghost fields); every `update` wraps `isValid[Entity](incoming())` AND splits updates into named actions using `incoming().diff(existing()).affectedKeys().hasOnly([...])`.
8. **Query Enforcer (`allow list`)**: `plans` and `airLogs` `allow list` rules explicitly enforce `isOwner(userId) && isVerifiedUser() && resource.data.uid == request.auth.uid` without `get()`/`exists()` O(n) reads.
9. **No Fabricated Sensor Status**: Saved plans distinguish `dataStatus in ['modeled-live-forecast', 'illustrative-demo']` and `scale == 'US AQI'`, bounded to numeric physical ranges (`0 <= usAqi <= 500`, `0 <= pm25 <= 1500`).

---

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)

1. **Unauthenticated Read/Write**: `GET /users/alice/plans/plan1` with `auth == null`.
2. **Unverified Email Spoof**: `CREATE /users/alice/private/profile` where `auth.uid == 'alice'` and `auth.token.email_verified == false`.
3. **Cross-Tenant PII Read**: `GET /users/alice/private/profile` authenticated as `bob` (`bob != alice`).
4. **Cross-Tenant Ownership Spoof (UID Injection)**: `CREATE /users/bob/plans/p1` as `bob` with payload `uid: 'alice'`.
5. **Shadow / Ghost Field Injection (Create)**: `CREATE /users/alice/private/profile` including unallowed field `isAdmin: true` or `role: 'admin'`.
6. **Shadow / Ghost Field Injection (Update)**: `UPDATE /users/alice/private/profile` modifying `city` plus an extra field `verifiedLiveSensor: true`.
7. **ID Poisoning / Path Traversal**: `CREATE /users/alice/plans/bad..id$with/chars` or `id.size() > 128`.
8. **Type / Value Poisoning (Out-of-Range AQI)**: `CREATE /users/alice/plans/p1` with `usAqi: 99999` or `usAqi: "180"`.
9. **Array Exhaustion / Unbounded List**: `CREATE /users/alice/plans/p1` with `actionTitles: ["a", "b", "c", "d"]` (`size > 3`) or non-string first item `[123]`.
10. **Client-Forged Timestamp**: `CREATE /users/alice/plans/p1` where `createdAt != request.time` (backdated timestamp).
11. **Immortal Field Mutation**: `UPDATE /users/alice/plans/p1` attempting to modify `createdAt` or `uid`.
12. **Orphaned Subcollection Write / Missing Parent Anchor**: `CREATE /users/alice/plans/p1` when `/users/alice` does not exist yet (Master Gate blocks orphaned writes), or `LIST /users/alice/plans` without matching `resource.data.uid == request.auth.uid`.
