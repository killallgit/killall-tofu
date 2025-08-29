// Configuration Repository Implementation
// Persists application configuration using the database service

import { Database, Result } from '../database/types';

import { AppConfig, ConfigRepository } from './configManager';
import { createDefaultConfig } from './configManager';

export class DatabaseConfigRepository implements ConfigRepository {
  private readonly database: Database;
  private readonly configKey = 'app_config';
  private readonly tableName = 'app_configurations';

  constructor(database: Database) {
    this.database = database;
  }

  // Initialize the configuration table if it doesn't exist
  async initialize(): Promise<Result<void>> {
    try {
      // Create the configuration table directly for now
      // In production, this should be handled by the migration system
      const result = await this.database.transaction(async (trx) => {
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS app_configurations (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
          )
        `;
        
        await trx.exec(createTableQuery);
        
        // Create index for better performance
        const createIndexQuery = `
          CREATE INDEX IF NOT EXISTS idx_app_configurations_updated_at 
          ON app_configurations(updated_at)
        `;
        
        await trx.exec(createIndexQuery);
        
        return true;
      });

      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Get current configuration from database
  async get(): Promise<Result<AppConfig | null>> {
    try {
      // Query the configuration table
      const result = await this.database.transaction(async (trx) => {
        return new Promise<AppConfig | null>((resolve, reject) => {
          const query = `SELECT value FROM app_configurations WHERE key = ?`;
          trx.all(query, [this.configKey], (err: any, rows: any[]) => {
            if (err) {
              reject(err);
              return;
            }
            
            if (!rows || rows.length === 0) {
              resolve(null);
              return;
            }

            try {
              const configData = JSON.parse(rows[0].value);
              
              // Convert date strings back to Date objects
              const config = {
                ...configData,
                createdAt: new Date(configData.createdAt),
                updatedAt: new Date(configData.updatedAt)
              } as AppConfig;
              
              resolve(config);
            } catch (parseError) {
              reject(parseError);
            }
          });
        });
      });

      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      return { ok: true, value: result.value };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Set configuration in database
  async set(config: Partial<AppConfig>): Promise<Result<AppConfig>> {
    try {
      const result = await this.database.transaction(async (trx) => {
        // Get existing config first
        const existingQuery = `SELECT value FROM app_configurations WHERE key = ?`;
        const existingRows = await trx.all(existingQuery, [this.configKey]);
        
        const currentConfig: AppConfig = existingRows.length === 0
          ? createDefaultConfig()
          : (() => {
              const existingData = JSON.parse(existingRows[0].value);
              return {
                ...existingData,
                createdAt: new Date(existingData.createdAt),
                updatedAt: new Date(existingData.updatedAt)
              };
            })();

        // Merge with updates
        const updatedConfig: AppConfig = {
          ...currentConfig,
          ...config,
          updatedAt: new Date()
        };

        // Validate the configuration
        const validation = this.validateConfig(updatedConfig);
        if (!validation.ok) {
          throw validation.error;
        }

        // Save to database
        const upsertQuery = `
          INSERT OR REPLACE INTO app_configurations (key, value, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `;
        
        const configJson = JSON.stringify({
          ...updatedConfig,
          createdAt: updatedConfig.createdAt.toISOString(),
          updatedAt: updatedConfig.updatedAt.toISOString()
        });

        await trx.run(upsertQuery, [
          this.configKey,
          configJson,
          updatedConfig.createdAt.toISOString(),
          updatedConfig.updatedAt.toISOString()
        ]);

        return updatedConfig;
      });

      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      return { ok: true, value: result.value };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Reset configuration to defaults
  async reset(): Promise<Result<AppConfig>> {
    try {
      const defaultConfig = createDefaultConfig();
      
      const result = await this.database.transaction(async (trx) => {
        const deleteQuery = `DELETE FROM app_configurations WHERE key = ?`;
        await trx.run(deleteQuery, [this.configKey]);
        
        const insertQuery = `
          INSERT INTO app_configurations (key, value, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `;
        
        const configJson = JSON.stringify({
          ...defaultConfig,
          createdAt: defaultConfig.createdAt.toISOString(),
          updatedAt: defaultConfig.updatedAt.toISOString()
        });

        await trx.run(insertQuery, [
          this.configKey,
          configJson,
          defaultConfig.createdAt.toISOString(),
          defaultConfig.updatedAt.toISOString()
        ]);

        return defaultConfig;
      });

      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      return { ok: true, value: result.value };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Create backup of current configuration
  async backup(): Promise<Result<string>> {
    try {
      const configResult = await this.get();
      if (!configResult.ok) {
        return { ok: false, error: configResult.error };
      }

      if (!configResult.value) {
        return { ok: false, error: new Error('No configuration to backup') };
      }

      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');

      // Create backup directory if it doesn't exist
      const backupDir = path.join(os.homedir(), '.killall', 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      // Create backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `config-backup-${timestamp}.json`);

      // Write configuration to backup file
      const backupData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        config: configResult.value
      };

      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));

      return { ok: true, value: backupPath };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Restore configuration from backup file
  async restore(backupPath: string): Promise<Result<AppConfig>> {
    try {
      const fs = require('fs').promises;
      
      // Check if backup file exists
      try {
        await fs.access(backupPath);
      } catch {
        return { ok: false, error: new Error(`Backup file not found: ${backupPath}`) };
      }

      // Read and parse backup file
      const backupContent = await fs.readFile(backupPath, 'utf8');
      const backupData = JSON.parse(backupContent);

      if (!backupData.config) {
        return { ok: false, error: new Error('Invalid backup file format') };
      }

      // Restore configuration
      const configToRestore: AppConfig = {
        ...backupData.config,
        createdAt: new Date(backupData.config.createdAt),
        updatedAt: new Date(), // Update timestamp for restore
      };

      const result = await this.set(configToRestore);
      return result;
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Validate configuration data
  private validateConfig(config: AppConfig): Result<void> {
    try {
      // Required fields validation
      if (!config.version || typeof config.version !== 'string') {
        return { ok: false, error: new Error('Config version is required and must be a string') };
      }

      if (!Array.isArray(config.watchDirectories)) {
        return { ok: false, error: new Error('watchDirectories must be an array') };
      }

      if (!config.notifications || typeof config.notifications !== 'object') {
        return { ok: false, error: new Error('notifications config is required') };
      }

      if (!config.ui || typeof config.ui !== 'object') {
        return { ok: false, error: new Error('ui config is required') };
      }

      if (!config.behavior || typeof config.behavior !== 'object') {
        return { ok: false, error: new Error('behavior config is required') };
      }

      // Date validation
      if (!(config.createdAt instanceof Date) || isNaN(config.createdAt.getTime())) {
        return { ok: false, error: new Error('createdAt must be a valid Date') };
      }

      if (!(config.updatedAt instanceof Date) || isNaN(config.updatedAt.getTime())) {
        return { ok: false, error: new Error('updatedAt must be a valid Date') };
      }

      // Notification config validation
      const notifications = config.notifications;
      if (typeof notifications.enabled !== 'boolean') {
        return { ok: false, error: new Error('notifications.enabled must be a boolean') };
      }

      if (!Array.isArray(notifications.warningIntervals) || 
          !notifications.warningIntervals.every(i => typeof i === 'number' && i > 0)) {
        return { ok: false, error: new Error('warningIntervals must be an array of positive numbers') };
      }

      // UI config validation
      const ui = config.ui;
      if (!['light', 'dark', 'system'].includes(ui.theme)) {
        return { ok: false, error: new Error('ui.theme must be light, dark, or system') };
      }

      if (!['left', 'right', 'center'].includes(ui.position)) {
        return { ok: false, error: new Error('ui.position must be left, right, or center') };
      }

      // Behavior config validation
      const behavior = config.behavior;
      if (typeof behavior.maxConcurrentDestructions !== 'number' || 
          behavior.maxConcurrentDestructions < 1 || 
          behavior.maxConcurrentDestructions > 10) {
        return { ok: false, error: new Error('maxConcurrentDestructions must be a number between 1 and 10') };
      }

      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }
}