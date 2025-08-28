import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * App Configurations table: Stores application settings
 * Used by the Configuration Manager service for persistent settings
 */
export const appConfigurations = sqliteTable('app_configurations', {
  // Primary key - configuration key name
  key: text('key').primaryKey(),
  
  // Configuration value (JSON-serialized for complex data)
  value: text('value').notNull(),
  
  // Creation timestamp
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  
  // Last update timestamp  
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  // Index for faster lookups
  updatedAtIdx: index('idx_app_configurations_updated_at').on(table.updatedAt)
}));

// TypeScript type inference for select operations
export type AppConfiguration = typeof appConfigurations.$inferSelect;

// TypeScript type inference for insert operations
export type NewAppConfiguration = typeof appConfigurations.$inferInsert;

// Common configuration keys for type safety
export const ConfigKey = {
  // Notification settings
  NOTIFICATIONS_ENABLED: 'notifications.enabled',
  NOTIFICATIONS_WARNING_INTERVALS: 'notifications.warningIntervals',
  NOTIFICATIONS_SOUND_ENABLED: 'notifications.soundEnabled',
  
  // UI settings
  UI_THEME: 'ui.theme',
  UI_SHOW_COUNTDOWN: 'ui.showCountdown',
  UI_COMPACT_MODE: 'ui.compactMode',
  
  // Behavior settings
  BEHAVIOR_CONFIRM_DESTROY: 'behavior.confirmDestroy',
  BEHAVIOR_AUTO_DISCOVER: 'behavior.autoDiscover',
  BEHAVIOR_SCAN_INTERVAL: 'behavior.scanInterval',
  BEHAVIOR_MAX_CONCURRENT: 'behavior.maxConcurrent',
  BEHAVIOR_DEFAULT_TIMEOUT: 'behavior.defaultTimeout',
  
  // Watch directories
  WATCH_DIRECTORIES: 'watch.directories',
  
  // System settings
  SYSTEM_LOG_LEVEL: 'system.logLevel',
  SYSTEM_BACKUP_PATH: 'system.backupPath'
} as const;

export type ConfigKeyType = typeof ConfigKey[keyof typeof ConfigKey];