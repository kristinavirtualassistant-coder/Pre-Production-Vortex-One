/** Fast structural guards for the Owner Portal (the behavioural proof is in server/test/security/owner*.test.ts). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

// ---- frontend: no registration surface, no credential storage
const ownerFiles = walk('src/owner').filter((f) => /\.(ts|tsx)$/.test(f));
assert.ok(ownerFiles.length >= 10);
for (const file of ownerFiles) {
  const source = read(file);
  const visibleText = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(visibleText), `${file} must not use browser storage`);
  assert.ok(!/sign[ -]?up|register|create (an )?(owner )?account|create owner|invite (an )?owner|add (an )?owner|forgot password|reset password/i.test(visibleText), `${file} must not offer sign-up/registration/owner creation`);
  assert.ok(!/platform_owner\s*[:=]\s*true|isPlatformOwner\s*[:=]\s*true/.test(visibleText), `${file} must not assert ownership client-side`);
}
const users = read('src/owner/pages/UsersPage.tsx');
assert.match(users, /const ROLES = \['admin', 'executive', 'manager', 'agent', 'member'\]/);
assert.ok(!/platform_owner/.test(users.match(/const ROLES[^;]*;/)![0]), 'platform_owner is not an assignable role in the UI');
const api = read('src/owner/api.ts');
assert.match(api, /credentials: 'include'/);
assert.match(api, /X-Vortex-Owner/);
assert.ok(!/Authorization|Bearer/.test(api.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'the owner client authenticates with the HttpOnly cookie only');

// ---- the customer application never references the owner portal
for (const file of [...walk('src/components'), 'src/App.tsx', ...walk('src/contexts'), ...walk('src/services')].filter((f) => /\.(ts|tsx)$/.test(f))) {
  assert.ok(!/from ['"][./]*owner\//.test(read(file)) && !/owner\/OwnerApp/.test(read(file)), `${file} must not import the owner portal`);
}
const main = read('src/main.tsx');
assert.match(main, /isOwnerPath\(window\.location\.pathname\)/);
assert.match(main, /import\('\.\/owner\/OwnerApp\.tsx'\)/, 'owner code is lazy-loaded only for /owner/*');

// ---- backend: authorization is the first thing every owner route passes through
const router = read('server/routes/owner.ts');
const firstUse = router.indexOf('ownerRouter.use(');
assert.ok(firstUse > 0 && /requirePlatformOwner/.test(router.slice(firstUse, firstUse + 200)), 'requirePlatformOwner is installed before any route');
const firstRoute = router.search(/ownerRouter\.(get|post|put|patch|delete)\(/);
assert.ok(firstUse < firstRoute, 'no route is registered before the authorization middleware');
assert.ok(!/ownerRouter\.(patch|delete)\(/.test(router), 'no destructive or audit-modifying owner verbs exist');
const routerCode = router.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
assert.ok(!/register|signup|invite-owner|\/owners|platform-owners|promote/i.test(routerCode.replace(/support|organization/gi, '')), 'no owner registration/invitation/promotion routes');
const server = read('server.ts');
assert.match(server, /app\.use\('\/api\/owner', ownerRouter\)/);
assert.ok(server.indexOf("app.use('/api/owner', ownerRouter)") > server.indexOf("app.use('/api', (req: AuthRequest"), 'owner routes sit behind the shared session authentication');

// ---- no code path writes platform_owners or the audit log except the provisioning script / insert-only service
for (const file of walk('server').concat(['server.ts']).filter((f) => f.endsWith('.ts') && !f.includes('/test/') && !f.includes('migrations.ts'))) {
  const s = read(file);
  assert.ok(!/(INSERT INTO|UPDATE|DELETE FROM)\s+platform_owners/i.test(s), `${file} must not write platform_owners`);
  assert.ok(!/(UPDATE|DELETE FROM)\s+platform_audit_logs/i.test(s), `${file} must not modify platform_audit_logs`);
}
const provision = read('scripts/provision-platform-owner.ts');
assert.match(provision, /PLATFORM_PROVISIONING_DATABASE_URL/);
assert.match(provision, /vortex_one\.platform_provisioning/);
assert.ok(!/express|app\.(get|post)/.test(provision), 'provisioning is a script, not an HTTP surface');

// ---- migration shape
const migrations = read('server/db/migrations.ts');
for (const needle of ['uq_platform_owner_singleton', 'trg_platform_audit_immutable', 'guard_platform_owner_changes', 'organizations_status_valid']) assert.ok(migrations.includes(needle), `migration 047 defines ${needle}`);
assert.ok(!/users_role_valid[\s\S]{0,200}platform_owner/.test(migrations), 'platform_owner is not a valid users.role');

console.log('Owner portal source guards passed.');
