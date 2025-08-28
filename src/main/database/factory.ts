import { Result } from '../../shared/types';

import { createConnection as createDrizzleConnection, DrizzleConnection } from './drizzle/connection';

import { DatabaseService } from './index';

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
      // Note: DatabaseService requires async connect(), but we return synchronously
      // The connection will need to be established separately
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
  // Check for Drizzle-specific properties and methods
  // Drizzle connections have a 'run' method and session property
  const possibleDrizzle = db as any;
  return (
    typeof possibleDrizzle.run === 'function' &&
    typeof possibleDrizzle.all === 'function' &&
    typeof possibleDrizzle.get === 'function' &&
    typeof possibleDrizzle.values === 'function' &&
    possibleDrizzle._ !== undefined // Drizzle internal property
  );
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
  // Check for DatabaseService-specific methods and properties
  const possibleService = db as any;
  return (
    typeof possibleService.connect === 'function' &&
    typeof possibleService.close === 'function' &&
    typeof possibleService.runMigrations === 'function' &&
    possibleService.projects !== undefined &&
    possibleService.executions !== undefined &&
    possibleService.events !== undefined &&
    !possibleService._ // Ensure it's not Drizzle (which has _ property)
  );
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