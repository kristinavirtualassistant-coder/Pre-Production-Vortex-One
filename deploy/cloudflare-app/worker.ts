import { Container, getContainer } from '@cloudflare/containers';

export class VortexOneContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '10m';
  enableInternet = true;
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
