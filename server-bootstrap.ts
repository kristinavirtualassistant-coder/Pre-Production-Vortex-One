import { startServer } from './server';

void startServer().catch((error) => {
  console.error('Vortex One failed to start:', error);
  process.exit(1);
});
