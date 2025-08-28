// File watching service for monitoring .killall.yaml files and project changes
// Uses chokidar for efficient file system monitoring with debouncing and error recovery

import { EventEmitter } from 'events';
import * as path from 'path';

import * as chokidar from 'chokidar';

import { Result, Database, Project } from '../database/types';

import { ProjectDiscoveryService, ProjectDiscoveryEvent, DiscoveryOptions } from './projectDiscovery';

export interface FileWatcherOptions {
  /** Directories to watch for .killall.yaml files */
  watchPaths: string[];
  /** Debounce delay for file changes in milliseconds (default: 1000) */
  debounceDelay?: number;
  /** Whether to ignore initial scan events (default: true) */
  ignoreInitial?: boolean;
  /** Maximum depth to watch (default: 10) */
  maxDepth?: number;
  /** Custom ignore patterns beyond defaults */
  ignorePatterns?: string[];
}

export interface FileWatcherEvent {
  type: 'projectDiscovered' | 'projectUpdated' | 'projectRemoved' | 'error' | 'ready';
  project?: Project;
  path?: string;
  error?: Error;
}

export interface FileWatcherStats {
  watchedPaths: string[];
  watchedFiles: number;
  discoveredProjects: number;
  isWatching: boolean;
  lastScanTime?: Date;
  errors: number;
}

/**
 * File Watcher Service
 * Monitors file system for .killall.yaml changes and triggers project discovery
 */
