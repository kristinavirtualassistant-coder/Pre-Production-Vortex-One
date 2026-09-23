import { Container, getContainer } from '@cloudflare/containers';
import { env } from 'cloudflare:workers';

type ContainerRuntimeEnv = { SQL_HOST: string; SQL_PORT: string; SQL_DB_NAME: string; SQL_USER: string; SQL_PASSWORD: string; SQL_SSL: string; VORTEX_ONE_SKIP_MIGRATIONS: string; };

export class VortexOneContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '10m';
  enableInternet = true;
  envVars = {
    SQL_HOST: (env as unknown as ContainerRuntimeEnv).SQL_HOST,
    SQL_PORT: (env as unknown as ContainerRuntimeEnv).SQL_PORT,
    SQL_DB_NAME: (env as unknown as ContainerRuntimeEnv).SQL_DB_NAME,
    SQL_USER: (env as unknown as ContainerRuntimeEnv).SQL_USER,
    SQL_PASSWORD: (env as unknown as ContainerRuntimeEnv).SQL_PASSWORD,
    SQL_SSL: (env as unknown as ContainerRuntimeEnv).SQL_SSL,
    VORTEX_ONE_SKIP_MIGRATIONS: (env as unknown as ContainerRuntimeEnv).VORTEX_ONE_SKIP_MIGRATIONS,
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
