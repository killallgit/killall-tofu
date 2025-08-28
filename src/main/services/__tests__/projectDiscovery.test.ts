// Project discovery service tests
// Tests directory scanning, project registration, and lifecycle management

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { Result, ProjectRepository, EventRepository, Project } from '../../database/types';
import { ProjectDiscoveryService, DiscoveryOptions } from '../projectDiscovery';

// Mock repositories
class MockProjectRepository implements ProjectRepository {
  private projects: Project[] = [];
  private nextId = 1;

  async create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<Project>> {
    const newProject: Project = {
      ...project,
      id: (this.nextId++).toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.push(newProject);
    return { ok: true, value: newProject };
  }

  async update(id: string, updates: Partial<Pick<Project, 'name' | 'destroyAt' | 'status' | 'config'>>): Promise<Result<Project>> {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) {
      return { ok: false, error: new Error('Project not found') };
    }

    this.projects[index] = {
      ...this.projects[index],
      ...updates,
      updatedAt: new Date(),
    };

    return { ok: true, value: this.projects[index] };
  }

  async delete(id: string): Promise<Result<void>> {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) {
      return { ok: false, error: new Error('Project not found') };
    }

    this.projects.splice(index, 1);
    return { ok: true, value: undefined };
  }

  async findById(id: string): Promise<Result<Project | null>> {
    const project = this.projects.find(p => p.id === id) || null;
    return { ok: true, value: project };
  }

  async findByPath(path: string): Promise<Result<Project | null>> {
    const project = this.projects.find(p => p.path === path) || null;
    return { ok: true, value: project };
  }

  async findActive(): Promise<Result<Project[]>> {
    const active = this.projects.filter(p => p.status === 'active');
    return { ok: true, value: active };
  }

  async findByStatus(status: string): Promise<Result<Project[]>> {
    const filtered = this.projects.filter(p => p.status === status);
    return { ok: true, value: filtered };
  }

  // Helper methods for testing
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

  async log(event: any): Promise<Result<number>> {
    const id = this.events.length + 1;
    this.events.push({ ...event, id, timestamp: new Date() });
    return { ok: true, value: id };
  }

  async query(filters: any): Promise<Result<any[]>> {
    return { ok: true, value: this.events };
  }

  // Helper methods for testing
  getAllEvents(): any[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}

