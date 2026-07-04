import { validateServerStartupConfig } from './startup';

const mode = process.argv.includes('--preview') ? 'preview' : 'dev';

void (async () => {
  validateServerStartupConfig();
  const { startApp } = await import('./app');
  await startApp(mode);
})().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unable to start the app server.';
  console.error(message);
  process.exit(1);
});
