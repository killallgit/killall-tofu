// File watcher service tests
// Tests file system monitoring, debouncing, and integration with project discovery

import { FileWatcherService, FileWatcherOptions } from '../fileWatcher';
import { Database, Project, ProjectRepository, EventRepository, ExecutionRepository } from '../../database/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock database and repositories (reusing from projectDiscovery.test.ts)
class MockProjectRepository implements ProjectRepository {
  private projects: Project[] = [];
  private nextId = 1;

  async create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) {
    const newProject: Project = {
      ...project,
      id: (this.nextId++).toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.push(newProject);
    return { ok: true as const, value: newProject };
  }

  async update(id: string, updates: any) {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) {
      return { ok: false as const, error: new Error('Project not found') };
    }

    this.projects[index] = {
      ...this.projects[index],
      ...updates,
      updatedAt: new Date(),
    };

    return { ok: true as const, value: this.projects[index] };
  }

  async delete(id: string) {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) {
      return { ok: false as const, error: new Error('Project not found') };
    }

    this.projects.splice(index, 1);
    return { ok: true as const, value: undefined };
  }

  async findById(id: string) {
    const project = this.projects.find(p => p.id === id) || null;
    return { ok: true as const, value: project };
  }

  async findByPath(path: string) {
    const project = this.projects.find(p => p.path === path) || null;
    return { ok: true as const, value: project };
  }

  async findActive() {
    const active = this.projects.filter(p => p.status === 'active');
    return { ok: true as const, value: active };
  }

  async findByStatus(status: any) {
    const filtered = this.projects.filter(p => p.status === status);
    return { ok: true as const, value: filtered };
  }

  getAllProjects(): Project[] {
    return [...this.projects];
  }

  clear(): void {
    this.projects = [];
    this.nextId = 1;
  }
}

class MockEventRepository implements EventRepository {
  private events: any[] = [];

  async log(event: any) {
    const id = this.events.length + 1;
    this.events.push({ ...event, id, timestamp: new Date() });
    return { ok: true as const, value: id };
  }

  async query(filters: any) {
    return { ok: true as const, value: this.events };
  }

  clear(): void {
    this.events = [];
  }
}

class MockExecutionRepository implements ExecutionRepository {
  async create(execution: any) {
    return { ok: true as const, value: 1 };
  }

  async update(id: number, updates: any) {
    return { ok: true as const, value: {} as any };
  }

  async findByProject(projectId: string) {
    return { ok: true as const, value: [] };
  }

  async findRunning() {
    return { ok: true as const, value: [] };
  }
}

class MockDatabase implements Database {
  projects: ProjectRepository;
  executions: ExecutionRepository;
  events: EventRepository;

  constructor() {
    this.projects = new MockProjectRepository();
    this.executions = new MockExecutionRepository();
    this.events = new MockEventRepository();
  }

  async connect() {
    return { ok: true as const, value: undefined };
  }

  async disconnect() {
    return { ok: true as const, value: undefined };
  }

  async transaction<T>(fn: any): Promise<any> {
    return { ok: true as const, value: await fn(null) };
  }

  clear(): void {
    (this.projects as MockProjectRepository).clear();
    (this.events as MockEventRepository).clear();
  }
}

