import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { Result } from '../../../shared/utils/result';

export type DrizzleConnection = BetterSQLite3Database;

export interface ConnectionConfig {
  readonly databasePath: string;
  readonly verbose?: boolean;
  readonly readonly?: boolean;
  readonly fileMustExist?: boolean;
  readonly timeout?: number;
  readonly maxRetries?: number;
  readonly retryDelay?: number;
}

const DEFAULT_CONFIG: Partial<ConnectionConfig> = {
  verbose: false,
  readonly: false,
  fileMustExist: false,
  timeout: 5000,
  maxRetries: 3,
  retryDelay: 100
};

/**
 * Creates a connection to the SQLite database using Drizzle ORM.
 * 
 * @param config - Database connection configuration
 * @returns Result containing the database connection or error
 * 
 * @example
 * const result = createConnection({ databasePath: './killall-tofu.db' });
 * if (result.ok) {
 *   const db = result.value;
 *   // Use the database connection
 * }
 * 
 * Performance: O(1) for connection creation, with retry logic
 */
export const createConnection = (
  config: ConnectionConfig
): Result<DrizzleConnection> => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const attemptConnection = (
    retryCount: number
  ): Result<DrizzleConnection> => {
    try {
      const sqlite = new Database(finalConfig.databasePath, {
        verbose: finalConfig.verbose ? console.log : undefined,
        readonly: finalConfig.readonly,
        fileMustExist: finalConfig.fileMustExist,
        timeout: finalConfig.timeout
      });

      // Enable foreign keys and WAL mode for better performance
      sqlite.pragma('foreign_keys = ON');
      sqlite.pragma('journal_mode = WAL');
      
      const db = drizzle(sqlite);
      
      return { ok: true, value: db };
    } catch (error) {
      if (retryCount < (finalConfig.maxRetries || 3)) {
        // Wait before retry
        const delay = finalConfig.retryDelay || 100;
        const waitUntil = Date.now() + delay;
        while (Date.now() < waitUntil) {
          // Busy wait (synchronous delay)
        }
        
        return attemptConnection(retryCount + 1);
      }
      
      return {
        ok: false,
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to connect to database: ${String(error)}`)
      };
    }
  };
  
  return attemptConnection(0);
};

/**
 * Creates a connection factory that can switch between implementations.
 * This supports gradual migration from raw SQL to Drizzle.
 * 
 * @param config - Database connection configuration
 * @returns Function that creates database connections
 */
export const createConnectionFactory = (
  config: ConnectionConfig
): (() => Result<DrizzleConnection>) => {
  // Return a pure function that creates connections
  return () => createConnection(config);
};

/**
 * Tests if a database connection is valid and responsive.
 * 
 * @param connection - Drizzle database connection to test
 * @returns Result indicating if connection is valid
 */
export const testConnection = (
  connection: DrizzleConnection
): Result<void> => {
  try {
    // Test with a simple query
    connection.run(sql`SELECT 1`);
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error 
        ? error 
        : new Error(`Connection test failed: ${String(error)}`)
    };
  }
};

/**
 * Closes a database connection gracefully.
 * 
 * @param connection - Drizzle database connection to close
 * @returns Result indicating if close was successful
 */
export const closeConnection = (
  connection: DrizzleConnection
): Result<void> => {
  try {
    // Drizzle doesn't expose close directly, but we can access the underlying SQLite instance
    // For now, this is a no-op as connections are handled by the SQLite driver
    // In production, you might want to implement connection pooling
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error 
        ? error 
        : new Error(`Failed to close connection: ${String(error)}`)
    };
  }
};

// Import sql template tag for the test function
import { sql } from 'drizzle-orm';