// Project discovery service orchestrates scanning for .killall.yaml files
// Handles duplicate detection, lifecycle management, and performance optimization

import * as path from 'path';
import * as fs from 'fs/promises';
import { constants as fsConstants } from 'fs';

import { Result, Project, ProjectRepository, EventRepository, EventType } from '../database/types';
import { 
  findConfigFiles,
  validateScanPaths,
  createBatches,
  DEFAULT_EXCLUDE_PATTERNS
} from '../utils/projectScanner';
import { 
  calculateDestroyTime,
  getProjectPath,
  createProjectPathsSet
} from '../utils/configProcessor';
import { projectConfigExists } from '../utils/projectValidator';

import { parseConfigFile } from './configValidator';

export interface DiscoveryOptions {
  /** Root directories to scan for projects */
  scanPaths: string[];
  /** Maximum depth to scan (default: 10) */
  maxDepth?: number;
  /** Exclude patterns (default: node_modules, .git, etc.) */
  excludePatterns?: string[];
  /** Performance: batch size for database operations */
  batchSize?: number;
}

export interface DiscoveryStats {
  scannedDirectories: number;
  foundProjects: number;
  newProjects: number;
  updatedProjects: number;
  errors: number;
  duration: number;
}

export interface ProjectDiscoveryEvent {
  type: 'discovered' | 'updated' | 'removed' | 'error';
  project?: Project;
  path?: string;
  error?: Error;
}


/**
 * Project Discovery Service
 * Orchestrates the scanning and registration of projects with .killall.yaml files
 */
export class ProjectDiscoveryService {
  private eventListeners: ((event: ProjectDiscoveryEvent) => void)[] = [];

  constructor(
    private projectRepository: ProjectRepository,
    private eventRepository: EventRepository
  ) {}

  /**
   * Register event listener for discovery events
   */
  public on(listener: (event: ProjectDiscoveryEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  public off(listener: (event: ProjectDiscoveryEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index >= 0) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit discovery event to all listeners
   */
  private emit(event: ProjectDiscoveryEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        // Don't let listener errors crash the discovery process
        console.error('Error in discovery event listener:', error);
      }
    });
  }

  /**
   * Scan specified directories for .killall.yaml files and register projects
   */
  public async discover(options: DiscoveryOptions): Promise<Result<DiscoveryStats>> {
    const startTime = Date.now();
    const stats: DiscoveryStats = {
      scannedDirectories: 0,
      foundProjects: 0,
      newProjects: 0,
      updatedProjects: 0,
      errors: 0,
      duration: 0,
    };

    try {
      const {
        scanPaths,
        maxDepth = 10,
        excludePatterns = DEFAULT_EXCLUDE_PATTERNS,
        batchSize = 50
      } = options;

      // Validate scan paths
      const validationResult = await validateScanPaths(scanPaths);
      if (!validationResult.ok) {
        return validationResult;
      }

      // Find all .killall.yaml files
      const configFiles: string[] = [];
      
      for (const scanPath of scanPaths) {
        const filesResult = await findConfigFiles(scanPath, maxDepth, excludePatterns);
        if (!filesResult.ok) {
          stats.errors++;
          this.emit({
            type: 'error',
            path: scanPath,
            error: filesResult.error
          });
          continue;
        }
        configFiles.push(...filesResult.value);
      }

      stats.foundProjects = configFiles.length;

      // Process config files in batches for performance
      const batches = createBatches(configFiles, batchSize);
      
      for (const batch of batches) {
        const batchResult = await this.processBatch(batch, stats);
        if (!batchResult.ok) {
          stats.errors++;
          // Continue with other batches even if one fails
        }
      }

      // Clean up removed projects
      const cleanupResult = await this.cleanupRemovedProjects(configFiles);
      if (!cleanupResult.ok) {
        stats.errors++;
      }

      stats.duration = Date.now() - startTime;
      return { ok: true, value: stats };

    } catch (error) {
      stats.duration = Date.now() - startTime;
      stats.errors++;
      
      return {
        ok: false,
        error: error instanceof Error ? error : new Error('Unknown discovery error')
      };
    }
  }


