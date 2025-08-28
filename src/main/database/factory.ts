import { Result } from '../../shared/utils/result';
import { DatabaseService } from './index';
import { createConnection as createDrizzleConnection, DrizzleConnection } from './drizzle/connection';

export interface DatabaseFactory {
  readonly createDatabase: () => Result<DatabaseService | DrizzleConnection>;
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
 * const dbResult = factory.createDatabase();
 * if (dbResult.ok) {
 *   if (factory.useDrizzle) {
 *     // Use as DrizzleConnection
 *   } else {
 *     // Use as DatabaseService
 *   }
 * }
 */
export const createDatabaseFactory = (
  databasePath: string
): DatabaseFactory => {
  const useDrizzle = process.env.USE_DRIZZLE === 'true';
  
  const createDatabase = (): Result<DatabaseService | DrizzleConnection> => {
    if (useDrizzle) {
      return createDrizzleConnection({
        databasePath,
        verbose: process.env.NODE_ENV === 'development',
        maxRetries: 3,
        retryDelay: 100
      });
    }
    
    // Use existing DatabaseService for backward compatibility
    try {
      const database = new DatabaseService(databasePath);
      const initResult = database.initialize();
      
      if (!initResult.ok) {
        return initResult as Result<never>;
      }
      
      return { ok: true, value: database };
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
 * Type guard to check if database is a Drizzle connection.
 * 
 * @param db - Database instance to check
 * @returns True if the database is a Drizzle connection
 */
export const isDrizzleConnection = (
  db: DatabaseService | DrizzleConnection
): db is DrizzleConnection => {
  // Check for Drizzle-specific methods
  return 'run' in db && typeof (db as any).run === 'function';
};

/**
 * Type guard to check if database is the legacy DatabaseService.
 * 
 * @param db - Database instance to check
 * @returns True if the database is a DatabaseService
 */
export const isDatabaseService = (
  db: DatabaseService | DrizzleConnection
): db is DatabaseService => {
  // Check for DatabaseService-specific methods
  return 'initialize' in db && typeof (db as any).initialize === 'function';
};

/**
 * Gets the appropriate database instance based on environment configuration.
 * This is a convenience function for quick setup.
 * 
 * @returns Result containing the database instance
 */
export const getDatabase = (): Result<DatabaseService | DrizzleConnection> => {
  const databasePath = process.env.DATABASE_PATH || './killall-tofu.db';
  const factory = createDatabaseFactory(databasePath);
  return factory.createDatabase();
};