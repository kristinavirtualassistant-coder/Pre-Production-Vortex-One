/**
 * Demo/synthetic data is opt-in and can NEVER be enabled in production, regardless of environment flags.
 * Enable locally with DEMO_MODE_ENABLED=true (legacy VORTEX_ONE_SEED_DEMO_DATA=1 is still honored).
 */
export function isDemoModeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') return false;
  const flag = (env.DEMO_MODE_ENABLED ?? '').trim().toLowerCase();
  return flag === 'true' || flag === '1' || env.VORTEX_ONE_SEED_DEMO_DATA === '1';
}
