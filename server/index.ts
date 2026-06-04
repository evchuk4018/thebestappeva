import { startApp } from './app';

const mode = process.argv.includes('--preview') ? 'preview' : 'dev';

void startApp(mode);
