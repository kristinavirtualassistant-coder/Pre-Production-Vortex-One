/**
 * Role -> permission matrix. This module is pure data + `can()` (no imports) so any layer, including the
 * authentication middleware, can consult it without creating an import cycle. The role always comes from the
 * authenticated PostgreSQL user, never from the client.
 *
 * Roles (least to most privileged): member < agent < manager < executive < admin.
 */
export const ROLES = ['member', 'agent', 'manager', 'executive', 'admin'] as const;
export type Role = (typeof ROLES)[number];

const ADMIN_EXEC: readonly Role[] = ['admin', 'executive'];
const MANAGERS: readonly Role[] = ['admin', 'executive', 'manager'];
const OPERATORS: readonly Role[] = ['admin', 'executive', 'manager', 'agent'];

export const PERMISSIONS = {
  // Platform / tenant administration
  'system:read': ADMIN_EXEC,        // db status, cache administration
  'metrics:read': MANAGERS,         // operational metrics
  'audit:read': MANAGERS,           // tenant audit trails
  // Billing
  'billing:read': MANAGERS,         // plan, usage, invoices
  'billing:manage': ADMIN_EXEC,     // checkout, portal, cancel
  // Integrations
  'webhooks:read': MANAGERS,        // endpoints + deliveries (payloads)
  'webhooks:test': MANAGERS,
  'webhooks:manage': ADMIN_EXEC,
  // Data and files
  'files:read': MANAGERS,           // imported data files
  'integrations:connect': MANAGERS, // connect/disconnect mailbox OAuth integrations
  // Dialer / communications
  'calls:read': OPERATORS,          // call records and recordings
  'dial:bulk': MANAGERS,            // bulk dialing
  'suppressions:write': MANAGERS,   // DNC / opt-out compliance writes
  'inbox:sync': MANAGERS,
  // CRM
  'appointments:write': OPERATORS,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function rolesFor(permission: Permission): readonly Role[] {
  return PERMISSIONS[permission];
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  return typeof role === 'string' && (PERMISSIONS[permission] as readonly string[]).includes(role);
}
