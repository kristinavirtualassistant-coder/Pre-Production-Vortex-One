import { createApp } from './server';

const PORT = Number(process.env.PORT || 8080);

createApp()
  .then((app) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Vortex One platform running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Vortex One startup failed:', err);
    process.exit(1);
  });
