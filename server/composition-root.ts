import type { Request } from 'express';
import { getRequestAuthContext } from './auth/request-context';
import { createAiMemoryService } from './ai-memory-service';
import { createAutomationsService } from './automations-service';
import { createSkillsService } from './skills-service';
import { getPostgresPool } from './db/postgres';
import { createPostgresAiArtifactsRepository } from './db/postgres-ai-artifacts-repository';
import { createPostgresAiWorkspaceRepository } from './db/postgres-ai-workspace-repository';
import { createPostgresAutomationsRepository } from './db/postgres-automations-repository';
import { createPostgresCalendarRepository } from './db/postgres-calendar-repository';
import { createPostgresDocsRepository } from './db/postgres-docs-repository';
import { createPostgresNutritionRepository } from './db/postgres-nutrition-repository';
import { getOwnerUuidFromRequestContext } from './db/postgres-repository-utils';
import { createPostgresSkillsRepository } from './db/postgres-skills-repository';
import { createPostgresWorkoutRepository } from './db/postgres-workout-repository';
import type { PostgresConfigSource } from './db/postgres-config';

interface ServerCompositionRootOptions {
  environment?: string;
  postgresConfig?: PostgresConfigSource;
}

export function createServerCompositionRoot(options: ServerCompositionRootOptions = {}) {
  const pool = getPostgresPool(options.postgresConfig, options.environment);

  return {
    forRequest(request: Request) {
      const ownerId = getOwnerUuidFromRequestContext(getRequestAuthContext(request).userId);
      const docsRepository = createPostgresDocsRepository(ownerId, pool);
      const aiWorkspaceRepository = createPostgresAiWorkspaceRepository(ownerId, pool);
      const skillsRepository = createPostgresSkillsRepository(ownerId, pool);
      const skillsService = createSkillsService(skillsRepository);

      return {
        ownerId,
        aiArtifactsRepository: createPostgresAiArtifactsRepository(ownerId, pool, { docsRepo: docsRepository }),
        aiMemoryService: createAiMemoryService(aiWorkspaceRepository),
        aiWorkspaceRepository,
        automationsService: createAutomationsService(createPostgresAutomationsRepository(ownerId, pool), skillsService),
        calendarRepository: createPostgresCalendarRepository(ownerId, pool),
        docsRepository,
        loadAiVisionMode: async () => (await aiWorkspaceRepository.loadAiPreferences()).visionMode,
        nutritionRepository: createPostgresNutritionRepository(ownerId, pool),
        skillsService,
        workoutRepository: createPostgresWorkoutRepository(ownerId, pool),
      };
    },
  };
}

export type ServerRequestDependencies = ReturnType<ReturnType<typeof createServerCompositionRoot>['forRequest']>;
