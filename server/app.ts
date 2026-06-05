import express, { Express, NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createAppViteConfig } from '../vite.shared';
import { handleGetAiPreferences, handleGetAiWorkspace, handlePutAiWorkspace } from './ai-workspace';
import { serverConfig } from './config';
import { getDatabase } from './db/database';
import { handleUrlFetch } from './url-fetch';
import { handleWebSearch } from './web-search';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDir, '..');
const devPortAttempts = 20;

function isAddressInUseError(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'EADDRINUSE';
}

function listen(app: Express, port: number) {
  return new Promise<Server>((resolve, reject) => {
    const server = app.listen(port, serverConfig.host);
    const handleListening = () => {
      server.off('error', handleError);
      resolve(server);
    };
    const handleError = (error: Error) => {
      server.off('listening', handleListening);
      reject(error);
    };

    server.once('listening', handleListening);
    server.once('error', handleError);
  });
}

async function listenWithDevFallback(app: Express, mode: 'dev' | 'preview') {
  const maxAttempts = mode === 'dev' ? devPortAttempts : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const port = serverConfig.port + attempt;

    try {
      return { server: await listen(app, port), port };
    } catch (error) {
      if (!isAddressInUseError(error) || attempt === maxAttempts - 1) {
        throw error;
      }

      console.warn(`Port ${port} is in use. Trying ${port + 1}...`);
    }
  }

  throw new Error('Unable to find an available dev server port.');
}

function registerApiRoutes(app: Express) {
  app.use(express.json({ limit: '2mb' }));
  app.get('/api/ai/workspace', (_req, res) => void handleGetAiWorkspace(_req, res));
  app.put('/api/ai/workspace', (req, res) => void handlePutAiWorkspace(req, res));
  app.get('/api/ai/preferences', (_req, res) => void handleGetAiPreferences(_req, res));
  app.get('/api/web-search', (req, res) => void handleWebSearch(req, res));
  app.get('/api/fetch-url', (req, res) => void handleUrlFetch(req, res));
}

function registerErrorHandler(app: Express) {
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'The local server failed unexpectedly.';
    const statusCode = error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    res.status(statusCode).json({ ok: false, error: message });
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
  getDatabase();
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
  const { server, port } = await listenWithDevFallback(app, mode);
  console.log(`Local app server running at http://127.0.0.1:${port} (${mode})`);
  return server;
}