describe('FileWatcherService', () => {
  let tempDir: string;
  let mockDatabase: MockDatabase;
  let fileWatcher: FileWatcherService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filewatcher-test-'));
    mockDatabase = new MockDatabase();
    fileWatcher = new FileWatcherService(mockDatabase);
  });

  afterEach(async () => {
    await fileWatcher.stop();
    await fs.rmdir(tempDir, { recursive: true });
    mockDatabase.clear();
  });

  describe('start and stop', () => {
    it('should start file watching successfully', async () => {
      const options: FileWatcherOptions = {
        watchPaths: [tempDir],
        debounceDelay: 100,
      };

      const result = await fileWatcher.start(options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.watchedPaths).toEqual([tempDir]);
        expect(result.value.isWatching).toBe(true);
      }

      expect(fileWatcher.isWatching()).toBe(true);
    });

    it('should stop file watching successfully', async () => {
      const options: FileWatcherOptions = {
        watchPaths: [tempDir],
      };

      await fileWatcher.start(options);
      expect(fileWatcher.isWatching()).toBe(true);

      const result = await fileWatcher.stop();

      expect(result.ok).toBe(true);
      expect(fileWatcher.isWatching()).toBe(false);
    });

    it('should handle invalid watch paths', async () => {
      const options: FileWatcherOptions = {
        watchPaths: [],
      };

      const result = await fileWatcher.start(options);

      expect(result.ok).toBe(false);
      expect(result.error?.message).toContain('At least one watch path must be specified');
    });

    it('should restart when already running', async () => {
      const options: FileWatcherOptions = {
        watchPaths: [tempDir],
      };

      // Start first time
      let result = await fileWatcher.start(options);
      expect(result.ok).toBe(true);

      // Start second time (should restart)
      result = await fileWatcher.start(options);
      expect(result.ok).toBe(true);
      expect(fileWatcher.isWatching()).toBe(true);
    });
  });

  describe('file system monitoring', () => {
    it('should detect new .killall.yaml files', (done) => {
      const options: FileWatcherOptions = {
        watchPaths: [tempDir],
        debounceDelay: 50, // Short delay for testing
      };

      // Set up event listener
      fileWatcher.once('projectDiscovered', (event) => {
        expect(event.type).toBe('projectDiscovered');
        expect(event.project?.name).toBe('Test Project');
        done();
      });

      fileWatcher.start(options).then(async (result) => {
        expect(result.ok).toBe(true);

        // Create a new project after a short delay
        setTimeout(async () => {
          const projectDir = path.join(tempDir, 'new-project');
          await fs.mkdir(projectDir, { recursive: true });

          const config = `
version: 1
timeout: "1 hour"
name: "Test Project"
`;

          await fs.writeFile(path.join(projectDir, '.killall.yaml'), config);
        }, 100);
      });
    }, 10000);

    it('should detect changes to existing .killall.yaml files', (done) => {
      const options: FileWatcherOptions = {
        watchPaths: [tempDir],
        debounceDelay: 50,
        ignoreInitial: false, // Don't ignore initial scan
      };

      let eventCount = 0;

      fileWatcher.on('projectDiscovered', () => {
        eventCount++;
      });

      fileWatcher.on('projectUpdated', (event) => {
        expect(event.type).toBe('projectUpdated');
        expect(eventCount).toBe(1); // Should have seen one discovered event first
        done();
      });

      // First create the project
      const setupProject = async () => {
        const projectDir = path.join(tempDir, 'existing-project');
        await fs.mkdir(projectDir, { recursive: true });

        const config = `
version: 1
timeout: "1 hour"
name: "Original Name"
`;

        await fs.writeFile(path.join(projectDir, '.killall.yaml'), config);

        // Start watching
        const result = await fileWatcher.start(options);
        expect(result.ok).toBe(true);

        // Wait a bit, then update the file
        setTimeout(async () => {
          const updatedConfig = `
version: 1
timeout: "2 hours"
name: "Updated Name"
`;

          await fs.writeFile(path.join(projectDir, '.killall.yaml'), updatedConfig);
        }, 200);
      };

      setupProject();
    }, 10000);

    it('should detect deletion of .killall.yaml files', (done) => {
      const options: FileWatcherOptions = {
        watchPaths: [tempDir],
        debounceDelay: 50,
      };

      fileWatcher.on('projectRemoved', (event) => {
        expect(event.type).toBe('projectRemoved');
        done();
      });

      const setupAndDelete = async () => {
        // Create project first
        const projectDir = path.join(tempDir, 'to-be-deleted');
        await fs.mkdir(projectDir, { recursive: true });

        const config = `
version: 1
timeout: "1 hour"
name: "To Be Deleted"
`;

        const configPath = path.join(projectDir, '.killall.yaml');
        await fs.writeFile(configPath, config);

        // Manually add project to repository to simulate existing project
        await mockDatabase.projects.create({
          path: projectDir,
          name: 'To Be Deleted',
          config: JSON.stringify({ version: 1, timeout: '1 hour', name: 'To Be Deleted' }),
          discoveredAt: new Date(),
          destroyAt: new Date(Date.now() + 3600000),
          status: 'active',
        });

        // Start watching
        const result = await fileWatcher.start(options);
        expect(result.ok).toBe(true);

        // Wait a bit, then delete the file
        setTimeout(async () => {
          await fs.unlink(configPath);
        }, 200);
      };

      setupAndDelete();
    }, 10000);
  });

  describe('manual scanning', () => {
    it('should perform manual scan when requested', async () => {
      // Create a project before starting watcher
      const projectDir = path.join(tempDir, 'manual-scan-project');
      await fs.mkdir(projectDir, { recursive: true });

      const config = `
version: 1
timeout: "1 hour"
name: "Manual Scan Project"
`;

      await fs.writeFile(path.join(projectDir, '.killall.yaml'), config);

      const options: FileWatcherOptions = {
        watchPaths: [tempDir],
        ignoreInitial: true, // Don't scan initially
      };

      const result = await fileWatcher.start(options);
      expect(result.ok).toBe(true);

      // Manually trigger scan
      const scanResult = await fileWatcher.scan();
      expect(scanResult.ok).toBe(true);

      // Check that project was discovered
      const stats = fileWatcher.getStats();
      expect(stats.discoveredProjects).toBe(1);
      expect(stats.lastScanTime).toBeDefined();
    });

    it('should fail manual scan when not watching', async () => {
      const result = await fileWatcher.scan();

      expect(result.ok).toBe(false);
      expect(result.error?.message).toContain('File watcher is not running');
    });
  });

  describe('watch path management', () => {
    it('should add new watch paths', async () => {
      const options: FileWatcherOptions = {
        watchPaths: [tempDir],
      };

      const result = await fileWatcher.start(options);
      expect(result.ok).toBe(true);

      const newPath = path.join(tempDir, 'new-watch-dir');
      await fs.mkdir(newPath, { recursive: true });

      const addResult = await fileWatcher.addWatchPath(newPath);
      expect(addResult.ok).toBe(true);

      const stats = fileWatcher.getStats();
      expect(stats.watchedPaths).toContain(newPath);
    });

    it('should remove watch paths', async () => {
      const extraPath = path.join(tempDir, 'extra-path');
      await fs.mkdir(extraPath, { recursive: true });

      const options: FileWatcherOptions = {
        watchPaths: [tempDir, extraPath],
      };

      const result = await fileWatcher.start(options);
      expect(result.ok).toBe(true);

      const removeResult = await fileWatcher.removeWatchPath(extraPath);
      expect(removeResult.ok).toBe(true);

      const stats = fileWatcher.getStats();
      expect(stats.watchedPaths).not.toContain(extraPath);
      expect(stats.watchedPaths).toContain(tempDir);
    });

    it('should fail path operations when not watching', async () => {
      const addResult = await fileWatcher.addWatchPath('/some/path');
      expect(addResult.ok).toBe(false);

      const removeResult = await fileWatcher.removeWatchPath('/some/path');
      expect(removeResult.ok).toBe(false);
    });
  });

  describe('statistics and monitoring', () => {
    it('should provide accurate statistics', async () => {
      const options: FileWatcherOptions = {
        watchPaths: [tempDir],
      };

      const result = await fileWatcher.start(options);
      expect(result.ok).toBe(true);

      const stats = fileWatcher.getStats();
      expect(stats.watchedPaths).toEqual([tempDir]);
      expect(stats.isWatching).toBe(true);
      expect(stats.errors).toBe(0);
      expect(stats.discoveredProjects).toBe(0);
    });

    it('should track errors correctly', async () => {
      const options: FileWatcherOptions = {
        watchPaths: [tempDir],
        ignoreInitial: false,
      };

      // Create invalid config that will cause errors
      const projectDir = path.join(tempDir, 'invalid-project');
      await fs.mkdir(projectDir, { recursive: true });

      const invalidConfig = `
version: 2
timeout: "invalid"
`;

      await fs.writeFile(path.join(projectDir, '.killall.yaml'), invalidConfig);

      const result = await fileWatcher.start(options);
      expect(result.ok).toBe(true);

      // Wait for initial scan to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      const stats = fileWatcher.getStats();
      expect(stats.errors).toBeGreaterThan(0);
    });
  });

  describe('error handling and resilience', () => {
    it('should handle file system errors gracefully', (done) => {
      const options: FileWatcherOptions = {
        watchPaths: [tempDir],
        debounceDelay: 50,
      };

      fileWatcher.on('error', (errorEvent) => {
        expect(errorEvent.error).toBeDefined();
        done();
      });

      fileWatcher.start(options).then(async () => {
        // Create a scenario that might cause errors
        const projectDir = path.join(tempDir, 'error-project');
        await fs.mkdir(projectDir, { recursive: true });
        
        // Write a file that we'll make unreadable
        const configPath = path.join(projectDir, '.killall.yaml');
        await fs.writeFile(configPath, 'version: 1\ntimeout: "1 hour"');
        
        // Wait a moment then trigger an error scenario
        setTimeout(async () => {
          try {
            // Try to write invalid YAML that will cause parsing errors
            await fs.writeFile(configPath, 'invalid: [unclosed');
          } catch (error) {
            // If file operations fail, that's also a valid test scenario
          }
        }, 100);
      });
    }, 5000);
  });
});