/**
 * Firebase compatibility surface retired.
 *
 * Vortex One authentication and persistence are PostgreSQL-only. This module
 * intentionally contains no Firebase runtime dependency. Legacy UI code that
 * still imports DEMO_USERS receives an empty list so synthetic identities can
 * never become production accounts.
 */
export interface DemoPersona {
  id: string;
  name: string;
  role: string;
  avatar: string;
  organization_name: string;
  description: string;
}

export const DEMO_USERS: DemoPersona[] = [];
