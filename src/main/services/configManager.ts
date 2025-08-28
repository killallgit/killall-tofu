// Configuration Manager Service
// Handles global application configuration, user preferences, and settings persistence

import { Result } from '../database/types';

// Application configuration interfaces
export interface AppConfig {
  version: string;
  watchDirectories: string[];
  notifications: NotificationConfig;
  ui: UIConfig;
  behavior: BehaviorConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationConfig {
  enabled: boolean;
  warningIntervals: number[]; // Minutes before destruction to warn [60, 30, 10, 5]
  sound: boolean;
  systemNotifications: boolean;
}

export interface UIConfig {
  theme: 'light' | 'dark' | 'system';
  showCountdowns: boolean;
  compactMode: boolean;
  autoHide: boolean;
  position: 'left' | 'right' | 'center';
}

export interface BehaviorConfig {
  autoDiscovery: boolean;
  confirmDestruction: boolean;
  pauseOnBatteryLow: boolean;
  maxConcurrentDestructions: number;
  defaultTimeout: string; // e.g., "2 hours"
}

// Configuration repository interface for database operations
/* eslint-disable @typescript-eslint/no-unused-vars */
export interface ConfigRepository {
  get(): Promise<Result<AppConfig | null>>;
  set(config: Partial<AppConfig>): Promise<Result<AppConfig>>;
  reset(): Promise<Result<AppConfig>>;
  backup(): Promise<Result<string>>; // Returns backup file path
  restore(backupPath: string): Promise<Result<AppConfig>>;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

// Configuration Manager Service
export class ConfigManager {
  private config: AppConfig | null = null;
  private readonly configRepo: ConfigRepository;
  private readonly eventHandlers: Map<string, Array<(_config: AppConfig) => void>> = new Map();

  constructor(configRepository: ConfigRepository) {
    this.configRepo = configRepository;
  }

