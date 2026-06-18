import {
  handleDeleteAiAttachment,
  handleGetAiAttachment,
  handleGetAiAttachmentContext,
  handleGetAiAttachmentHealth,
  handleParseAiAttachment,
} from './ai-attachments/routes';
import {
  handleCreateArtifact,
  handleDeleteArtifact,
  handleExportArtifactToDoc,
  handleFetchArtifactLines,
  handleGetArtifact,
  handleGetArtifactOutline,
  handleListArtifacts,
  handleListArtifactVersions,
  handlePatchArtifact,
  handleRestoreArtifactVersion,
  handleSearchArtifact,
  handleUpdateArtifactTable,
} from './ai-artifacts';
import {
  handleGetAiPdfPage,
  handleGetAiPdfPages,
  handleGetAiPdfPageImage,
  handleSearchAiPdf,
} from './ai-attachments/pdf-routes';
import { handlePostAiImageAnalysis, handlePostAiImageCompare, handlePostAiImageDescribe, handlePostAiImageQuestion } from './ai-attachments/image-routes';
import express, { Express, NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createAppViteConfig } from '../vite.shared';
import {
  handleGetAiModelCapabilities,
  handleGetAiRuntimeConfig,
  handlePostAiChatStream,
} from './ai-runtime';
import { handlePostAiMemoryRefresh } from './ai-memory';
import { handleGetAiPreferences, handleGetAiWorkspace, handlePutAiWorkspace } from './ai-workspace';
import { serverConfig } from './config';
import { getDatabase } from './db/database';
import { handleUrlFetch } from './url-fetch';
import { handlePythonExec, handlePythonExecFileDownload } from './python-exec';
import { handleWebSearch } from './web-search';
import {
  handleCreateSkill,
  handleDeleteSkill,
  handleGetSkill,
  handleGetSkillByName,
  handleListSkills,
  handlePutSkill,
  handleToggleSkill,
} from './skills';
import {
  handleCreateDoc,
  handleCreateDocVersion,
  handleDeleteDoc,
  handleDeleteDocCitation,
  handleDeleteDocTab,
  handleDuplicateDoc,
  handleGetDoc,
  handleGetDocCitations,
  handleGetDocPreferences,
  handleGetDocTabs,
  handleGetDocVersion,
  handleGetDocsMigrationStatus,
  handleImportDocsMigration,
  handleListDocs,
  handleListDocVersions,
  handlePostDocTab,
  handlePutDoc,
  handlePutDocPreferences,
  handlePutDocTab,
  handleRestoreDoc,
  handleRestoreDocVersion,
  handleSaveDocCitations,
  handleTrashDoc,
} from './docs';

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
  app.get('/api/ai/attachments/health', (_req, res) => void handleGetAiAttachmentHealth(_req, res));
  app.post('/api/ai/attachments/parse', express.json({ limit: '35mb' }), (req, res) => void handleParseAiAttachment(req, res));
  app.use(express.json({ limit: '2mb' }));
  app.get('/api/ai/workspace', (_req, res) => void handleGetAiWorkspace(_req, res));
  app.put('/api/ai/workspace', (req, res) => void handlePutAiWorkspace(req, res));
  app.get('/api/ai/preferences', (_req, res) => void handleGetAiPreferences(_req, res));
  app.get('/api/ai/runtime-config', (_req, res) => void handleGetAiRuntimeConfig(_req, res));
  app.get('/api/ai/model-capabilities', (req, res) => void handleGetAiModelCapabilities(req, res));
  app.post('/api/ai/chat/stream', (req, res) => void handlePostAiChatStream(req, res));
  app.post('/api/ai/chats/:chatId/memory-refresh', (req, res) => void handlePostAiMemoryRefresh(req, res));
  app.get('/api/ai/chats/:chatId/artifacts', (req, res) => void handleListArtifacts(req, res));
  app.post('/api/ai/chats/:chatId/artifacts', (req, res) => void handleCreateArtifact(req, res));
  app.get('/api/ai/chats/:chatId/artifacts/:artifactId', (req, res) => void handleGetArtifact(req, res));
  app.patch('/api/ai/chats/:chatId/artifacts/:artifactId', (req, res) => void handlePatchArtifact(req, res));
  app.delete('/api/ai/chats/:chatId/artifacts/:artifactId', (req, res) => void handleDeleteArtifact(req, res));
  app.get('/api/ai/chats/:chatId/artifacts/:artifactId/lines', (req, res) => void handleFetchArtifactLines(req, res));
  app.post('/api/ai/chats/:chatId/artifacts/:artifactId/search', (req, res) => void handleSearchArtifact(req, res));
  app.get('/api/ai/chats/:chatId/artifacts/:artifactId/outline', (req, res) => void handleGetArtifactOutline(req, res));
  app.get('/api/ai/chats/:chatId/artifacts/:artifactId/versions', (req, res) => void handleListArtifactVersions(req, res));
  app.post('/api/ai/chats/:chatId/artifacts/:artifactId/versions/:versionId/restore', (req, res) => void handleRestoreArtifactVersion(req, res));
  app.post('/api/ai/chats/:chatId/artifacts/:artifactId/export-to-doc', (req, res) => void handleExportArtifactToDoc(req, res));
  app.post('/api/ai/chats/:chatId/artifacts/:artifactId/table', (req, res) => void handleUpdateArtifactTable(req, res));
  app.get('/api/docs', (req, res) => void handleListDocs(req, res));
  app.post('/api/docs', (req, res) => void handleCreateDoc(req, res));
  app.get('/api/docs/preferences', (req, res) => void handleGetDocPreferences(req, res));
  app.put('/api/docs/preferences', (req, res) => void handlePutDocPreferences(req, res));
  app.get('/api/docs/migration/status', (req, res) => void handleGetDocsMigrationStatus(req, res));
  app.post('/api/docs/migration/import', (req, res) => void handleImportDocsMigration(req, res));
  app.get('/api/docs/:docId', (req, res) => void handleGetDoc(req, res));
  app.put('/api/docs/:docId', (req, res) => void handlePutDoc(req, res));
  app.delete('/api/docs/:docId', (req, res) => void handleDeleteDoc(req, res));
  app.post('/api/docs/:docId/duplicate', (req, res) => void handleDuplicateDoc(req, res));
  app.post('/api/docs/:docId/trash', (req, res) => void handleTrashDoc(req, res));
  app.delete('/api/docs/:docId/trash', (req, res) => void handleRestoreDoc(req, res));
  app.get('/api/docs/:docId/tabs', (req, res) => void handleGetDocTabs(req, res));
  app.post('/api/docs/:docId/tabs', (req, res) => void handlePostDocTab(req, res));
  app.put('/api/docs/:docId/tabs/:tabId', (req, res) => void handlePutDocTab(req, res));
  app.delete('/api/docs/:docId/tabs/:tabId', (req, res) => void handleDeleteDocTab(req, res));
  app.get('/api/docs/:docId/versions', (req, res) => void handleListDocVersions(req, res));
  app.post('/api/docs/:docId/versions', (req, res) => void handleCreateDocVersion(req, res));
  app.get('/api/docs/:docId/versions/:versionId', (req, res) => void handleGetDocVersion(req, res));
  app.post('/api/docs/:docId/versions/:versionId/restore', (req, res) => void handleRestoreDocVersion(req, res));
  app.get('/api/docs/:docId/citations', (req, res) => void handleGetDocCitations(req, res));
  app.post('/api/docs/:docId/citations', (req, res) => void handleSaveDocCitations(req, res));
  app.put('/api/docs/:docId/citations', (req, res) => void handleSaveDocCitations(req, res));
  app.delete('/api/docs/:docId/citations/:citationId', (req, res) => void handleDeleteDocCitation(req, res));
  app.get('/api/ai/attachments/:attachmentId', (req, res) => void handleGetAiAttachment(req, res));
  app.get('/api/ai/attachments/:attachmentId/context', (req, res) => void handleGetAiAttachmentContext(req, res));
  app.post('/api/ai/attachments/:attachmentId/image-analysis', (req, res) => void handlePostAiImageAnalysis(req, res));
  app.post('/api/ai/attachments/:attachmentId/image-compare', (req, res) => void handlePostAiImageCompare(req, res));
  app.post('/api/ai/attachments/:attachmentId/image-describe', (req, res) => void handlePostAiImageDescribe(req, res));
  app.post('/api/ai/attachments/:attachmentId/image-query', (req, res) => void handlePostAiImageQuestion(req, res));
  app.get('/api/ai/attachments/:attachmentId/pdf/search', (req, res) => void handleSearchAiPdf(req, res));
  app.get('/api/ai/attachments/:attachmentId/pdf/pages', (req, res) => void handleGetAiPdfPages(req, res));
  app.get('/api/ai/attachments/:attachmentId/pdf/pages/:pageNumber', (req, res) => void handleGetAiPdfPage(req, res));
  app.get('/api/ai/attachments/:attachmentId/pdf/pages/:pageNumber/image', (req, res) => void handleGetAiPdfPageImage(req, res));
  app.delete('/api/ai/attachments/:attachmentId', (req, res) => void handleDeleteAiAttachment(req, res));
  app.get('/api/web-search', (req, res) => void handleWebSearch(req, res));
  app.get('/api/fetch-url', (req, res) => void handleUrlFetch(req, res));
  app.post('/api/python-exec', (req, res) => void handlePythonExec(req, res));
  app.get('/api/ai/chats/:chatId/python-exec/files/*', (req, res) => void handlePythonExecFileDownload(req, res));
  app.get('/api/skills', (req, res) => void handleListSkills(req, res));
  app.post('/api/skills', (req, res) => void handleCreateSkill(req, res));
  app.get('/api/skills/by-name/:name', (req, res) => void handleGetSkillByName(req, res));
  app.get('/api/skills/:skillId', (req, res) => void handleGetSkill(req, res));
  app.put('/api/skills/:skillId', (req, res) => void handlePutSkill(req, res));
  app.delete('/api/skills/:skillId', (req, res) => void handleDeleteSkill(req, res));
  app.post('/api/skills/:skillId/toggle', (req, res) => void handleToggleSkill(req, res));
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
