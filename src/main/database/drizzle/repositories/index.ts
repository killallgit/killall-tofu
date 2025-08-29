/**
 * Drizzle ORM Repository Exports
 * 
 * Central export point for all Drizzle repository implementations.
 * These repositories follow functional programming principles with:
 * - Result type error handling
 * - No global state
 * - Pure functions where possible
 * - Immutable operations
 */

export { BaseDrizzleRepository } from './base';
export type { IRepository, BatchResult } from './base';
export { processBatch } from './base';

// Import repository classes for factory
import { DrizzleProjectRepository, projectQueries } from './projects';
import { DrizzleExecutionRepository, executionQueries } from './executions';
import { DrizzleEventRepository, eventQueries } from './events';

// Re-export them
export { DrizzleProjectRepository, projectQueries };
export { DrizzleExecutionRepository, executionQueries };
export { DrizzleEventRepository, eventQueries };

// Re-export schema types for convenience
export type { 
  Project, 
  NewProject, 
  ProjectStatusType 
} from '../schema/projects';

export type { 
  Execution, 
  NewExecution 
} from '../schema/executions';

export type { 
  Event, 
  NewEvent 
} from '../schema/events';

/**
 * Factory function to create all repositories with a single database connection.
 * Ensures consistent database instance across all repositories.
 */
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { 
  ProjectRepository,
  ExecutionRepository,
  EventRepository
} from '../../types';

export interface DrizzleRepositories {
  projects: ProjectRepository;
  executions: ExecutionRepository;
  events: EventRepository;
}

export const createDrizzleRepositories = (
  db: BetterSQLite3Database
): DrizzleRepositories => {
  return {
    projects: new DrizzleProjectRepository(db),
    executions: new DrizzleExecutionRepository(db),
    events: new DrizzleEventRepository(db)
  };
};