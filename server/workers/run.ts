/** Worker process entrypoint: `npm run worker` (dev) or `node dist/worker.cjs` (production image). */
import { initializeDatabase } from '../db/db';
import { startWorkerLoop } from './tick';
import { logError } from '../security/logger';

async function main() {
  const status = await initializeDatabase();
  if (!status.connected || status.type !== 'postgresql') throw new Error('Worker requires an available PostgreSQL database');
  console.log('Vortex One worker started');
  const stop = startWorkerLoop();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Worker received ${signal}; finishing the current tick`);
    await Promise.race([stop(), new Promise((resolve) => setTimeout(resolve, 25_000))]);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logError('worker unhandledRejection', reason));
}

main().catch((error) => {
  logError('worker failed to start', error);
  process.exit(1);
});
