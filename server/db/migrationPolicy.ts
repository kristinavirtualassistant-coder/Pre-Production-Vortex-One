export function shouldSkipPostgresMigrations(): boolean {
  return process.env.VORTEX_ONE_SKIP_MIGRATIONS === 'true';
}
