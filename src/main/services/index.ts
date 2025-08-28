// Services module exports
// Centralized export for all file watcher related services

export { FileWatcherService } from './fileWatcher';
export type { FileWatcherOptions, FileWatcherEvent, FileWatcherStats } from './fileWatcher';

export { ProjectDiscoveryService } from './projectDiscovery';
export type { 
  DiscoveryOptions, 
  DiscoveryStats, 
  ProjectDiscoveryEvent 
} from './projectDiscovery';

export { 
  parseDuration,
  validatePath,
  validateConfig,
  parseConfigFile,
  ConfigValidationError
} from './configValidator';

// Re-export types for convenience
export type { Result, Project, ProjectConfig } from '../database/types';