  // Initialize configuration manager
  async initialize(): Promise<Result<void>> {
    try {
      const result = await this.configRepo.get();
      
      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      // If no config exists, create default
      if (!result.value) {
        const defaultResult = await this.createDefaultConfig();
        if (!defaultResult.ok) {
          return { ok: false, error: defaultResult.error };
        }
        this.config = defaultResult.value;
      } else {
        this.config = result.value;
      }

      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Get current configuration
  getConfig(): Result<AppConfig> {
    if (!this.config) {
      return { ok: false, error: new Error('Configuration not initialized') };
    }
    
    // Return deep copy to prevent mutations
    return { ok: true, value: { ...this.config } };
  }

  // Update configuration with partial changes
  async updateConfig(updates: Partial<AppConfig>): Promise<Result<AppConfig>> {
    if (!this.config) {
      return { ok: false, error: new Error('Configuration not initialized') };
    }

    try {
      const result = await this.configRepo.set({
        ...updates,
        updatedAt: new Date()
      });

      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      this.config = result.value;
      this.emitChange(this.config);
      
      return { ok: true, value: this.config };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Get specific configuration section
  getNotificationConfig(): Result<NotificationConfig> {
    const configResult = this.getConfig();
    if (!configResult.ok) {
      return configResult;
    }
    return { ok: true, value: configResult.value.notifications };
  }

  getUIConfig(): Result<UIConfig> {
    const configResult = this.getConfig();
    if (!configResult.ok) {
      return configResult;
    }
    return { ok: true, value: configResult.value.ui };
  }

  getBehaviorConfig(): Result<BehaviorConfig> {
    const configResult = this.getConfig();
    if (!configResult.ok) {
      return configResult;
    }
    return { ok: true, value: configResult.value.behavior };
  }

  // Update specific configuration sections
  async updateNotifications(updates: Partial<NotificationConfig>): Promise<Result<AppConfig>> {
    const configResult = this.getConfig();
    if (!configResult.ok) {
      return configResult;
    }

    const updatedConfig: Partial<AppConfig> = {
      notifications: { ...configResult.value.notifications, ...updates }
    };

    return this.updateConfig(updatedConfig);
  }

  async updateUI(updates: Partial<UIConfig>): Promise<Result<AppConfig>> {
    const configResult = this.getConfig();
    if (!configResult.ok) {
      return configResult;
    }

    const updatedConfig: Partial<AppConfig> = {
      ui: { ...configResult.value.ui, ...updates }
    };

    return this.updateConfig(updatedConfig);
  }

  async updateBehavior(updates: Partial<BehaviorConfig>): Promise<Result<AppConfig>> {
    const configResult = this.getConfig();
    if (!configResult.ok) {
      return configResult;
    }

    const updatedConfig: Partial<AppConfig> = {
      behavior: { ...configResult.value.behavior, ...updates }
    };

    return this.updateConfig(updatedConfig);
  }

  // Watch directories management
  async addWatchDirectory(path: string): Promise<Result<AppConfig>> {
    const configResult = this.getConfig();
    if (!configResult.ok) {
      return configResult;
    }

    const currentDirs = configResult.value.watchDirectories;
    if (currentDirs.includes(path)) {
      return { ok: true, value: configResult.value }; // Already exists
    }

    return this.updateConfig({
      watchDirectories: [...currentDirs, path]
    });
  }

  async removeWatchDirectory(path: string): Promise<Result<AppConfig>> {
    const configResult = this.getConfig();
    if (!configResult.ok) {
      return configResult;
    }

    const updatedDirs = configResult.value.watchDirectories.filter(dir => dir !== path);
    return this.updateConfig({
      watchDirectories: updatedDirs
    });
  }

  // Configuration backup and restore
  async createBackup(): Promise<Result<string>> {
    try {
      const result = await this.configRepo.backup();
      return result;
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  async restoreFromBackup(backupPath: string): Promise<Result<AppConfig>> {
    try {
      const result = await this.configRepo.restore(backupPath);
      
      if (!result.ok) {
        return result;
      }

      this.config = result.value;
      this.emitChange(this.config);
      
      return { ok: true, value: this.config };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Reset to default configuration
  async resetToDefaults(): Promise<Result<AppConfig>> {
    try {
      const result = await this.configRepo.reset();
      
      if (!result.ok) {
        return result;
      }

      this.config = result.value;
      this.emitChange(this.config);
      
      return { ok: true, value: this.config };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Event handling for configuration changes
  onChange(handler: (_config: AppConfig) => void): () => void {
    const handlers = this.eventHandlers.get('change') || [];
    handlers.push(handler);
    this.eventHandlers.set('change', handlers);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.eventHandlers.get('change') || [];
      const index = currentHandlers.indexOf(handler);
      if (index > -1) {
        currentHandlers.splice(index, 1);
      }
    };
  }

  // Configuration validation
  validateConfig(config: Partial<AppConfig>): Result<void> {
    try {
      // Watch directories validation
      if (config.watchDirectories) {
        if (!Array.isArray(config.watchDirectories)) {
          return { ok: false, error: new Error('watchDirectories must be an array') };
        }
        
        for (const dir of config.watchDirectories) {
          if (typeof dir !== 'string' || dir.length === 0) {
            return { ok: false, error: new Error('Watch directory paths must be non-empty strings') };
          }
        }
      }

      // Notification validation
      if (config.notifications) {
        const notifications = config.notifications;
        if (notifications.warningIntervals && !Array.isArray(notifications.warningIntervals)) {
          return { ok: false, error: new Error('warningIntervals must be an array of numbers') };
        }
      }

      // Behavior validation
      if (config.behavior) {
        const behavior = config.behavior;
        if (behavior.maxConcurrentDestructions && (behavior.maxConcurrentDestructions < 1 || behavior.maxConcurrentDestructions > 10)) {
          return { ok: false, error: new Error('maxConcurrentDestructions must be between 1 and 10') };
        }
      }

      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  // Private helper methods
  private async createDefaultConfig(): Promise<Result<AppConfig>> {
    const defaultConfig: AppConfig = {
      version: '1.0.0',
      watchDirectories: [
        require('os').homedir() + '/projects',
        require('os').homedir() + '/infrastructure'
      ],
      notifications: {
        enabled: true,
        warningIntervals: [60, 30, 10, 5], // Minutes
        sound: true,
        systemNotifications: true
      },
      ui: {
        theme: 'system',
        showCountdowns: true,
        compactMode: false,
        autoHide: true,
        position: 'right'
      },
      behavior: {
        autoDiscovery: true,
        confirmDestruction: true,
        pauseOnBatteryLow: false,
        maxConcurrentDestructions: 3,
        defaultTimeout: '2 hours'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.configRepo.set(defaultConfig);
    return result;
  }

  private emitChange(config: AppConfig): void {
    const handlers = this.eventHandlers.get('change') || [];
    handlers.forEach(handler => {
      try {
        handler(config);
      } catch (error) {
        // Silently handle handler errors to prevent cascade failures
        // Configuration change handler error - silently handled
      }
    });
  }
}

// Default configuration factory function
export const createDefaultConfig = (): AppConfig => {
  return {
    version: '1.0.0',
    watchDirectories: [
      require('os').homedir() + '/projects',
      require('os').homedir() + '/infrastructure'
    ],
    notifications: {
      enabled: true,
      warningIntervals: [60, 30, 10, 5],
      sound: true,
      systemNotifications: true
    },
    ui: {
      theme: 'system',
      showCountdowns: true,
      compactMode: false,
      autoHide: true,
      position: 'right'
    },
    behavior: {
      autoDiscovery: true,
      confirmDestruction: true,
      pauseOnBatteryLow: false,
      maxConcurrentDestructions: 3,
      defaultTimeout: '2 hours'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
};