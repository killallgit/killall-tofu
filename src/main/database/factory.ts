import { Result } from '../../shared/types';

import { 
  Database,
  ProjectRepository,
  ExecutionRepository,
  EventRepository
} from './types';
import { createConnection as createDrizzleConnection, DrizzleConnection } from './drizzle/connection';
import { createDrizzleRepositories, DrizzleRepositories } from './drizzle/repositories';

import { DatabaseService } from './index';

export interface DatabaseWithRepositories extends Database {
  projects: ProjectRepository;
  executions: ExecutionRepository;
  events: EventRepository;
}

export interface DatabaseFactory {
  readonly createDatabase: () => Promise<Result<DatabaseWithRepositories>>;
  readonly useDrizzle: boolean;
}

/**
 * Creates a database factory that switches between raw SQL and Drizzle implementations.
 * Uses the USE_DRIZZLE environment variable to determine which implementation to use.
 * 
 * @param databasePath - Path to the SQLite database file
 * @returns Database factory with implementation switcher
 * 
 * @example
 * const factory = createDatabaseFactory('./killall-tofu.db');
 * const dbResult = await factory.createDatabase();
 * if (dbResult.ok) {
 *   const db = dbResult.value;
 *   // Use db.projects, db.executions, db.events
 * }
 */
export const createDatabaseFactory = (
  databasePath: string
): DatabaseFactory => {
  const useDrizzle = process.env.USE_DRIZZLE === 'true';
  
  const createDatabase = async (): Promise<Result<DatabaseWithRepositories>> => {
    if (useDrizzle) {
      console.log('[Database Factory] Using Drizzle ORM implementation');
      
      // Create Drizzle connection
      const connectionResult = createDrizzleConnection({
        databasePath,
        verbose: process.env.NODE_ENV === 'development',
        maxRetries: 3,
        retryDelay: 100
      });

      if (!connectionResult.ok) {
        return connectionResult;
      }

      const drizzleDb = connectionResult.value;
      const repositories = createDrizzleRepositories(drizzleDb);

      // Create a wrapper that implements the Database interface
      const database: DatabaseWithRepositories = {
        projects: repositories.projects,
        executions: repositories.executions,
        events: repositories.events,
        
        async connect(): Promise<Result<void>> {
          // Connection already established in createDrizzleConnection
          return { ok: true, value: undefined };
        },
        
        async disconnect(): Promise<Result<void>> {
          try {
            // Close the underlying SQLite connection
            const sqlite = (drizzleDb as any).session?.client;
            if (sqlite && typeof sqlite.close === 'function') {
              sqlite.close();
            }
            return { ok: true, value: undefined };
          } catch (error) {
            return {
              ok: false,
              error: error instanceof Error ? error : new Error(String(error))
            };
          }
        },
        
        async transaction<T>(fn: (tx: any) => Promise<T>): Promise<Result<T>> {
          try {
            const result = await drizzleDb.transaction(async (tx) => {
              return await fn(tx);
            });
            return { ok: true, value: result as T };
          } catch (error) {
            return {
              ok: false,
              error: error instanceof Error ? error : new Error(String(error))
            };
          }
        }
      };

      return { ok: true, value: database };
    }
    
    // Use existing DatabaseService for backward compatibility
    console.log('[Database Factory] Using legacy SQL implementation');
    
    try {
      const database = new DatabaseService(databasePath);
      const connectResult = await database.connect();
      
      if (!connectResult.ok) {
        return connectResult;
      }

      // DatabaseService already has projects, executions, events properties
      return { ok: true, value: database as DatabaseWithRepositories };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to create database: ${String(error)}`)
      };
    }
  };
  
  return {
    createDatabase,
    useDrizzle
  };
};

/**
 * Gets the appropriate database instance based on environment configuration.
 * This is a convenience function for quick setup.
 * 
 * @returns Result containing the database instance with repositories
 */
export const getDatabase = async (): Promise<Result<DatabaseWithRepositories>> => {
  const databasePath = process.env.DATABASE_PATH || './killall-tofu.db';
  const factory = createDatabaseFactory(databasePath);
  return factory.createDatabase();
};

/**
 * Helper to check if Drizzle is enabled.
 */
export const isDrizzleEnabled = (): boolean => {
  return process.env.USE_DRIZZLE === 'true';
};