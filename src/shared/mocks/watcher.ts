/**
 * Mock file watcher service implementation for testing and parallel development.
 */

import { FileWatcherService, Result } from '../types';
import { Ok, Err } from '../utils/result';
import { EventEmitter } from 'events';

export class MockFileWatcher extends EventEmitter implements FileWatcherService {
  private isWatching = false;
  private watchedPaths: string[] = [];
  private discoveredCallback?: (path: string) => void;
  private removedCallback?: (path: string) => void;

  async watch(paths: string[]): Promise<Result<void>> {
    if (this.isWatching) {
      return Err(new Error('File watcher is already running'));
    }

    if (paths.length === 0) {
      return Err(new Error('No paths provided to watch'));
    }

    this.watchedPaths = [...paths];
    this.isWatching = true;
    
    this.emit('started', { paths });
    return Ok(void 0);
  }

  async stop(): Promise<Result<void>> {
    if (!this.isWatching) {
      return Err(new Error('File watcher is not running'));
    }

    this.isWatching = false;
    this.watchedPaths = [];
    
    this.emit('stopped');
    return Ok(void 0);
  }

  onProjectDiscovered(callback: (path: string) => void): void {
    this.discoveredCallback = callback;
  }

  onProjectRemoved(callback: (path: string) => void): void {
    this.removedCallback = callback;
  }

  // Testing utilities
  isActive(): boolean {
    return this.isWatching;
  }

  getWatchedPaths(): string[] {
    return [...this.watchedPaths];
  }

  // Simulate file system events
  simulateProjectDiscovered(path: string): void {
    if (!this.isWatching) {
      throw new Error('Cannot simulate events when not watching');
    }

    this.emit('project_discovered', { path });
    if (this.discoveredCallback) {
      this.discoveredCallback(path);
    }
  }

  simulateProjectRemoved(path: string): void {
    if (!this.isWatching) {
      throw new Error('Cannot simulate events when not watching');
    }

    this.emit('project_removed', { path });
    if (this.removedCallback) {
      this.removedCallback(path);
    }
  }

  simulateFileChanged(filePath: string): void {
    if (!this.isWatching) {
      throw new Error('Cannot simulate events when not watching');
    }

    this.emit('file_changed', { path: filePath });
  }

  simulateFileAdded(filePath: string): void {
    if (!this.isWatching) {
      throw new Error('Cannot simulate events when not watching');
    }

    this.emit('file_added', { path: filePath });
  }

  simulateFileRemoved(filePath: string): void {
    if (!this.isWatching) {
      throw new Error('Cannot simulate events when not watching');
    }

    this.emit('file_removed', { path: filePath });
  }

  // Simulate error conditions
  simulateError(error: Error): void {
    this.emit('error', error);
  }

  simulateWatcherFailure(): void {
    this.isWatching = false;
    this.emit('error', new Error('File watcher failed'));
  }
}

// Realistic file watcher that can be configured for different scenarios
export class ConfigurableMockFileWatcher extends MockFileWatcher {
  private config: {
    discoveryDelay: number;
    errorRate: number;
    maxWatchedPaths: number;
    simulateSlowStart: boolean;
  };

  constructor(config: Partial<ConfigurableMockFileWatcher['config']> = {}) {
    super();
    this.config = {
      discoveryDelay: 100, // ms
      errorRate: 0, // 0-1 probability
      maxWatchedPaths: 1000,
      simulateSlowStart: false,
      ...config,
    };
  }

  async watch(paths: string[]): Promise<Result<void>> {
    // Simulate validation
    if (paths.length > this.config.maxWatchedPaths) {
      return Err(new Error(`Too many paths to watch (max: ${this.config.maxWatchedPaths})`));
    }

    // Simulate random errors
    if (Math.random() < this.config.errorRate) {
      return Err(new Error('Simulated file watcher error'));
    }

    // Simulate slow start
    if (this.config.simulateSlowStart) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return super.watch(paths);
  }

  // Auto-discovery simulation with delay
  async startAutoDiscovery(projectPaths: string[]): Promise<void> {
    if (!this.isActive()) {
      throw new Error('File watcher must be started before auto-discovery');
    }

    for (const path of projectPaths) {
      setTimeout(() => {
        if (this.isActive()) {
          this.simulateProjectDiscovered(path);
        }
      }, this.config.discoveryDelay * (projectPaths.indexOf(path) + 1));
    }
  }

  // Batch discovery simulation
  simulateBatchDiscovery(paths: string[]): void {
    paths.forEach((path, index) => {
      setTimeout(() => {
        if (this.isActive()) {
          this.simulateProjectDiscovered(path);
        }
      }, index * 50); // Stagger discoveries by 50ms
    });
  }
}

// Factory functions
export const createMockFileWatcher = (): MockFileWatcher => {
  return new MockFileWatcher();
};

export const createReliableWatcher = (): ConfigurableMockFileWatcher => {
  return new ConfigurableMockFileWatcher({
    discoveryDelay: 50,
    errorRate: 0,
    simulateSlowStart: false,
  });
};

export const createUnreliableWatcher = (): ConfigurableMockFileWatcher => {
  return new ConfigurableMockFileWatcher({
    discoveryDelay: 500,
    errorRate: 0.1, // 10% error rate
    simulateSlowStart: true,
  });
};

export const createSlowWatcher = (): ConfigurableMockFileWatcher => {
  return new ConfigurableMockFileWatcher({
    discoveryDelay: 1000,
    errorRate: 0,
    simulateSlowStart: true,
  });
};

// Test scenario helpers
export const TEST_SCENARIOS = {
  // Single project discovery
  singleDiscovery: (watcher: MockFileWatcher, projectPath: string) => {
    setTimeout(() => watcher.simulateProjectDiscovered(projectPath), 100);
  },

  // Multiple rapid discoveries
  rapidDiscoveries: (watcher: MockFileWatcher, paths: string[]) => {
    paths.forEach((path, index) => {
      setTimeout(() => watcher.simulateProjectDiscovered(path), index * 10);
    });
  },

  // Discovery followed by removal
  discoveryAndRemoval: (watcher: MockFileWatcher, projectPath: string, removalDelay = 1000) => {
    setTimeout(() => watcher.simulateProjectDiscovered(projectPath), 100);
    setTimeout(() => watcher.simulateProjectRemoved(projectPath), 100 + removalDelay);
  },

  // Error during watching
  watcherError: (watcher: MockFileWatcher, delay = 500) => {
    setTimeout(() => watcher.simulateError(new Error('Test watcher error')), delay);
  },

  // Watcher failure and recovery
  failureAndRecovery: async (watcher: MockFileWatcher, paths: string[]) => {
    // Start normally
    await watcher.watch(paths);
    
    // Simulate failure after 500ms
    setTimeout(() => watcher.simulateWatcherFailure(), 500);
    
    // Attempt recovery after 1000ms
    setTimeout(async () => {
      await watcher.watch(paths);
    }, 1000);
  },
};