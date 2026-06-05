import express, { Express, NextFunction, Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createAppViteConfig } from '../vite.shared';
import { serverConfig } from './config';
import { handleUrlFetch } from './url-fetch';
import { handleWebSearch } from './web-search';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDir, '..');

function registerApiRoutes(app: Express) {
  app.get('/api/web-search', (req, res) => void handleWebSearch(req, res));
  app.get('/api/fetch-url', (req, res) => void handleUrlFetch(req, res));
}

function registerErrorHandler(app: Express) {
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'The local server failed unexpectedly.';
    res.status(500).json({ ok: false, error: message });
  });
}

async function attachDevApp(app: Express) {
  const baseConfig = createAppViteConfig(projectRoot);
  const vite = await createViteServer({
    ...baseConfig,
    appType: 'custom',
    configFile: false,
    root: projectRoot,
    server: {
      ...baseConfig.server,
      middlewareMode: true,
    },
  });

  app.use(vite.middlewares);
  app.use('*', async (req, res, next) => {
    try {
      const templatePath = path.resolve(projectRoot, 'index.html');
      const template = await fs.readFile(templatePath, 'utf8');
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (error) {
      next(error);
    }
  });
}

function attachPreviewApp(app: Express) {
  const distDir = path.resolve(projectRoot, 'dist');
  app.use(express.static(distDir, { index: false }));
  app.use('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

export async function createApp(mode: 'dev' | 'preview') {
  const app = express();
  app.disable('x-powered-by');
  registerApiRoutes(app);

  if (mode === 'preview') {
    attachPreviewApp(app);
  } else {
    await attachDevApp(app);
  }

  registerErrorHandler(app);
  return app;
}

export async function startApp(mode: 'dev' | 'preview') {
  const app = await createApp(mode);
  return app.listen(serverConfig.port, serverConfig.host, () => {
    console.log(`Local app server running at http://127.0.0.1:${serverConfig.port} (${mode})`);
  });
}
