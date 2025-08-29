// Services module exports
// Centralized export for all Killall-Tofu services

// File system and project discovery services
export { FileWatcherService } from './fileWatcher';
export type { FileWatcherOptions, FileWatcherEvent, FileWatcherStats } from './fileWatcher';

export { ProjectDiscoveryService } from './projectDiscovery';
export type { 
  DiscoveryOptions, 
  DiscoveryStats, 
  ProjectDiscoveryEvent 
} from './projectDiscovery';

// Core business logic services
export { SchedulerService } from './scheduler';
export { ExecutorService } from './executor';
export { NotifierService } from './notifier';
export { ConfigurationService } from './configuration';

// Configuration and validation utilities
export { 
  parseDuration,
  validatePath,
  validateConfig,
  parseConfigFile,
  ConfigValidationError
} from './configValidator';

// Re-export types for convenience
export type { Result, Project, ProjectConfig } from '../database/types';