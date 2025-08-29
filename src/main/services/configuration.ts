/**
 * ConfigurationService - Manages global application configuration
 * 
 * Follows functional programming principles with:
 * - Result<T, E> pattern for error handling
 * - Pure functions where possible
 * - No global state
 * - Immutable configuration objects
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import * as yaml from 'js-yaml';

import { 
  AppConfig, 
  DatabaseConfig,
  WatcherConfig,
  SchedulerConfig,
  ExecutorConfig,
  NotificationConfig,
  Result 
} from '../../shared/types';
import { Ok, Err } from '../../shared/utils/result';

interface ConfigurationStats {
  loadCount: number;
  saveCount: number;
  lastLoaded?: Date;
  lastSaved?: Date;
  configPath: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: AppConfig = {
  database: {
    path: join(homedir(), '.killall', 'killall.db'),
    maxConnections: 10,
    timeout: 30000
  },
  watcher: {
    paths: [
      join(homedir(), 'terraform'),
      join(homedir(), 'projects'),
      join(homedir(), 'code')
    ],
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.terraform/**',
      '**/target/**',
      '**/.vscode/**',
      '**/.idea/**'
    ],
    pollInterval: 30000 // 30 seconds
  },
  scheduler: {
    maxConcurrentJobs: 5,
    defaultTimeout: '2 hours',
    retryAttempts: 3
  },
  executor: {
    maxConcurrentExecutions: 3,
    defaultShell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
    environment: {
      PATH: process.env.PATH || '',
      HOME: process.env.HOME || process.env.USERPROFILE || '',
      USER: process.env.USER || process.env.USERNAME || ''
    }
  },
  notifications: {
    enabled: true,
    desktop: true,
    sound: true
  }
};

/**
 * Configuration service that manages global application settings
 * Uses pure functional patterns with immutable configuration
 */
export class ConfigurationService extends EventEmitter {
  private currentConfig: AppConfig;
  private configPath: string;
  private stats: ConfigurationStats;

  constructor(configPath?: string) {
    super();
    this.configPath = configPath || join(homedir(), '.killall', 'killall.yaml');
    this.currentConfig = { ...DEFAULT_CONFIG };
    this.stats = {
      loadCount: 0,
      saveCount: 0,
      configPath: this.configPath
    };
  }

  /**
   * Load configuration from file or create default if it doesn't exist
   */
  async load(): Promise<Result<AppConfig>> {
    try {
      // Ensure the config directory exists
      const configDir = join(this.configPath, '..');
      await fs.mkdir(configDir, { recursive: true });

      // Try to read the configuration file
      try {
        const configContent = await fs.readFile(this.configPath, 'utf-8');
        const parsedConfig = yaml.load(configContent) as any;
        
        // Validate and merge with defaults
        const mergedConfig = this.mergeWithDefaults(parsedConfig);
        const validationResult = this.validateConfig(mergedConfig);
        
        if (!validationResult.ok) {
          return validationResult;
        }

        this.currentConfig = mergedConfig;
        this.stats.loadCount++;
        this.stats.lastLoaded = new Date();

        this.emit('config_loaded', { 
          config: this.currentConfig,
          path: this.configPath 
        });

        return Ok(this.currentConfig);
      } catch (error) {
        // Config file doesn't exist or is invalid, create default
        const createResult = await this.createDefaultConfig();
        if (!createResult.ok) {
          return createResult;
        }
        
        return Ok(this.currentConfig);
      }
    } catch (error) {
      return Err(new Error(`Failed to load configuration: ${(error as Error).message}`));
    }
  }

  /**
   * Save current configuration to file
   */
  async save(config?: AppConfig): Promise<Result<void>> {
    try {
      const configToSave = config || this.currentConfig;
      
      // Validate configuration before saving
      const validationResult = this.validateConfig(configToSave);
      if (!validationResult.ok) {
        return validationResult;
      }

      // Ensure the config directory exists
      const configDir = join(this.configPath, '..');
      await fs.mkdir(configDir, { recursive: true });

      // Convert to YAML and save
      const yamlContent = yaml.dump(configToSave, {
        indent: 2,
        lineWidth: 120,
        noRefs: true
      });

      await fs.writeFile(this.configPath, yamlContent, 'utf-8');

      // Update current config if different config was provided
      if (config) {
        this.currentConfig = { ...config };
      }

      this.stats.saveCount++;
      this.stats.lastSaved = new Date();

      this.emit('config_saved', {
        config: this.currentConfig,
        path: this.configPath
      });

      return Ok(undefined);
    } catch (error) {
      return Err(new Error(`Failed to save configuration: ${(error as Error).message}`));
    }
  }

  /**
   * Get current configuration (immutable copy)
   */
  getConfig(): AppConfig {
    return JSON.parse(JSON.stringify(this.currentConfig));
  }

