# PostgreSQL-only Authentication Design

## Goal
Make PostgreSQL the sole authoritative identity, tenant, session, and application persistence layer for Vortex One, removing Firebase Authentication and Firestore from the runtime.

## Scope
This design covers backend authentication, frontend session handling, PostgreSQL session persistence, tenant authorization, Firebase removal, and migration of webhook persistence from Firestore to PostgreSQL.

## Architecture
```text
Browser
  -> Vortex One API
     -> opaque bearer session token
        -> PostgreSQL auth_sessions
           -> PostgreSQL users
              -> canonical organization membership
```

The PostgreSQL `users.id` value is the canonical durable user identity. Authentication does not depend on Firebase UID, email as a durable identifier, or a client-supplied organization identifier.

## Authentication
- Store password hashes in `users.password_hash` using Node `crypto.scrypt`.
- Track disabled accounts with `users.disabled_at`.
- Track successful login time with `users.last_login_at`.
- Store opaque random session tokens only as hashes in `auth_sessions`.
- Protect session-token hashing with `AUTH_SESSION_PEPPER`.
- Enforce session expiration and revocation.
- Update `last_seen_at` on authenticated requests.
- Revoke sessions on logout.
- Never expose or persist raw session tokens in PostgreSQL.

## Tenant Authorization
Authentication resolves the user from PostgreSQL. The user's `organization_id` is authoritative. Request query/body/header organization values may be accepted only when they match the authenticated user's organization and are then canonicalized to that value.

Local-development authentication must not provide a production bypass. Guest/demo personas remain UI/testing concerns and must never create synthetic production identities.

## Frontend Contract
Preserve the existing `useAuth()` consumer-facing shape where practical so application components do not need unnecessary rewrites. Authentication operations become API calls backed by PostgreSQL sessions. Session restoration uses the bearer session token; logout revokes the server-side session.

## Firebase Removal
Remove Firebase Authentication, Firebase Admin, Firestore runtime imports, Firebase configuration files, Firebase-specific dependencies, and Firebase-specific documentation once no runtime or test reference remains.

## Webhook Persistence
Move webhook endpoint and delivery persistence to PostgreSQL while preserving existing signing, retry, delivery, enable/disable, and organization-scoping behavior.

## Security Invariants
1. No authenticated request may select a different organization than the PostgreSQL user's canonical organization.
2. Expired, revoked, or disabled-user sessions are rejected.
3. Raw session tokens are never stored.
4. Production authentication has no Firebase dependency.
5. Production authentication has no local-development bypass.
6. No synthetic demo identities are inserted into production data.
7. RingCentral remains an external telephony provider and credentials remain environment/secret configuration, never database data.
8. OpenAI is not part of this refactor.

## Testing
Authentication tests must cover missing credentials, invalid sessions, expired sessions, revoked sessions, disabled users, successful session authentication, organization mismatch, and session last-seen updates. Existing application tests must continue to pass without Firebase runtime dependencies.
