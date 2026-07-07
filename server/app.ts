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
import { normalizeEmail, readServerAuthConfig, validateResolvedServerAuthConfig, type ServerAuthConfig } from './auth/config';
import { createRequireOwnerMiddleware } from './auth/require-owner';
import { getRequestAuthContext } from './auth/request-context';
import { createSupabaseTokenValidator, type AccessTokenValidator } from './auth/supabase';
import { createServerCompositionRoot, type ServerRequestDependencies } from './composition-root';
import { closePostgresPool, installPostgresPoolShutdownHandlers } from './db/postgres';
import { validatePostgresConfig, type PostgresConfigSource } from './db/postgres-config';
import { toHttpErrorResponse } from './http';
import { handleUrlFetch } from './url-fetch';
import { handlePythonExec, handlePythonExecFileDownload } from './python-exec';
import { handleWebSearch } from './web-search';
import {
  handleClaimDueAutomations,
  handleCreateAutomation,
  handleDeleteAutomation,
  handleGetAutomation,
  handleListAutomations,
  handlePutAutomation,
  handleReportAutomationRun,
  handleToggleAutomation,
} from './automations';
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
  handleCreateCalendarCalendar,
  handleCreateCalendarCategory,
  handleCreateCalendarEvent,
  handleCreateCalendarTask,
  handleDeleteCalendarCalendar,
  handleDeleteCalendarCategory,
  handleDeleteCalendarEvent,
  handleDeleteCalendarTask,
  handleDuplicateCalendarEvent,
  handleGetCalendarBootstrap,
  handleListCalendarCalendars,
  handleListCalendarCategories,
  handleListCalendarEvents,
  handleListCalendarTasks,
  handlePostCalendarUndo,
  handlePutCalendarCalendar,
  handlePutCalendarCategory,
  handlePutCalendarEvent,
  handlePutCalendarSettings,
  handlePutCalendarTask,
  handleRestoreCalendarEvent,
  handleSaveCalendarOccurrence,
  handleTrashCalendarEvent,
} from './calendar';
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
import {
  handleCreateWorkoutExercise,
  handleCreateWorkoutRoutine,
  handleDeleteWorkoutRoutine,
  handleDeleteWorkoutSession,
  handleFinishWorkoutSession,
  handleGetWorkoutBootstrap,
  handleGetWorkoutHistory,
  handleGetWorkoutSession,
  handleLogWorkoutSession,
  handlePutWorkoutRoutine,
  handlePutWorkoutSession,
  handleStartEmptyWorkoutSession,
  handleStartRoutineWorkoutSession,
} from './workout';
import {
  handleCreateNutritionBrandFood,
  handleCreateNutritionEntry,
  handleCreateNutritionEntryItem,
  handleCreateNutritionRecipe,
  handleDeleteNutritionEntry,
  handleDeleteNutritionEntryItem,
  handleGetNutritionBootstrap,
  handleGetNutritionHistory,
  handleGetNutritionGoals,
  handleListNutritionRecipes,
  handlePostNutritionAiFoodLog,
  handlePutNutritionBrandFood,
  handlePutNutritionEntry,
  handlePutNutritionEntryItem,
  handlePutNutritionGoals,
  handlePutNutritionRecipe,
  handleSearchNutritionItems,
} from './nutrition';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDir, '..');
const devPortAttempts = 20;

type AsyncRouteHandler = (request: Request, response: Response) => Promise<void> | void;
type DependencyRouteHandler = (request: Request, response: Response, dependencies: ServerRequestDependencies) => Promise<void> | void;

interface CreateAppOptions {
  authConfig?: Partial<ServerAuthConfig>;
  attachFrontend?: boolean;
  environment?: string;
  ownerEmail?: string;
  postgresConfig?: PostgresConfigSource;
  tokenValidator?: AccessTokenValidator;
}

function resolveAuthConfig(options: CreateAppOptions) {
  const baseAuthConfig = readServerAuthConfig();
  return validateResolvedServerAuthConfig({
    ...baseAuthConfig,
    ...options.authConfig,
    ownerEmail: normalizeEmail(options.authConfig?.ownerEmail ?? baseAuthConfig.ownerEmail),
  }, options.environment);
}

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

function route(handler: AsyncRouteHandler) {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response)).catch(next);
  };
}

function routeWithDependencies(root: ReturnType<typeof createServerCompositionRoot>, handler: DependencyRouteHandler) {
  return route((request, response) => handler(request, response, root.forRequest(request)));
}

