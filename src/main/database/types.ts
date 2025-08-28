// Database-specific types for the Database Service implementation
// Note: These will be moved to shared/types.ts when the Foundation stream completes

// Result type for explicit error handling (functional programming standard)
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

// Project status enumeration
export type ProjectStatus = 
  | 'active'      // Registered and waiting for destruction
  | 'pending'     // About to be destroyed (within warning time)
  | 'destroying'  // Currently being destroyed
  | 'destroyed'   // Successfully destroyed
  | 'failed'      // Destruction failed
  | 'cancelled';  // Cancelled by user

// Execution status enumeration
export type ExecutionStatus = 
  | 'running'     // Command currently executing
  | 'completed'   // Command completed successfully
  | 'failed'      // Command failed
  | 'timeout';    // Command timed out

// Event type enumeration for audit logging
export type EventType =
  | 'discovered'  // Project discovered in filesystem
  | 'registered'  // Project registered for destruction
  | 'warning'     // Warning notification sent
  | 'destroying'  // Destruction process started
  | 'destroyed'   // Infrastructure destroyed successfully
  | 'failed'      // Destruction failed
  | 'cancelled'   // Destruction cancelled
  | 'extended'    // Timer extended
  | 'error';      // System error occurred

// Core domain entities for database storage
export interface Project {
  id: string;
  path: string;
  name?: string;
  config: string; // JSON-serialized ProjectConfig
  discoveredAt: Date;
  destroyAt: Date;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Execution {
  id?: number;
  projectId: string;
  command: string;
  workingDir: string;
  startedAt: Date;
  completedAt?: Date;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  status: ExecutionStatus;
  attemptNumber: number;
}

export interface Event {
  id?: number;
  projectId?: string;
  eventType: EventType;
  details?: string; // JSON serialized additional data
  timestamp: Date;
}

// Configuration interfaces (subset needed for database operations)
export interface ProjectConfig {
  version: number;
  timeout: string;
  command?: string;
  name?: string;
  tags?: string[];
  execution?: {
    timeout?: number;
    workingDir?: string;
    environment?: Record<string, string>;
  };
  hooks?: {
    preDestroy?: string[];
    postDestroy?: string[];
  };
}

// Database transaction function type
export type TransactionFn<T> = (trx: any) => Promise<T>;

// Database service interfaces
export interface ProjectRepository {
  create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<Project>>;
  update(id: string, updates: Partial<Pick<Project, 'name' | 'destroyAt' | 'status' | 'config'>>): Promise<Result<Project>>;
  delete(id: string): Promise<Result<void>>;
  findById(id: string): Promise<Result<Project | null>>;
  findByPath(path: string): Promise<Result<Project | null>>;
  findActive(): Promise<Result<Project[]>>;
  findByStatus(status: ProjectStatus): Promise<Result<Project[]>>;
}

export interface ExecutionRepository {
  create(execution: Omit<Execution, 'id'>): Promise<Result<number>>;
  update(id: number, updates: Partial<Pick<Execution, 'completedAt' | 'exitCode' | 'stdout' | 'stderr' | 'status'>>): Promise<Result<Execution>>;
  findByProject(projectId: string): Promise<Result<Execution[]>>;
  findRunning(): Promise<Result<Execution[]>>;
}

export interface EventRepository {
  log(event: Omit<Event, 'id' | 'timestamp'>): Promise<Result<number>>;
  query(filters: {
    projectId?: string;
    eventType?: EventType;
    since?: Date;
    limit?: number;
  }): Promise<Result<Event[]>>;
}

export interface Database {
  connect(): Promise<Result<void>>;
  disconnect(): Promise<Result<void>>;
  transaction<T>(fn: TransactionFn<T>): Promise<Result<T>>;
  
  // Repository instances
  projects: ProjectRepository;
  executions: ExecutionRepository;
  events: EventRepository;
}