import { join } from 'path';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';

import { Database as SQLiteDatabase } from 'sqlite3';

import { 
  Result, 
  Database, 
  TransactionFn 
} from './types';
import { DatabaseMigrator } from './migrator';
import { ProjectRepositoryImpl } from './repositories/projects';
import { ExecutionRepositoryImpl } from './repositories/executions';
import { EventRepositoryImpl } from './repositories/events';

export class DatabaseService implements Database {
  private db: SQLiteDatabase | null = null;
  private migrator: DatabaseMigrator | null = null;
  private dbPath: string;
  
  // Repository instances
  public projects: ProjectRepositoryImpl;
  public executions: ExecutionRepositoryImpl;
  public events: EventRepositoryImpl;

  constructor(dbPath?: string) {
    // Default to ~/.killall/killall.db if no path provided
    this.dbPath = dbPath || join(homedir(), '.killall', 'killall.db');
    
    // Initialize repositories as null - they'll be created after connection
    this.projects = null as any;
    this.executions = null as any;
    this.events = null as any;
  }

  // Connect to the database and initialize repositories
  async connect(): Promise<Result<void>> {
    try {
      // Ensure the directory exists
      const dbDir = join(this.dbPath, '..');
      if (!existsSync(dbDir)) {
        await mkdir(dbDir, { recursive: true });
      }

      // Create database connection
      return new Promise((resolve) => {
        this.db = new SQLiteDatabase(this.dbPath, (err) => {
          if (err) {
            resolve({ ok: false, error: err });
            return;
          }

          if (!this.db) {
            resolve({ ok: false, error: new Error('Failed to create database connection') });
            return;
          }

          // Enable foreign key constraints
          this.db.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
            if (pragmaErr) {
              resolve({ ok: false, error: pragmaErr });
              return;
            }

            // Initialize repositories
            this.projects = new ProjectRepositoryImpl(this.db!);
            this.executions = new ExecutionRepositoryImpl(this.db!);
            this.events = new EventRepositoryImpl(this.db!);

            // Initialize migrator
            this.migrator = new DatabaseMigrator(this.db!);

            resolve({ ok: true, value: undefined });
          });
        });
      });
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Run database migrations
  async migrate(): Promise<Result<number>> {
    if (!this.migrator) {
      return { ok: false, error: new Error('Database not connected') };
    }

    return await this.migrator.migrate();
  }

  // Disconnect from the database
  async disconnect(): Promise<Result<void>> {
    if (!this.db) {
      return { ok: true, value: undefined };
    }

    return new Promise((resolve) => {
      this.db!.close((err) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          this.db = null;
          this.migrator = null;
          resolve({ ok: true, value: undefined });
        }
      });
    });
  }

  // Execute a function within a database transaction
  async transaction<T>(fn: TransactionFn<T>): Promise<Result<T>> {
    if (!this.db) {
      return { ok: false, error: new Error('Database not connected') };
    }

    return new Promise((resolve) => {
      const db = this.db!;
      
      // Start transaction
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (beginErr) => {
          if (beginErr) {
            resolve({ ok: false, error: beginErr });
            return;
          }

          // Execute the function with the database instance
          fn(db)
            .then((result) => {
              // Commit on success
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  db.run('ROLLBACK');
                  resolve({ ok: false, error: commitErr });
                } else {
                  resolve({ ok: true, value: result });
                }
              });
            })
            .catch((error) => {
              // Rollback on error
              db.run('ROLLBACK', () => {
                resolve({ ok: false, error });
              });
            });
        });
      });
    });
  }

  // Convenience method to check database connection
  isConnected(): boolean {
    return this.db !== null;
  }

  // Get database file path
  getPath(): string {
    return this.dbPath;
  }

  // Health check - verify database connectivity and basic operations
  async healthCheck(): Promise<Result<{ connected: boolean; migrationsApplied: number }>> {
    if (!this.db || !this.migrator) {
      return { 
        ok: false, 
        error: new Error('Database not connected') 
      };
    }

    try {
      // Test basic query
      const testQuery = new Promise<void>((resolve, reject) => {
        this.db!.get('SELECT 1 as test', (err, row) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await testQuery;

      // Get migration history count
      const historyResult = await this.migrator.getHistory();
      if (!historyResult.ok) {
        return historyResult;
      }

      return {
        ok: true,
        value: {
          connected: true,
          migrationsApplied: historyResult.value.length
        }
      };
    } catch (error) {
      return { 
        ok: false, 
        error: error as Error 
      };
    }
  }

  // Database maintenance operations
  async vacuum(): Promise<Result<void>> {
    if (!this.db) {
      return { ok: false, error: new Error('Database not connected') };
    }

    return new Promise((resolve) => {
      this.db!.run('VACUUM', (err) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          resolve({ ok: true, value: undefined });
        }
      });
    });
  }

  // Get database statistics
  async getStats(): Promise<Result<{
    projectCount: number;
    executionCount: number;
    eventCount: number;
    dbSizeBytes?: number;
  }>> {
    if (!this.db) {
      return { ok: false, error: new Error('Database not connected') };
    }

    return new Promise((resolve) => {
      const queries = [
        'SELECT COUNT(*) as count FROM projects',
        'SELECT COUNT(*) as count FROM executions',
        'SELECT COUNT(*) as count FROM events'
      ];

      let completed = 0;
      const results: number[] = [];

      queries.forEach((query, index) => {
        this.db!.get(query, (err, row: any) => {
          if (err) {
            resolve({ ok: false, error: err });
            return;
          }

          results[index] = row.count;
          completed++;

          if (completed === queries.length) {
            resolve({
              ok: true,
              value: {
                projectCount: results[0],
                executionCount: results[1],
                eventCount: results[2]
              }
            });
          }
        });
      });
    });
  }
}

// Export types and implementations
export * from './types';
export { DatabaseMigrator } from './migrator';
export { ProjectRepositoryImpl } from './repositories/projects';
export { ExecutionRepositoryImpl } from './repositories/executions';
export { EventRepositoryImpl } from './repositories/events';