import { Container, getContainer } from '@cloudflare/containers';
import { env } from 'cloudflare:workers';

export class VortexOneContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '10m';
  enableInternet = true;
  envVars = {
    SQL_HOST: env.SQL_HOST,
    SQL_PORT: env.SQL_PORT,
    SQL_DB_NAME: env.SQL_DB_NAME,
    SQL_USER: env.SQL_USER,
    SQL_PASSWORD: env.SQL_PASSWORD,
    SQL_SSL: env.SQL_SSL,
    VORTEX_ONE_SKIP_MIGRATIONS: env.VORTEX_ONE_SKIP_MIGRATIONS,
  };
}

type Env = {
  VORTEX_ONE_CONTAINER: any;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = getContainer(env.VORTEX_ONE_CONTAINER, 'vortex-one-production');
    return container.fetch(request);
  },
};