  /**
   * Update configuration (creates new immutable config)
   */
  async updateConfig(updates: Partial<AppConfig>): Promise<Result<AppConfig>> {
    try {
      const newConfig = this.deepMerge(this.currentConfig, updates);
      const validationResult = this.validateConfig(newConfig);
      
      if (!validationResult.ok) {
        return validationResult;
      }

      // Save the updated configuration
      const saveResult = await this.save(newConfig);
      if (!saveResult.ok) {
        return Err(saveResult.error);
      }

      this.emit('config_updated', {
        previousConfig: this.currentConfig,
        newConfig: newConfig,
        updates
      });

      return Ok(this.currentConfig);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Get specific configuration section
   */
  getDatabaseConfig(): DatabaseConfig {
    return { ...this.currentConfig.database };
  }

  getWatcherConfig(): WatcherConfig {
    return { ...this.currentConfig.watcher };
  }

  getSchedulerConfig(): SchedulerConfig {
    return { ...this.currentConfig.scheduler };
  }

  getExecutorConfig(): ExecutorConfig {
    return { ...this.currentConfig.executor };
  }

  getNotificationConfig(): NotificationConfig {
    return { ...this.currentConfig.notifications };
  }

  /**
   * Create default configuration file
   */
  private async createDefaultConfig(): Promise<Result<void>> {
    const saveResult = await this.save(DEFAULT_CONFIG);
    if (!saveResult.ok) {
      return saveResult;
    }

    this.emit('default_config_created', { 
      config: this.currentConfig,
      path: this.configPath 
    });

    return Ok(undefined);
  }

  /**
   * Merge parsed configuration with defaults
   */
  private mergeWithDefaults(parsedConfig: any): AppConfig {
    return this.deepMerge(DEFAULT_CONFIG, parsedConfig);
  }

  /**
   * Deep merge two objects (immutable)
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * Validate configuration structure and values
   */
  private validateConfig(config: any): Result<void> {
    try {
      // Validate required sections
      if (!config.database || typeof config.database !== 'object') {
        return Err(new Error('Invalid database configuration'));
      }
      
      if (!config.watcher || typeof config.watcher !== 'object') {
        return Err(new Error('Invalid watcher configuration'));
      }
      
      if (!config.scheduler || typeof config.scheduler !== 'object') {
        return Err(new Error('Invalid scheduler configuration'));
      }
      
      if (!config.executor || typeof config.executor !== 'object') {
        return Err(new Error('Invalid executor configuration'));
      }
      
      if (!config.notifications || typeof config.notifications !== 'object') {
        return Err(new Error('Invalid notifications configuration'));
      }

      // Validate database config
      if (!config.database.path || typeof config.database.path !== 'string') {
        return Err(new Error('Database path must be a string'));
      }

      // Validate watcher config
      if (!Array.isArray(config.watcher.paths)) {
        return Err(new Error('Watcher paths must be an array'));
      }

      if (config.watcher.ignored && !Array.isArray(config.watcher.ignored)) {
        return Err(new Error('Watcher ignored patterns must be an array'));
      }

      // Validate scheduler config
      if (config.scheduler.maxConcurrentJobs && 
          (typeof config.scheduler.maxConcurrentJobs !== 'number' || 
           config.scheduler.maxConcurrentJobs < 1)) {
        return Err(new Error('Max concurrent jobs must be a positive number'));
      }

      if (config.scheduler.retryAttempts && 
          (typeof config.scheduler.retryAttempts !== 'number' || 
           config.scheduler.retryAttempts < 0)) {
        return Err(new Error('Retry attempts must be a non-negative number'));
      }

      // Validate executor config
      if (config.executor.maxConcurrentExecutions && 
          (typeof config.executor.maxConcurrentExecutions !== 'number' || 
           config.executor.maxConcurrentExecutions < 1)) {
        return Err(new Error('Max concurrent executions must be a positive number'));
      }

      // Validate notifications config
      if (typeof config.notifications.enabled !== 'boolean') {
        return Err(new Error('Notifications enabled must be a boolean'));
      }

      return Ok(undefined);
    } catch (error) {
      return Err(new Error(`Configuration validation failed: ${(error as Error).message}`));
    }
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Check if configuration file exists
   */
  async configExists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<Result<AppConfig>> {
    const saveResult = await this.save(DEFAULT_CONFIG);
    if (!saveResult.ok) {
      return Err(saveResult.error);
    }

    this.emit('config_reset', { config: this.currentConfig });
    return Ok(this.currentConfig);
  }

  /**
   * Get configuration statistics
   */
  getStats(): ConfigurationStats {
    return { ...this.stats };
  }

  /**
   * Validate watch paths exist and are accessible
   */
  async validateWatchPaths(): Promise<Result<string[]>> {
    const validPaths: string[] = [];
    const watcherConfig = this.getWatcherConfig();

    for (const path of watcherConfig.paths) {
      try {
        await fs.access(path);
        const stat = await fs.stat(path);
        if (stat.isDirectory()) {
          validPaths.push(path);
        }
      } catch {
        // Path doesn't exist or is not accessible, skip it
      }
    }

    return Ok(validPaths);
  }

  /**
   * Get default configuration (for reference)
   */
  static getDefaultConfig(): AppConfig {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}