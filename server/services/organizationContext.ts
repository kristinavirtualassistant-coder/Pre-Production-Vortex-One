/**
 * Require an explicit tenant organization for service-layer operations.
 * Production callers must derive this from authenticated request context;
 * there is intentionally no default organization fallback.
 */
export function requireOrganizationId(organizationId: string | null | undefined): string {
  if (typeof organizationId !== 'string' || organizationId.trim().length === 0) {
    throw new Error('Organization ID is required; no default tenant is permitted');
  }
  return organizationId.trim();
}
