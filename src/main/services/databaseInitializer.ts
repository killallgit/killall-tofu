import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { getDatabase } from '../database/factory';
import type { Result } from '../../shared/types';

/**
 * Database initialization service
 * Ensures the ~/.killall directory exists and database is properly initialized
 */

const KILLALL_DIR = path.join(os.homedir(), '.killall');
const DB_PATH = path.join(KILLALL_DIR, 'killall.db');

export interface DatabaseInitResult {
  directory: string;
  databasePath: string;
  wasCreated: boolean;
}

/**
 * Initialize the database directory and database file if they don't exist
 */
export const initializeDatabase = async (): Promise<Result<DatabaseInitResult>> => {
  try {
    let wasCreated = false;

    // Check if ~/.killall directory exists
    try {
      await fs.access(KILLALL_DIR);
    } catch {
      // Directory doesn't exist, create it
      console.log(`Creating killall directory at: ${KILLALL_DIR}`);
      await fs.mkdir(KILLALL_DIR, { recursive: true });
      wasCreated = true;
    }

    // Set environment variables for the database
    process.env.DATABASE_PATH = DB_PATH;
    process.env.USE_DRIZZLE = 'true';

    // Try to initialize database connection (this will create tables if needed)
    try {
      const dbResult = await getDatabase();
      if (!dbResult.ok) {
        console.warn(`Database initialization failed: ${(dbResult as any).error.message}`);
        console.log('Directory created successfully, but database connection failed.');
        console.log('This may be due to native module compilation issues. The CLI will still work.');
      } else {
        // Test the connection
        try {
          await dbResult.value.connect();
          console.log(`Database initialized successfully at: ${DB_PATH}`);
        } catch (error) {
          console.warn(`Database connection test failed: ${error instanceof Error ? error.message : String(error)}`);
          console.log('Directory exists, but database connection failed. CLI may have limited functionality.');
        }
      }
    } catch (error) {
      console.warn(`Database initialization error: ${error instanceof Error ? error.message : String(error)}`);
      console.log('Directory created, but database setup encountered issues.');
    }

    return {
      ok: true,
      value: {
        directory: KILLALL_DIR,
        databasePath: DB_PATH,
        wasCreated
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

/**
 * Clean/remove the entire killall directory
 * Useful for testing and fresh starts
 */
export const cleanDatabase = async (): Promise<Result<void>> => {
  try {
    console.log(`Cleaning killall directory: ${KILLALL_DIR}`);
    
    try {
      await fs.access(KILLALL_DIR);
      // Directory exists, remove it
      await fs.rm(KILLALL_DIR, { recursive: true, force: true });
      console.log('Killall directory cleaned successfully');
    } catch {
      // Directory doesn't exist, nothing to clean
      console.log('Killall directory does not exist, nothing to clean');
    }

    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};