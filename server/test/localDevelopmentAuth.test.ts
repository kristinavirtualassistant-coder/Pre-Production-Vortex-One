import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isLocalDevelopmentAuthEnabled, shouldBypassApiAuth } from '../middleware/auth';
import './postgresqlAuthMigration.test';

assert.equal(isLocalDevelopmentAuthEnabled(), false, 'local development authentication must remain disabled');
assert.equal(shouldBypassApiAuth('/health'), true, 'health must remain publicly reachable');
assert.equal(shouldBypassApiAuth('/ready'), true, 'readiness must remain publicly reachable');
assert.equal(shouldBypassApiAuth('/tasks'), false, 'application routes must require PostgreSQL authentication');
assert.equal(shouldBypassApiAuth('/telephony/webhook/ringcentral'), true, 'telephony webhooks must remain publicly reachable for provider delivery');

const authView = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AuthView.tsx'), 'utf8');
assert.equal(authView.includes("../lib/firebase"), false, 'AuthView must not import Firebase');
assert.equal(authView.includes('signInAsDemoPersona'), false, 'AuthView must not expose demo personas');
assert.equal(authView.includes('continueAsGuest'), false, 'AuthView must not expose guest access');
assert.equal(authView.includes('signInWithGoogle'), false, 'AuthView must not expose provider authentication');
assert.equal(authView.includes('signInWithEmail'), true, 'AuthView must use PostgreSQL email authentication');
assert.equal(authView.includes('signUpWithEmail'), true, 'AuthView must use PostgreSQL signup');


const authMiddleware = fs.readFileSync(path.resolve(process.cwd(), 'server/middleware/auth.ts'), 'utf8');
assert.equal(authMiddleware.includes('organizationName'), true, 'runtime signup must accept an organization name');
assert.equal(authMiddleware.includes('BEGIN'), true, 'runtime signup must create tenant and user transactionally');
assert.equal(authMiddleware.includes("VALUES ($1, $2, $3, $4, 'admin', $5)"), true, 'runtime first organization user must be an admin');
assert.equal(authMiddleware.includes("SELECT u.id, u.organization_id, u.email, u.name, u.role, u.password_hash, u.disabled_at"), true, 'runtime login must load the canonical organization membership');
assert.equal(authMiddleware.includes("const organizationId = typeof req.body?.organizationId"), false, 'runtime signup must not trust a client-supplied organization id');

console.log('PostgreSQL-only authentication boundary checks passed');
