/**
 * Shared type definitions for the killall-tofu application.
 * Follows functional programming principles with explicit error handling.
 */

// Result type for explicit error handling
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

// Project status enumeration
export type ProjectStatus = 
  | 'discovered'
  | 'scheduled'
  | 'destroying'
  | 'destroyed'
  | 'failed'
  | 'cancelled';

// Core domain entities
export interface Project {
  id: string;
  path: string;
  config: ProjectConfig;
  discoveredAt: Date;
  destroyAt: Date;
  status: ProjectStatus;
  lastExecutionId?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectConfig {
  version: number;
  timeout: string;
  command?: string;
  name?: string;
  tags?: string[];
  execution?: ExecutionConfig;
  hooks?: HookConfig;
}

export interface ExecutionConfig {
  retries?: number;
  environment?: Record<string, string>;
  workingDirectory?: string;
  shell?: string;
}

export interface HookConfig {
  beforeDestroy?: string[];
  afterDestroy?: string[];
  onFailure?: string[];
}

// Execution tracking
export interface Execution {
  id: string;
  projectId: string;
  startedAt: Date;
  completedAt?: Date;
  status: ExecutionStatus;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  duration?: number;
}

export type ExecutionStatus = 
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

// Service interfaces for dependency injection
export interface DatabaseService {
  projects: ProjectRepository;
  executions: ExecutionRepository;
  close(): Promise<void>;
}

export interface ProjectRepository {
  create(project: Project): Promise<Result<Project>>;
  findById(id: string): Promise<Result<Project | null>>;
  findByPath(path: string): Promise<Result<Project | null>>;
  findByStatus(status: ProjectStatus): Promise<Result<Project[]>>;
  findByTag(tag: string): Promise<Result<Project[]>>;
  update(id: string, updates: Partial<Project>): Promise<Result<Project>>;
  delete(id: string): Promise<Result<void>>;
  list(): Promise<Result<Project[]>>;
}

export interface ExecutionRepository {
  create(execution: Execution): Promise<Result<Execution>>;
  findById(id: string): Promise<Result<Execution | null>>;
  findByProjectId(projectId: string): Promise<Result<Execution[]>>;
  findByStatus(status: ExecutionStatus): Promise<Result<Execution[]>>;
  update(id: string, updates: Partial<Execution>): Promise<Result<Execution>>;
  list(limit?: number, offset?: number): Promise<Result<Execution[]>>;
}

export interface FileWatcherService {
  watch(paths: string[]): Promise<Result<void>>;
  stop(): Promise<Result<void>>;
  onProjectDiscovered(callback: (path: string) => void): void;
  onProjectRemoved(callback: (path: string) => void): void;
}

export interface SchedulerService {
  schedule(project: Project): Promise<Result<void>>;
  cancel(projectId: string): Promise<Result<void>>;
  reschedule(projectId: string, newDate: Date): Promise<Result<void>>;
  getScheduled(): Promise<Result<Project[]>>;
  start(): Promise<Result<void>>;
  stop(): Promise<Result<void>>;
}

export interface ExecutorService {
  execute(project: Project): Promise<Result<Execution>>;
  cancel(executionId: string): Promise<Result<void>>;
  getRunning(): Promise<Result<Execution[]>>;
}

export interface NotifierService {
  notify(message: NotificationMessage): Promise<Result<void>>;
  subscribe(callback: (message: NotificationMessage) => void): void;
}

export interface NotificationMessage {
  type: NotificationType;
  title: string;
  body: string;
  projectId?: string;
  executionId?: string;
  timestamp: Date;
}

export type NotificationType = 
  | 'info'
  | 'success' 
  | 'warning'
  | 'error';

// Configuration types
export interface AppConfig {
  database: DatabaseConfig;
  watcher: WatcherConfig;
  scheduler: SchedulerConfig;
  executor: ExecutorConfig;
  notifications: NotificationConfig;
}

export interface DatabaseConfig {
  path: string;
  maxConnections?: number;
  timeout?: number;
}

export interface WatcherConfig {
  paths: string[];
  ignored?: string[];
  pollInterval?: number;
}

export interface SchedulerConfig {
  maxConcurrentJobs?: number;
  defaultTimeout?: string;
  retryAttempts?: number;
}

export interface ExecutorConfig {
  maxConcurrentExecutions?: number;
  defaultShell?: string;
  environment?: Record<string, string>;
}

export interface NotificationConfig {
  enabled: boolean;
  desktop?: boolean;
  sound?: boolean;
}

// Utility types for functional programming
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

export type Mapper<T, U> = (value: T) => U;
export type AsyncMapper<T, U> = (value: T) => Promise<U>;
export type Predicate<T> = (value: T) => boolean;
export type AsyncPredicate<T> = (value: T) => Promise<boolean>;

// Event system types
export interface DomainEvent {
  type: string;
  id: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface ProjectDiscoveredEvent extends DomainEvent {
  type: 'project.discovered';
  data: {
    projectId: string;
    path: string;
    config: ProjectConfig;
  };
}

export interface ProjectScheduledEvent extends DomainEvent {
  type: 'project.scheduled';
  data: {
    projectId: string;
    destroyAt: Date;
  };
}

export interface ExecutionStartedEvent extends DomainEvent {
  type: 'execution.started';
  data: {
    executionId: string;
    projectId: string;
  };
}

export interface ExecutionCompletedEvent extends DomainEvent {
  type: 'execution.completed';
  data: {
    executionId: string;
    projectId: string;
    exitCode: number;
    duration: number;
  };
}

export type EventType = 
  | ProjectDiscoveredEvent
  | ProjectScheduledEvent
  | ExecutionStartedEvent
  | ExecutionCompletedEvent;

// Error types for better error handling
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class ExecutionError extends Error {
  constructor(message: string, public exitCode?: number) {
    super(message);
    this.name = 'ExecutionError';
  }
}