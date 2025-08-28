/**
 * Mock database service implementation for testing and parallel development.
 */

import { 
  DatabaseService, 
  ProjectRepository, 
  ExecutionRepository,
  Project, 
  Execution, 
  ProjectStatus, 
  ExecutionStatus,
  Result 
} from '../types';
import { Ok, Err } from '../utils/result';
// Generate deterministic UUIDs for testing
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export class MockProjectRepository implements ProjectRepository {
  private projects = new Map<string, Project>();

  async create(project: Project): Promise<Result<Project>> {
    if (this.projects.has(project.id)) {
      return Err(new Error(`Project with id ${project.id} already exists`));
    }

    const projectWithId = { ...project, id: project.id || generateId() };
    this.projects.set(projectWithId.id, projectWithId);
    return Ok(projectWithId);
  }

  async findById(id: string): Promise<Result<Project | null>> {
    const project = this.projects.get(id) || null;
    return Ok(project);
  }

  async findByPath(path: string): Promise<Result<Project | null>> {
    const project = Array.from(this.projects.values()).find(p => p.path === path) || null;
    return Ok(project);
  }

  async findByStatus(status: ProjectStatus): Promise<Result<Project[]>> {
    const projects = Array.from(this.projects.values()).filter(p => p.status === status);
    return Ok(projects);
  }

  async findByTag(tag: string): Promise<Result<Project[]>> {
    const projects = Array.from(this.projects.values()).filter(p => 
      p.config.tags?.includes(tag) || false
    );
    return Ok(projects);
  }

  async update(id: string, updates: Partial<Project>): Promise<Result<Project>> {
    const existing = this.projects.get(id);
    if (!existing) {
      return Err(new Error(`Project with id ${id} not found`));
    }

    const updated = { ...existing, ...updates, id };
    this.projects.set(id, updated);
    return Ok(updated);
  }

  async delete(id: string): Promise<Result<void>> {
    if (!this.projects.has(id)) {
      return Err(new Error(`Project with id ${id} not found`));
    }

    this.projects.delete(id);
    return Ok(void 0);
  }

  async list(): Promise<Result<Project[]>> {
    const projects = Array.from(this.projects.values());
    return Ok(projects);
  }

  // Testing utilities
  clear(): void {
    this.projects.clear();
  }

  size(): number {
    return this.projects.size;
  }
}

export class MockExecutionRepository implements ExecutionRepository {
  private executions = new Map<string, Execution>();

  async create(execution: Execution): Promise<Result<Execution>> {
    if (this.executions.has(execution.id)) {
      return Err(new Error(`Execution with id ${execution.id} already exists`));
    }

    const executionWithId = { ...execution, id: execution.id || generateId() };
    this.executions.set(executionWithId.id, executionWithId);
    return Ok(executionWithId);
  }

  async findById(id: string): Promise<Result<Execution | null>> {
    const execution = this.executions.get(id) || null;
    return Ok(execution);
  }

  async findByProjectId(projectId: string): Promise<Result<Execution[]>> {
    const executions = Array.from(this.executions.values()).filter(e => e.projectId === projectId);
    return Ok(executions);
  }

  async findByStatus(status: ExecutionStatus): Promise<Result<Execution[]>> {
    const executions = Array.from(this.executions.values()).filter(e => e.status === status);
    return Ok(executions);
  }

  async update(id: string, updates: Partial<Execution>): Promise<Result<Execution>> {
    const existing = this.executions.get(id);
    if (!existing) {
      return Err(new Error(`Execution with id ${id} not found`));
    }

    const updated = { ...existing, ...updates, id };
    this.executions.set(id, updated);
    return Ok(updated);
  }

  async list(limit?: number, offset?: number): Promise<Result<Execution[]>> {
    let executions = Array.from(this.executions.values());
    
    // Sort by startedAt descending (most recent first)
    executions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    
    if (offset) {
      executions = executions.slice(offset);
    }
    
    if (limit) {
      executions = executions.slice(0, limit);
    }
    
    return Ok(executions);
  }

  // Testing utilities
  clear(): void {
    this.executions.clear();
  }

  size(): number {
    return this.executions.size;
  }
}

export class MockDatabase implements DatabaseService {
  public projects: MockProjectRepository;
  public executions: MockExecutionRepository;

  constructor() {
    this.projects = new MockProjectRepository();
    this.executions = new MockExecutionRepository();
  }

  async close(): Promise<void> {
    // Mock database doesn't need cleanup
  }

  // Testing utilities
  clear(): void {
    this.projects.clear();
    this.executions.clear();
  }

  async seed(data: { projects?: Project[]; executions?: Execution[] }): Promise<void> {
    if (data.projects) {
      for (const project of data.projects) {
        await this.projects.create(project);
      }
    }

    if (data.executions) {
      for (const execution of data.executions) {
        await this.executions.create(execution);
      }
    }
  }
}

// Factory function for creating configured mock database
export const createMockDatabase = (options?: {
  projects?: Project[];
  executions?: Execution[];
}): MockDatabase => {
  const db = new MockDatabase();
  
  if (options) {
    // Seed with initial data asynchronously
    db.seed(options).catch(error => {
      console.error('Failed to seed mock database:', error);
    });
  }
  
  return db;
};

// Predefined test data generators
export const createTestProject = (overrides: Partial<Project> = {}): Project => ({
  id: generateId(),
  path: '/test/project',
  config: {
    version: 1,
    timeout: '1 hour',
    name: 'test-project',
    tags: ['test'],
  },
  discoveredAt: new Date(),
  destroyAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  status: 'discovered',
  ...overrides,
});

export const createTestExecution = (overrides: Partial<Execution> = {}): Execution => ({
  id: generateId(),
  projectId: generateId(),
  startedAt: new Date(),
  status: 'queued',
  ...overrides,
});

// Test scenarios
export const TEST_SCENARIOS = {
  emptyDatabase: () => new MockDatabase(),
  
  withSampleProjects: () => {
    const db = new MockDatabase();
    const projects = [
      createTestProject({ 
        path: '/project1', 
        status: 'discovered',
        config: { version: 1, timeout: '30m', tags: ['frontend'] }
      }),
      createTestProject({ 
        path: '/project2', 
        status: 'scheduled',
        config: { version: 1, timeout: '1h', tags: ['backend'] }
      }),
      createTestProject({ 
        path: '/project3', 
        status: 'destroying',
        config: { version: 1, timeout: '2h', tags: ['database'] }
      }),
    ];
    
    db.seed({ projects }).catch(console.error);
    return db;
  },

  withSampleExecutions: () => {
    const db = new MockDatabase();
    const projectId = generateId();
    const project = createTestProject({ id: projectId });
    const executions = [
      createTestExecution({ projectId, status: 'completed', exitCode: 0 }),
      createTestExecution({ projectId, status: 'failed', exitCode: 1 }),
      createTestExecution({ projectId, status: 'running' }),
    ];
    
    db.seed({ projects: [project], executions }).catch(console.error);
    return db;
  },
};