  /**
   * Process a batch of config files
   */
  private async processBatch(
    configFiles: string[],
    stats: DiscoveryStats
  ): Promise<Result<void>> {
    try {
      const promises = configFiles.map(configFile => this.processConfigFile(configFile, stats));
      await Promise.allSettled(promises);
      
      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error('Batch processing failed')
      };
    }
  }

  /**
   * Process a single config file
   */
  private async processConfigFile(configFile: string, stats: DiscoveryStats): Promise<void> {
    try {
      stats.scannedDirectories++;
      
      // Parse and validate config
      const configResult = await parseConfigFile(configFile);
      if (!configResult.ok) {
        stats.errors++;
        this.emit({
          type: 'error',
          path: configFile,
          error: configResult.error
        });
        return;
      }

      const projectPath = getProjectPath(configFile);
      const config = configResult.value;

      // Check if project already exists
      const existingResult = await this.projectRepository.findByPath(projectPath);
      if (!existingResult.ok) {
        stats.errors++;
        this.emit({
          type: 'error',
          path: configFile,
          error: existingResult.error
        });
        return;
      }

      const now = new Date();
      
      if (existingResult.value) {
        // Update existing project
        const existing = existingResult.value;
        const newDestroyAt = calculateDestroyTime(config.timeout, now);
        
        const updateResult = await this.projectRepository.update(existing.id, {
          name: config.name,
          config: JSON.stringify(config),
          destroyAt: newDestroyAt
        });

        if (updateResult.ok) {
          stats.updatedProjects++;
          
          // Log update event
          await this.eventRepository.log({
            projectId: existing.id,
            eventType: 'discovered' as EventType,
            details: JSON.stringify({ action: 'updated', configPath: configFile })
          });

          this.emit({
            type: 'updated',
            project: updateResult.value
          });
        } else {
          stats.errors++;
          this.emit({
            type: 'error',
            path: configFile,
            error: updateResult.error
          });
        }
      } else {
        // Create new project
        const destroyAt = calculateDestroyTime(config.timeout, now);
        
        const newProject: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
          path: projectPath,
          name: config.name,
          config: JSON.stringify(config),
          discoveredAt: now,
          destroyAt,
          status: 'active'
        };

        const createResult = await this.projectRepository.create(newProject);
        
        if (createResult.ok) {
          stats.newProjects++;
          
          // Log discovery event
          await this.eventRepository.log({
            projectId: createResult.value.id,
            eventType: 'discovered' as EventType,
            details: JSON.stringify({ action: 'created', configPath: configFile })
          });

          this.emit({
            type: 'discovered',
            project: createResult.value
          });
        } else {
          stats.errors++;
          this.emit({
            type: 'error',
            path: configFile,
            error: createResult.error
          });
        }
      }
    } catch (error) {
      stats.errors++;
      this.emit({
        type: 'error',
        path: configFile,
        error: error instanceof Error ? error : new Error('Unknown processing error')
      });
    }
  }


  /**
   * Clean up projects that no longer have config files
   */
  private async cleanupRemovedProjects(foundConfigFiles: string[]): Promise<Result<void>> {
    try {
      // Get all active projects
      const activeResult = await this.projectRepository.findActive();
      if (!activeResult.ok) {
        return activeResult;
      }

      const foundPaths = createProjectPathsSet(foundConfigFiles);
      
      for (const project of activeResult.value) {
        if (!foundPaths.has(project.path)) {
          // Project config file was removed
          const deleteResult = await this.projectRepository.delete(project.id);
          
          if (deleteResult.ok) {
            // Log removal event
            await this.eventRepository.log({
              projectId: project.id,
              eventType: 'cancelled' as EventType,
              details: JSON.stringify({ 
                action: 'removed',
                reason: 'config_file_deleted',
                path: project.path
              })
            });

            this.emit({
              type: 'removed',
              project
            });
          }
        }
      }

      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error('Cleanup failed')
      };
    }
  }

  /**
   * Discover single project by path (for targeted discovery)
   */
  public async discoverProject(projectPath: string): Promise<Result<Project | null>> {
    try {
      const configFile = path.join(projectPath, '.killall.yaml');
      
      // Check if config file exists
      const configExists = await projectConfigExists(projectPath);
      if (!configExists) {
        return { ok: true, value: null }; // No config file found
      }

      // Parse config
      const configResult = await parseConfigFile(configFile);
      if (!configResult.ok) {
        return configResult;
      }

      const config = configResult.value;
      const now = new Date();
      const destroyAt = calculateDestroyTime(config.timeout, now);

      // Check if project exists
      const existingResult = await this.projectRepository.findByPath(projectPath);
      if (!existingResult.ok) {
        return existingResult;
      }

      if (existingResult.value) {
        // Update existing
        const updateResult = await this.projectRepository.update(existingResult.value.id, {
          name: config.name,
          config: JSON.stringify(config),
          destroyAt
        });

        if (updateResult.ok) {
          this.emit({ type: 'updated', project: updateResult.value });
        }

        return updateResult;
      } else {
        // Create new
        const newProject: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
          path: projectPath,
          name: config.name,
          config: JSON.stringify(config),
          discoveredAt: now,
          destroyAt,
          status: 'active'
        };

        const createResult = await this.projectRepository.create(newProject);
        
        if (createResult.ok) {
          // Log discovery event
          await this.eventRepository.log({
            projectId: createResult.value.id,
            eventType: 'discovered' as EventType,
            details: JSON.stringify({ action: 'created', configPath: configFile })
          });

          this.emit({ type: 'discovered', project: createResult.value });
        }

        return createResult;
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error('Project discovery failed')
      };
    }
  }
}