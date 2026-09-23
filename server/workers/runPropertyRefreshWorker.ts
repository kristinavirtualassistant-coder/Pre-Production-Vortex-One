import { runPropertyRefreshWorkerOnce } from './schedulerWorker';

runPropertyRefreshWorkerOnce()
  .then((result) => {
    console.log(JSON.stringify(result));
    process.exit(0);
  })
  .catch((error) => {
    console.error('[scheduler-worker] failed:', error);
    process.exit(1);
  });