function registerApiRoutes(app: Express, root: ReturnType<typeof createServerCompositionRoot>) {
  const withDeps = (handler: DependencyRouteHandler) => routeWithDependencies(root, handler);
  app.get('/api/auth/session', (request, response) => {
    const authContext = getRequestAuthContext(request);
    response
      .set('Cache-Control', 'no-store')
      .status(200)
      .json({ ok: true, user: { email: authContext.email } });
  });
  app.get('/api/ai/attachments/health', route(handleGetAiAttachmentHealth));
  app.post('/api/ai/attachments/parse', express.json({ limit: '35mb' }), route(handleParseAiAttachment));
  app.use(express.json({ limit: '2mb' }));
  app.get('/api/ai/workspace', withDeps(handleGetAiWorkspace));
  app.put('/api/ai/workspace', withDeps(handlePutAiWorkspace));
  app.get('/api/ai/preferences', withDeps(handleGetAiPreferences));
  app.get('/api/ai/runtime-config', route(handleGetAiRuntimeConfig));
  app.get('/api/ai/model-capabilities', route(handleGetAiModelCapabilities));
  app.post('/api/ai/chat/stream', route(handlePostAiChatStream));
  app.post('/api/ai/chats/:chatId/memory-refresh', withDeps(handlePostAiMemoryRefresh));
  app.get('/api/ai/chats/:chatId/artifacts', withDeps(handleListArtifacts));
  app.post('/api/ai/chats/:chatId/artifacts', withDeps(handleCreateArtifact));
  app.get('/api/ai/chats/:chatId/artifacts/:artifactId', withDeps(handleGetArtifact));
  app.patch('/api/ai/chats/:chatId/artifacts/:artifactId', withDeps(handlePatchArtifact));
  app.delete('/api/ai/chats/:chatId/artifacts/:artifactId', withDeps(handleDeleteArtifact));
  app.get('/api/ai/chats/:chatId/artifacts/:artifactId/lines', withDeps(handleFetchArtifactLines));
  app.post('/api/ai/chats/:chatId/artifacts/:artifactId/search', withDeps(handleSearchArtifact));
  app.get('/api/ai/chats/:chatId/artifacts/:artifactId/outline', withDeps(handleGetArtifactOutline));
  app.get('/api/ai/chats/:chatId/artifacts/:artifactId/versions', withDeps(handleListArtifactVersions));
  app.post('/api/ai/chats/:chatId/artifacts/:artifactId/versions/:versionId/restore', withDeps(handleRestoreArtifactVersion));
  app.post('/api/ai/chats/:chatId/artifacts/:artifactId/export-to-doc', withDeps(handleExportArtifactToDoc));
  app.post('/api/ai/chats/:chatId/artifacts/:artifactId/table', withDeps(handleUpdateArtifactTable));
  app.get('/api/docs', withDeps(handleListDocs));
  app.post('/api/docs', withDeps(handleCreateDoc));
  app.get('/api/docs/preferences', withDeps(handleGetDocPreferences));
  app.put('/api/docs/preferences', withDeps(handlePutDocPreferences));
  app.get('/api/docs/migration/status', withDeps(handleGetDocsMigrationStatus));
  app.post('/api/docs/migration/import', withDeps(handleImportDocsMigration));
  app.get('/api/docs/:docId', withDeps(handleGetDoc));
  app.put('/api/docs/:docId', withDeps(handlePutDoc));
  app.delete('/api/docs/:docId', withDeps(handleDeleteDoc));
  app.post('/api/docs/:docId/duplicate', withDeps(handleDuplicateDoc));
  app.post('/api/docs/:docId/trash', withDeps(handleTrashDoc));
  app.delete('/api/docs/:docId/trash', withDeps(handleRestoreDoc));
  app.get('/api/docs/:docId/tabs', withDeps(handleGetDocTabs));
  app.post('/api/docs/:docId/tabs', withDeps(handlePostDocTab));
  app.put('/api/docs/:docId/tabs/:tabId', withDeps(handlePutDocTab));
  app.delete('/api/docs/:docId/tabs/:tabId', withDeps(handleDeleteDocTab));
  app.get('/api/docs/:docId/versions', withDeps(handleListDocVersions));
  app.post('/api/docs/:docId/versions', withDeps(handleCreateDocVersion));
  app.get('/api/docs/:docId/versions/:versionId', withDeps(handleGetDocVersion));
  app.post('/api/docs/:docId/versions/:versionId/restore', withDeps(handleRestoreDocVersion));
  app.get('/api/docs/:docId/citations', withDeps(handleGetDocCitations));
  app.post('/api/docs/:docId/citations', withDeps(handleSaveDocCitations));
  app.put('/api/docs/:docId/citations', withDeps(handleSaveDocCitations));
  app.delete('/api/docs/:docId/citations/:citationId', withDeps(handleDeleteDocCitation));
  app.get('/api/workout/bootstrap', withDeps(handleGetWorkoutBootstrap));
  app.get('/api/workout/history', withDeps(handleGetWorkoutHistory));
  app.post('/api/workout/routines', withDeps(handleCreateWorkoutRoutine));
  app.put('/api/workout/routines/:routineId', withDeps(handlePutWorkoutRoutine));
  app.delete('/api/workout/routines/:routineId', withDeps(handleDeleteWorkoutRoutine));
  app.post('/api/workout/exercises', withDeps(handleCreateWorkoutExercise));
  app.post('/api/workout/sessions/empty', withDeps(handleStartEmptyWorkoutSession));
  app.post('/api/workout/sessions/log', withDeps(handleLogWorkoutSession));
  app.post('/api/workout/sessions/from-routine/:routineId', withDeps(handleStartRoutineWorkoutSession));
  app.get('/api/workout/sessions/:sessionId', withDeps(handleGetWorkoutSession));
  app.put('/api/workout/sessions/:sessionId', withDeps(handlePutWorkoutSession));
  app.post('/api/workout/sessions/:sessionId/finish', withDeps(handleFinishWorkoutSession));
  app.delete('/api/workout/sessions/:sessionId', withDeps(handleDeleteWorkoutSession));
  app.get('/api/nutrition/bootstrap', withDeps(handleGetNutritionBootstrap));
  app.get('/api/nutrition/search', withDeps(handleSearchNutritionItems));
  app.post('/api/nutrition/ai-food-log', withDeps(handlePostNutritionAiFoodLog));
  app.get('/api/nutrition/history', withDeps(handleGetNutritionHistory));
  app.get('/api/nutrition/goals', withDeps(handleGetNutritionGoals));
  app.put('/api/nutrition/goals', withDeps(handlePutNutritionGoals));
  app.get('/api/nutrition/recipes', withDeps(handleListNutritionRecipes));
  app.post('/api/nutrition/recipes', withDeps(handleCreateNutritionRecipe));
  app.put('/api/nutrition/recipes/:recipeId', withDeps(handlePutNutritionRecipe));
  app.post('/api/nutrition/foods/brands', withDeps(handleCreateNutritionBrandFood));
  app.put('/api/nutrition/foods/brands/:foodId', withDeps(handlePutNutritionBrandFood));
  app.post('/api/nutrition/entries', withDeps(handleCreateNutritionEntry));
  app.put('/api/nutrition/entries/:entryId', withDeps(handlePutNutritionEntry));
  app.delete('/api/nutrition/entries/:entryId', withDeps(handleDeleteNutritionEntry));
  app.post('/api/nutrition/entries/:entryId/items', withDeps(handleCreateNutritionEntryItem));
  app.put('/api/nutrition/entries/:entryId/items/:itemId', withDeps(handlePutNutritionEntryItem));
  app.delete('/api/nutrition/entries/:entryId/items/:itemId', withDeps(handleDeleteNutritionEntryItem));
  app.get('/api/ai/attachments/:attachmentId', route(handleGetAiAttachment));
  app.get('/api/ai/attachments/:attachmentId/context', route(handleGetAiAttachmentContext));
  app.post('/api/ai/attachments/:attachmentId/image-analysis', route(handlePostAiImageAnalysis));
  app.post('/api/ai/attachments/:attachmentId/image-compare', route(handlePostAiImageCompare));
  app.post('/api/ai/attachments/:attachmentId/image-describe', withDeps(handlePostAiImageDescribe));
  app.post('/api/ai/attachments/:attachmentId/image-query', withDeps(handlePostAiImageQuestion));
  app.get('/api/ai/attachments/:attachmentId/pdf/search', route(handleSearchAiPdf));
  app.get('/api/ai/attachments/:attachmentId/pdf/pages', route(handleGetAiPdfPages));
  app.get('/api/ai/attachments/:attachmentId/pdf/pages/:pageNumber', route(handleGetAiPdfPage));
  app.get('/api/ai/attachments/:attachmentId/pdf/pages/:pageNumber/image', route(handleGetAiPdfPageImage));
  app.delete('/api/ai/attachments/:attachmentId', route(handleDeleteAiAttachment));
  app.get('/api/web-search', route(handleWebSearch));
  app.get('/api/fetch-url', route(handleUrlFetch));
  app.post('/api/python-exec', route(handlePythonExec));
  app.get('/api/ai/chats/:chatId/python-exec/files/*', route(handlePythonExecFileDownload));
  app.get('/api/automations', withDeps(handleListAutomations));
  app.post('/api/automations', withDeps(handleCreateAutomation));
  app.post('/api/automations/claim-due', withDeps(handleClaimDueAutomations));
  app.get('/api/automations/:automationId', withDeps(handleGetAutomation));
  app.put('/api/automations/:automationId', withDeps(handlePutAutomation));
  app.delete('/api/automations/:automationId', withDeps(handleDeleteAutomation));
  app.post('/api/automations/:automationId/toggle', withDeps(handleToggleAutomation));
  app.post('/api/automations/:automationId/report-run', withDeps(handleReportAutomationRun));
  app.get('/api/calendar/bootstrap', withDeps(handleGetCalendarBootstrap));
  app.get('/api/calendar/calendars', withDeps(handleListCalendarCalendars));
  app.post('/api/calendar/calendars', withDeps(handleCreateCalendarCalendar));
  app.put('/api/calendar/calendars/:calendarId', withDeps(handlePutCalendarCalendar));
  app.delete('/api/calendar/calendars/:calendarId', withDeps(handleDeleteCalendarCalendar));
  app.get('/api/calendar/categories', withDeps(handleListCalendarCategories));
  app.post('/api/calendar/categories', withDeps(handleCreateCalendarCategory));
  app.put('/api/calendar/categories/:categoryId', withDeps(handlePutCalendarCategory));
  app.delete('/api/calendar/categories/:categoryId', withDeps(handleDeleteCalendarCategory));
  app.get('/api/calendar/events', withDeps(handleListCalendarEvents));
  app.post('/api/calendar/events', withDeps(handleCreateCalendarEvent));
  app.put('/api/calendar/events/:eventId', withDeps(handlePutCalendarEvent));
  app.post('/api/calendar/events/:eventId/duplicate', withDeps(handleDuplicateCalendarEvent));
  app.post('/api/calendar/events/:eventId/trash', withDeps(handleTrashCalendarEvent));
  app.delete('/api/calendar/events/:eventId/trash', withDeps(handleRestoreCalendarEvent));
  app.delete('/api/calendar/events/:eventId', withDeps(handleDeleteCalendarEvent));
  app.post('/api/calendar/events/:eventId/occurrences/:occurrenceKey', withDeps(handleSaveCalendarOccurrence));
  app.get('/api/calendar/tasks', withDeps(handleListCalendarTasks));
  app.post('/api/calendar/tasks', withDeps(handleCreateCalendarTask));
  app.put('/api/calendar/tasks/:taskId', withDeps(handlePutCalendarTask));
  app.delete('/api/calendar/tasks/:taskId', withDeps(handleDeleteCalendarTask));
  app.put('/api/calendar/settings', withDeps(handlePutCalendarSettings));
  app.post('/api/calendar/undo', withDeps(handlePostCalendarUndo));
  app.get('/api/skills', withDeps(handleListSkills));
  app.post('/api/skills', withDeps(handleCreateSkill));
  app.get('/api/skills/by-name/:name', withDeps(handleGetSkillByName));
  app.get('/api/skills/:skillId', withDeps(handleGetSkill));
  app.put('/api/skills/:skillId', withDeps(handlePutSkill));
  app.delete('/api/skills/:skillId', withDeps(handleDeleteSkill));
  app.post('/api/skills/:skillId/toggle', withDeps(handleToggleSkill));
}