describe('ProjectDiscoveryService', () => {
  let tempDir: string;
  let mockProjectRepo: MockProjectRepository;
  let mockEventRepo: MockEventRepository;
  let discoveryService: ProjectDiscoveryService;

  beforeEach(async () => {
    // Create temp directory manually as fs.mkdtemp may not be available in Jest
    const randomId = Math.random().toString(36).substring(2, 15);
    tempDir = path.join(os.tmpdir(), `discovery-test-${randomId}`);
    await fs.mkdir(tempDir, { recursive: true });
    mockProjectRepo = new MockProjectRepository();
    mockEventRepo = new MockEventRepository();
    discoveryService = new ProjectDiscoveryService(mockProjectRepo, mockEventRepo);
  });

  afterEach(async () => {
    // Clean up - try-catch in case of errors
    try {
      // Since fs methods are limited in Jest environment, we'll skip cleanup
      // The OS will clean up temp files
    } catch (error) {
      // Ignore cleanup errors
    }
    mockProjectRepo.clear();
    mockEventRepo.clear();
  });

  describe('discover', () => {
    it('should discover projects with valid .killall.yaml files', async () => {
      // Create test directory structure
      const project1Dir = path.join(tempDir, 'project1');
      const project2Dir = path.join(tempDir, 'nested', 'project2');

      await fs.mkdir(project1Dir, { recursive: true });
      await fs.mkdir(project2Dir, { recursive: true });

      // Create valid config files
      const config1 = `
version: 1
timeout: "2 hours"
name: "Project 1"
command: "terraform destroy -auto-approve"
`;

      const config2 = `
version: 1
timeout: "1 day"
name: "Project 2"
tags:
  - "test"
`;

      await fs.writeFile(path.join(project1Dir, '.killall.yaml'), config1);
      await fs.writeFile(path.join(project2Dir, '.killall.yaml'), config2);

      // Run discovery
      const options: DiscoveryOptions = {
        scanPaths: [tempDir],
        maxDepth: 5,
      };

      const result = await discoveryService.discover(options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.foundProjects).toBe(2);
        expect(result.value.newProjects).toBe(2);
        expect(result.value.updatedProjects).toBe(0);
        expect(result.value.errors).toBe(0);
      }

      // Verify projects were created
      const projects = mockProjectRepo.getAllProjects();
      expect(projects).toHaveLength(2);

      const project1 = projects.find(p => p.name === 'Project 1');
      const project2 = projects.find(p => p.name === 'Project 2');

      expect(project1).toBeDefined();
      expect(project1?.path).toBe(project1Dir);
      expect(project2).toBeDefined();
      expect(project2?.path).toBe(project2Dir);

      // Verify events were logged
      const events = mockEventRepo.getAllEvents();
      expect(events).toHaveLength(2);
      expect(events.every(e => e.eventType === 'discovered')).toBe(true);
    });

    it('should update existing projects when config changes', async () => {
      // First, create a project
      const projectDir = path.join(tempDir, 'project');
      await fs.mkdir(projectDir, { recursive: true });

      const initialConfig = `
version: 1
timeout: "1 hour"
name: "Initial Name"
`;

      await fs.writeFile(path.join(projectDir, '.killall.yaml'), initialConfig);

      // First discovery
      const options: DiscoveryOptions = {
        scanPaths: [tempDir],
      };

      let result = await discoveryService.discover(options);
      expect(result.ok).toBe(true);
      
      let projects = mockProjectRepo.getAllProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Initial Name');

      // Update config file
      const updatedConfig = `
version: 1
timeout: "2 hours"
name: "Updated Name"
command: "new command"
`;

      await fs.writeFile(path.join(projectDir, '.killall.yaml'), updatedConfig);

      // Second discovery
      result = await discoveryService.discover(options);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.foundProjects).toBe(1);
        expect(result.value.newProjects).toBe(0);
        expect(result.value.updatedProjects).toBe(1);
      }

      // Verify project was updated
      projects = mockProjectRepo.getAllProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Updated Name');

      const config = JSON.parse(projects[0].config);
      expect(config.command).toBe('new command');
    });

    it('should handle invalid configuration files', async () => {
      // Create directory with invalid config
      const projectDir = path.join(tempDir, 'invalid-project');
      await fs.mkdir(projectDir, { recursive: true });

      const invalidConfig = `
version: 2
timeout: "invalid duration"
`;

      await fs.writeFile(path.join(projectDir, '.killall.yaml'), invalidConfig);

      const options: DiscoveryOptions = {
        scanPaths: [tempDir],
      };

      const result = await discoveryService.discover(options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.foundProjects).toBe(1);
        expect(result.value.newProjects).toBe(0);
        expect(result.value.errors).toBe(1);
      }

      // No projects should be created
      const projects = mockProjectRepo.getAllProjects();
      expect(projects).toHaveLength(0);
    });

    it('should respect exclusion patterns', async () => {
      // Create projects in both regular and excluded directories
      const regularProject = path.join(tempDir, 'regular-project');
      const nodeModulesProject = path.join(tempDir, 'node_modules', 'some-package');
      const gitProject = path.join(tempDir, '.git', 'hooks');

      await fs.mkdir(regularProject, { recursive: true });
      await fs.mkdir(nodeModulesProject, { recursive: true });
      await fs.mkdir(gitProject, { recursive: true });

      const config = `
version: 1
timeout: "1 hour"
name: "Test Project"
`;

      await fs.writeFile(path.join(regularProject, '.killall.yaml'), config);
      await fs.writeFile(path.join(nodeModulesProject, '.killall.yaml'), config);
      await fs.writeFile(path.join(gitProject, '.killall.yaml'), config);

      const options: DiscoveryOptions = {
        scanPaths: [tempDir],
      };

      const result = await discoveryService.discover(options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should only find the regular project, not the excluded ones
        expect(result.value.foundProjects).toBe(1);
        expect(result.value.newProjects).toBe(1);
      }

      const projects = mockProjectRepo.getAllProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].path).toBe(regularProject);
    });

    it('should respect maximum depth setting', async () => {
      // Create nested directory structure deeper than maxDepth
      const level1 = path.join(tempDir, 'level1');
      const level2 = path.join(level1, 'level2');
      const level3 = path.join(level2, 'level3');

      await fs.mkdir(level3, { recursive: true });

      const config = `
version: 1
timeout: "1 hour"
name: "Deep Project"
`;

      await fs.writeFile(path.join(level3, '.killall.yaml'), config);

      // Discovery with maxDepth=2 should not find the project
      const options: DiscoveryOptions = {
        scanPaths: [tempDir],
        maxDepth: 2,
      };

      const result = await discoveryService.discover(options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.foundProjects).toBe(0);
      }

      // Discovery with maxDepth=5 should find the project
      options.maxDepth = 5;
      const result2 = await discoveryService.discover(options);

      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.value.foundProjects).toBe(1);
      }
    });

    it('should handle inaccessible directories gracefully', async () => {
      const options: DiscoveryOptions = {
        scanPaths: ['/nonexistent/path'],
      };

      const result = await discoveryService.discover(options);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error?.message).toContain('Scan path not accessible');
      }
    });
  });

  describe('discoverProject', () => {
    it('should discover a single project by path', async () => {
      const projectDir = path.join(tempDir, 'single-project');
      await fs.mkdir(projectDir, { recursive: true });

      const config = `
version: 1
timeout: "3 hours"
name: "Single Project"
`;

      await fs.writeFile(path.join(projectDir, '.killall.yaml'), config);

      const result = await discoveryService.discoverProject(projectDir);

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.name).toBe('Single Project');
        expect(result.value.path).toBe(projectDir);
      }

      const projects = mockProjectRepo.getAllProjects();
      expect(projects).toHaveLength(1);
    });

    it('should return null for directories without config files', async () => {
      const projectDir = path.join(tempDir, 'no-config');
      await fs.mkdir(projectDir, { recursive: true });

      const result = await discoveryService.discoverProject(projectDir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }

      const projects = mockProjectRepo.getAllProjects();
      expect(projects).toHaveLength(0);
    });
  });

  describe('event emission', () => {
    it('should emit discovery events', async () => {
      const events: any[] = [];
      discoveryService.on((event) => {
        events.push(event);
      });

      // Create test project
      const projectDir = path.join(tempDir, 'event-project');
      await fs.mkdir(projectDir, { recursive: true });

      const config = `
version: 1
timeout: "1 hour"
name: "Event Project"
`;

      await fs.writeFile(path.join(projectDir, '.killall.yaml'), config);

      const options: DiscoveryOptions = {
        scanPaths: [tempDir],
      };

      const result = await discoveryService.discover(options);
      expect(result.ok).toBe(true);

      // Should have received a discovered event
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('discovered');
      expect(events[0].project?.name).toBe('Event Project');
    });
  });
});