export class FileWatcherService extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private projectDiscovery: ProjectDiscoveryService;
  private watchedPaths: string[] = [];
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private stats: FileWatcherStats = {
    watchedPaths: [],
    watchedFiles: 0,
    discoveredProjects: 0,
    isWatching: false,
    errors: 0,
  };

  constructor(private database: Database) {
    super();
    this.projectDiscovery = new ProjectDiscoveryService(
      database.projects,
      database.events
    );

    // Forward discovery events as file watcher events
    this.projectDiscovery.on((event: ProjectDiscoveryEvent) => {
      this.handleDiscoveryEvent(event);
    });
  }

  /**
   * Start file watching on specified paths
   */
  public async start(options: FileWatcherOptions): Promise<Result<FileWatcherStats>> {
    try {
      if (this.watcher) {
        const stopResult = await this.stop();
        if (!stopResult.ok) {
          return stopResult;
        }
      }

      const {
        watchPaths,
        debounceDelay = 1000,
        ignoreInitial = true,
        maxDepth = 10,
        ignorePatterns = []
      } = options;

      // Validate watch paths
      if (!watchPaths || watchPaths.length === 0) {
        return {
          ok: false,
          error: new Error('At least one watch path must be specified')
        };
      }

      // Create ignore patterns
      const defaultIgnorePatterns = [
        '**/node_modules/**',
        '**/.git/**',
        '**/.svn/**',
        '**/.hg/**',
        '**/vendor/**',
        '**/target/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/.webpack/**',
        '**/coverage/**',
        '**/.terraform/**',
        '**/*.egg-info/**',
        '**/__pycache__/**',
        '**/.pytest_cache/**',
        '**/.vscode/**',
        '**/.idea/**',
        ...ignorePatterns
      ];

      // Configure chokidar options
      const chokidarOptions = {
        ignoreInitial,
        persistent: true,
        depth: maxDepth,
        ignored: defaultIgnorePatterns,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
        atomic: true,
      };

      // Create watcher for .killall.yaml files
      const watchGlob = watchPaths.map(p => path.join(p, '**/.killall.yaml'));
      this.watcher = chokidar.watch(watchGlob, chokidarOptions);

      // Set up event handlers
      this.setupWatcherEventHandlers(debounceDelay);

      // Update stats
      this.watchedPaths = [...watchPaths];
      this.stats = {
        watchedPaths: [...watchPaths],
        watchedFiles: 0,
        discoveredProjects: 0,
        isWatching: true,
        lastScanTime: undefined,
        errors: 0,
      };

      // Perform initial discovery if needed
      if (!ignoreInitial) {
        const discoveryOptions: DiscoveryOptions = {
          scanPaths: watchPaths,
          maxDepth,
          excludePatterns: defaultIgnorePatterns.map(p => p.replace('**/', '').replace('/**', '')),
        };

        const discoveryResult = await this.projectDiscovery.discover(discoveryOptions);
        if (discoveryResult.ok) {
          this.stats.discoveredProjects = discoveryResult.value.foundProjects;
          this.stats.lastScanTime = new Date();
        } else {
          this.stats.errors++;
          this.emit('error', discoveryResult.error);
        }
      }

      return { ok: true, value: { ...this.stats } };

    } catch (error) {
      this.stats.errors++;
      return {
        ok: false,
        error: error instanceof Error ? error : new Error('Failed to start file watcher')
      };
    }
  }

  /**
   * Stop file watching
   */
  public async stop(): Promise<Result<void>> {
    try {
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }

      // Clear any pending debounce timers
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();

      // Reset stats
      this.stats.isWatching = false;
      this.watchedPaths = [];

      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error('Failed to stop file watcher')
      };
    }
  }

  /**
   * Get current watcher statistics
   */
  public getStats(): FileWatcherStats {
    return { ...this.stats };
  }

  /**
   * Manually trigger project discovery
   */
  public async scan(): Promise<Result<void>> {
    if (!this.isWatching()) {
      return {
        ok: false,
        error: new Error('File watcher is not running')
      };
    }

    try {
      const discoveryOptions: DiscoveryOptions = {
        scanPaths: this.watchedPaths,
        maxDepth: 10,
      };

      const result = await this.projectDiscovery.discover(discoveryOptions);
      if (result.ok) {
        this.stats.discoveredProjects = result.value.foundProjects;
        this.stats.lastScanTime = new Date();
      } else {
        this.stats.errors++;
      }

      return result.ok ? { ok: true, value: undefined } : result;
    } catch (error) {
      this.stats.errors++;
      return {
        ok: false,
        error: error instanceof Error ? error : new Error('Manual scan failed')
      };
    }
  }

  /**
   * Check if file watcher is currently running
   */
  public isWatching(): boolean {
    return this.stats.isWatching && this.watcher !== null;
  }

  /**
   * Setup chokidar event handlers with debouncing
   */
  private setupWatcherEventHandlers(debounceDelay: number): void {
    if (!this.watcher) return;

    this.watcher
      .on('add', (filePath: string) => {
        this.handleFileEvent('add', filePath, debounceDelay);
      })
      .on('change', (filePath: string) => {
        this.handleFileEvent('change', filePath, debounceDelay);
      })
      .on('unlink', (filePath: string) => {
        this.handleFileEvent('unlink', filePath, debounceDelay);
      })
      .on('ready', () => {
        this.stats.watchedFiles = this.watcher?.getWatched() 
          ? Object.keys(this.watcher.getWatched()).length 
          : 0;
        
        this.emit('ready');
      })
      .on('error', (error: unknown) => {
        this.stats.errors++;
        this.emit('error', error);
      });
  }

  /**
   * Handle file system events with debouncing
   */
  private handleFileEvent(event: string, filePath: string, debounceDelay: number): void {
    // Clear existing debounce timer for this file
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(filePath);
      await this.processFileEvent(event, filePath);
    }, debounceDelay);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Process debounced file events
   */
  private async processFileEvent(event: string, filePath: string): Promise<void> {
    try {
      const projectPath = path.dirname(filePath);

      switch (event) {
        case 'add':
        case 'change': {
          // Config file added or changed - discover/update project
          const result = await this.projectDiscovery.discoverProject(projectPath);
          if (result.ok && result.value) {
            // Project discovery service will emit appropriate events
            this.stats.discoveredProjects++;
          } else if (!result.ok) {
            this.stats.errors++;
            this.emit('error', result.error);
          }
          break;
        }

        case 'unlink': {
          // Config file removed - clean up project
          const findResult = await this.database.projects.findByPath(projectPath);
          if (findResult.ok && findResult.value) {
            const deleteResult = await this.database.projects.delete(findResult.value.id);
            if (deleteResult.ok) {
              // Log removal event
              await this.database.events.log({
                projectId: findResult.value.id,
                eventType: 'cancelled',
                details: JSON.stringify({
                  action: 'removed',
                  reason: 'config_file_deleted',
                  path: projectPath
                })
              });

              this.emit('projectRemoved', {
                type: 'projectRemoved',
                project: findResult.value,
                path: filePath
              });
            } else {
              this.stats.errors++;
              this.emit('error', deleteResult.error);
            }
          }
          break;
        }
      }
    } catch (error) {
      this.stats.errors++;
      this.emit('error', error instanceof Error ? error : new Error('File event processing failed'));
    }
  }

  /**
   * Handle events from project discovery service
   */
  private handleDiscoveryEvent(event: ProjectDiscoveryEvent): void {
    switch (event.type) {
      case 'discovered':
        this.emit('projectDiscovered', {
          type: 'projectDiscovered',
          project: event.project,
        });
        break;

      case 'updated':
        this.emit('projectUpdated', {
          type: 'projectUpdated',
          project: event.project,
        });
        break;

      case 'removed':
        this.emit('projectRemoved', {
          type: 'projectRemoved',
          project: event.project,
        });
        break;

      case 'error':
        this.stats.errors++;
        this.emit('error', {
          type: 'error',
          path: event.path,
          error: event.error,
        });
        break;
    }
  }

  /**
   * Add new paths to watch (extend existing watcher)
   */
  public async addWatchPath(watchPath: string): Promise<Result<void>> {
    if (!this.watcher) {
      return {
        ok: false,
        error: new Error('File watcher is not running')
      };
    }

    try {
      const watchGlob = path.join(watchPath, '**/.killall.yaml');
      this.watcher.add(watchGlob);
      
      if (!this.watchedPaths.includes(watchPath)) {
        this.watchedPaths.push(watchPath);
        this.stats.watchedPaths.push(watchPath);
      }

      return { ok: true, value: undefined };
    } catch (error) {
      this.stats.errors++;
      return {
        ok: false,
        error: error instanceof Error ? error : new Error('Failed to add watch path')
      };
    }
  }

  /**
   * Remove paths from watcher
   */
  public async removeWatchPath(watchPath: string): Promise<Result<void>> {
    if (!this.watcher) {
      return {
        ok: false,
        error: new Error('File watcher is not running')
      };
    }

    try {
      const watchGlob = path.join(watchPath, '**/.killall.yaml');
      this.watcher.unwatch(watchGlob);
      
      const index = this.watchedPaths.indexOf(watchPath);
      if (index >= 0) {
        this.watchedPaths.splice(index, 1);
        this.stats.watchedPaths.splice(index, 1);
      }

      return { ok: true, value: undefined };
    } catch (error) {
      this.stats.errors++;
      return {
        ok: false,
        error: error instanceof Error ? error : new Error('Failed to remove watch path')
      };
    }
  }
}