function registerErrorHandler(app: Express) {
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const { statusCode, message } = toHttpErrorResponse(error);
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

export async function createApp(mode: 'dev' | 'preview', options: CreateAppOptions = {}) {
  validatePostgresConfig(options.postgresConfig, options.environment);
  const compositionRoot = createServerCompositionRoot({
    environment: options.environment,
    postgresConfig: options.postgresConfig,
  });
  const authConfig = resolveAuthConfig(options);
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', createRequireOwnerMiddleware({
    ownerEmail: options.ownerEmail ?? authConfig.ownerEmail,
    tokenValidator: options.tokenValidator ?? createSupabaseTokenValidator(authConfig),
  }));
  registerApiRoutes(app, compositionRoot);

  if (options.attachFrontend !== false) {
    if (mode === 'preview') {
      attachPreviewApp(app);
    } else {
      await attachDevApp(app);
    }
  }

  registerErrorHandler(app);
  return app;
}

export async function startApp(mode: 'dev' | 'preview') {
  installPostgresPoolShutdownHandlers();
  const app = await createApp(mode);
  const { server, port } = await listenWithDevFallback(app, mode);
  server.once('close', () => {
    void closePostgresPool();
  });
  console.log(`Local app server running at http://127.0.0.1:${port} (${mode})`);
  return server;
}
