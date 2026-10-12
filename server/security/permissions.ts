import { AuthorizationError, requireRole, type AuthRequest } from '../middleware/auth';
import { can, rolesFor, type Permission } from './permissionMatrix';

export { can, PERMISSIONS, ROLES, rolesFor } from './permissionMatrix';
export type { Permission, Role } from './permissionMatrix';

/**
 * Express middleware: 401 without an authenticated database user, 403 unless the user's role (from the database)
 * holds the permission. Built on requireRole so there is a single enforcement path.
 */
export function requirePermission(permission: Permission) {
  return requireRole([...rolesFor(permission)]);
}

/** Inline guard for handlers that cannot use middleware: throws AuthorizationError (403). */
export function assertCan(user: AuthRequest['dbUser'], permission: Permission): void {
  if (!user) throw new AuthorizationError('Unauthorized: authenticated user required', 401);
  if (!can(user.role, permission)) throw new AuthorizationError(`Forbidden: requires permission ${permission}`, 403);
}
