import { readFileSync } from 'fs';
import { join } from 'path';

import { Database as SQLiteDatabase } from 'sqlite3';

import { Result } from './types';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

interface MigrationRecord {
  version: number;
  name: string;
  applied_at: string;
}

export class DatabaseMigrator {
  private db: SQLiteDatabase;
  private migrationsPath: string;

  constructor(db: SQLiteDatabase, migrationsPath?: string) {
    this.db = db;
    this.migrationsPath = migrationsPath || join(__dirname, 'migrations');
  }

  // Initialize the migrations tracking table
  private async initializeMigrationsTable(): Promise<Result<void>> {
    return new Promise((resolve) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      this.db.run(sql, (err) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          resolve({ ok: true, value: undefined });
        }
      });
    });
  }

  // Get the current database schema version
  private async getCurrentVersion(): Promise<Result<number>> {
    return new Promise((resolve) => {
      const sql = 'SELECT MAX(version) as version FROM schema_migrations';

      this.db.get(sql, (err, row: { version: number | null } | undefined) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          const version = row?.version || 0;
          resolve({ ok: true, value: version });
        }
      });
    });
  }

  // Load available migration files
  private loadMigrations(): Result<Migration[]> {
    try {
      const fs = require('fs');
      const files = fs.readdirSync(this.migrationsPath);
      
      const migrations: Migration[] = files
        .filter((file: string) => file.endsWith('.sql'))
        .map((file: string) => {
          const match = file.match(/^(\d+)_(.+)\.sql$/);
          if (!match) {
            throw new Error(`Invalid migration filename: ${file}`);
          }

          const version = parseInt(match[1], 10);
          const name = match[2];
          const filePath = join(this.migrationsPath, file);
          const sql = readFileSync(filePath, 'utf-8');

          return { version, name, sql };
        })
        .sort((a: Migration, b: Migration) => a.version - b.version);

      return { ok: true, value: migrations };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Apply a single migration using exec for multi-statement support
  private async applyMigration(migration: Migration): Promise<Result<void>> {
    return new Promise((resolve) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION', (beginErr) => {
          if (beginErr) {
            resolve({ ok: false, error: beginErr });
            return;
          }

          // Use exec for multi-statement SQL execution
          this.db.exec(migration.sql, (execErr) => {
            if (execErr) {
              this.db.run('ROLLBACK');
              resolve({ ok: false, error: new Error(`Migration SQL failed: ${execErr.message}`) });
              return;
            }

            // Record the migration as applied
            const recordSql = `
              INSERT INTO schema_migrations (version, name) 
              VALUES (?, ?)
            `;

            this.db.run(recordSql, [migration.version, migration.name], (recordErr) => {
              if (recordErr) {
                this.db.run('ROLLBACK');
                resolve({ ok: false, error: recordErr });
                return;
              }

              this.db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  resolve({ ok: false, error: commitErr });
                } else {
                  resolve({ ok: true, value: undefined });
                }
              });
            });
          });
        });
      });
    });
  }

  // Run all pending migrations
  async migrate(): Promise<Result<number>> {
    // Initialize migrations table
    const initResult = await this.initializeMigrationsTable();
    if (!initResult.ok) {
      return initResult;
    }

    // Get current version
    const versionResult = await this.getCurrentVersion();
    if (!versionResult.ok) {
      return versionResult;
    }

    const currentVersion = versionResult.value;

    // Load available migrations
    const migrationsResult = this.loadMigrations();
    if (!migrationsResult.ok) {
      return migrationsResult;
    }

    const migrations = migrationsResult.value;
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);

    if (pendingMigrations.length === 0) {
      return { ok: true, value: 0 };
    }

    // Apply pending migrations in order
    for (const migration of pendingMigrations) {
      const applyResult = await this.applyMigration(migration);
      if (!applyResult.ok) {
        return {
          ok: false,
          error: new Error(
            `Migration ${migration.version}_${migration.name} failed: ${applyResult.error.message}`
          )
        };
      }
    }

    return { ok: true, value: pendingMigrations.length };
  }

  // Get migration history
  async getHistory(): Promise<Result<MigrationRecord[]>> {
    return new Promise((resolve) => {
      const sql = `
        SELECT version, name, applied_at 
        FROM schema_migrations 
        ORDER BY version ASC
      `;

      this.db.all(sql, (err, rows: MigrationRecord[]) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          resolve({ ok: true, value: rows || [] });
        }
      });
    });
  }
}