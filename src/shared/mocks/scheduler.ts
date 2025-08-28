/**
 * Mock scheduler service implementation for testing and parallel development.
 */

import { EventEmitter } from 'events';

import { SchedulerService, Project, Result } from '../types';
import { Ok, Err } from '../utils/result';

interface ScheduledTask {
  project: Project;
  scheduledFor: Date;
  timeoutId?: ReturnType<typeof setTimeout>;
}

export class MockScheduler extends EventEmitter implements SchedulerService {
  private isRunning = false;
  private scheduledTasks = new Map<string, ScheduledTask>();
  private config: {
    maxConcurrentJobs: number;
    processingDelay: number;
    errorRate: number;
  };

  constructor(config: Partial<MockScheduler['config']> = {}) {
    super();
    this.config = {
      maxConcurrentJobs: 5,
      processingDelay: 100, // ms
      errorRate: 0, // 0-1 probability
      ...config,
    };
  }

  async start(): Promise<Result<void>> {
    if (this.isRunning) {
      return Err(new Error('Scheduler is already running'));
    }

    this.isRunning = true;
    this.emit('started');
    
    // Resume existing scheduled tasks
    for (const [projectId, task] of this.scheduledTasks) {
      this.scheduleExecution(projectId, task);
    }

    return Ok(void 0);
  }

  async stop(): Promise<Result<void>> {
    if (!this.isRunning) {
      return Err(new Error('Scheduler is not running'));
    }

    this.isRunning = false;
    
    // Cancel all scheduled tasks
    for (const task of this.scheduledTasks.values()) {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
    }

    this.emit('stopped');
    return Ok(void 0);
  }

  async schedule(project: Project): Promise<Result<void>> {
    if (!this.isRunning) {
      return Err(new Error('Scheduler is not running'));
    }

    // Simulate random errors
    if (Math.random() < this.config.errorRate) {
      return Err(new Error('Simulated scheduler error'));
    }

    // Check if already scheduled
    if (this.scheduledTasks.has(project.id)) {
      return Err(new Error(`Project ${project.id} is already scheduled`));
    }

    // Check max concurrent jobs
    if (this.scheduledTasks.size >= this.config.maxConcurrentJobs) {
      return Err(new Error('Maximum concurrent jobs reached'));
    }

    const task: ScheduledTask = {
      project: { ...project },
      scheduledFor: new Date(project.destroyAt),
    };

    this.scheduledTasks.set(project.id, task);
    
    if (this.isRunning) {
      this.scheduleExecution(project.id, task);
    }

    this.emit('scheduled', { projectId: project.id, scheduledFor: task.scheduledFor });
    return Ok(void 0);
  }

  async cancel(projectId: string): Promise<Result<void>> {
    const task = this.scheduledTasks.get(projectId);
    if (!task) {
      return Err(new Error(`No scheduled task found for project ${projectId}`));
    }

    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
    }

    this.scheduledTasks.delete(projectId);
    this.emit('cancelled', { projectId });
    return Ok(void 0);
  }

  async reschedule(projectId: string, newDate: Date): Promise<Result<void>> {
    const task = this.scheduledTasks.get(projectId);
    if (!task) {
      return Err(new Error(`No scheduled task found for project ${projectId}`));
    }

    // Cancel existing timeout
    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
    }

    // Update the task
    task.scheduledFor = new Date(newDate);
    task.project.destroyAt = new Date(newDate);

    if (this.isRunning) {
      this.scheduleExecution(projectId, task);
    }

    this.emit('rescheduled', { projectId, newScheduledFor: newDate });
    return Ok(void 0);
  }

  async getScheduled(): Promise<Result<Project[]>> {
    const projects = Array.from(this.scheduledTasks.values()).map(task => task.project);
    return Ok(projects);
  }

  // Private helper methods
  private scheduleExecution(projectId: string, task: ScheduledTask): void {
    const now = new Date();
    const delay = Math.max(0, task.scheduledFor.getTime() - now.getTime());

    task.timeoutId = setTimeout(() => {
      this.executeScheduledTask(projectId);
    }, delay);
  }

  private executeScheduledTask(projectId: string): void {
    const task = this.scheduledTasks.get(projectId);
    if (!task) {
      return;
    }

    this.scheduledTasks.delete(projectId);

    // Simulate processing delay
    setTimeout(() => {
      this.emit('executing', { 
        projectId, 
        project: task.project,
        actualExecutionTime: new Date(),
      });
      
      // Simulate execution completion
      setTimeout(() => {
        this.emit('completed', { 
          projectId,
          success: Math.random() > 0.1, // 90% success rate
        });
      }, this.config.processingDelay);
    }, Math.random() * 50); // Random jitter
  }

  // Testing utilities
  isActive(): boolean {
    return this.isRunning;
  }

  getScheduledCount(): number {
    return this.scheduledTasks.size;
  }

  getScheduledProjects(): Project[] {
    return Array.from(this.scheduledTasks.values()).map(task => task.project);
  }

  hasScheduledProject(projectId: string): boolean {
    return this.scheduledTasks.has(projectId);
  }

  getNextExecutionTime(projectId: string): Date | null {
    const task = this.scheduledTasks.get(projectId);
    return task ? task.scheduledFor : null;
  }

  // Force immediate execution (for testing)
  async forceExecute(projectId: string): Promise<Result<void>> {
    const task = this.scheduledTasks.get(projectId);
    if (!task) {
      return Err(new Error(`No scheduled task found for project ${projectId}`));
    }

    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
    }

    this.executeScheduledTask(projectId);
    return Ok(void 0);
  }

  // Force execution of all scheduled tasks (for testing)
  forceExecuteAll(): void {
    const projectIds = Array.from(this.scheduledTasks.keys());
    projectIds.forEach(id => {
      this.forceExecute(id).catch(console.error);
    });
  }

  // Simulate scheduler failure
  simulateFailure(error?: Error): void {
    this.isRunning = false;
    
    // Cancel all timeouts
    for (const task of this.scheduledTasks.values()) {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
    }

    this.emit('error', error || new Error('Simulated scheduler failure'));
  }

  // Clear all scheduled tasks (for testing)
  clearAll(): void {
    for (const task of this.scheduledTasks.values()) {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
    }
    this.scheduledTasks.clear();
  }
}

// Factory functions with different configurations
export const createMockScheduler = (): MockScheduler => {
  return new MockScheduler();
};

export const createReliableScheduler = (): MockScheduler => {
  return new MockScheduler({
    maxConcurrentJobs: 10,
    processingDelay: 50,
    errorRate: 0,
  });
};

export const createUnreliableScheduler = (): MockScheduler => {
  return new MockScheduler({
    maxConcurrentJobs: 3,
    processingDelay: 200,
    errorRate: 0.1, // 10% error rate
  });
};

export const createSlowScheduler = (): MockScheduler => {
  return new MockScheduler({
    maxConcurrentJobs: 2,
    processingDelay: 1000,
    errorRate: 0,
  });
};

// Test scenario helpers
export const TEST_SCENARIOS = {
  // Schedule a single project
  singleSchedule: async (scheduler: MockScheduler, project: Project) => {
    await scheduler.start();
    return await scheduler.schedule(project);
  },

  // Schedule multiple projects
  multipleSchedules: async (scheduler: MockScheduler, projects: Project[]) => {
    await scheduler.start();
    const results = [];
    for (const project of projects) {
      results.push(await scheduler.schedule(project));
    }
    return results;
  },

  // Schedule project then cancel
  scheduleAndCancel: async (scheduler: MockScheduler, project: Project, cancelDelay = 500) => {
    await scheduler.start();
    await scheduler.schedule(project);
    
    setTimeout(async () => {
      await scheduler.cancel(project.id);
    }, cancelDelay);
  },

  // Schedule project then reschedule
  scheduleAndReschedule: async (scheduler: MockScheduler, project: Project, newDate: Date) => {
    await scheduler.start();
    await scheduler.schedule(project);
    
    setTimeout(async () => {
      await scheduler.reschedule(project.id, newDate);
    }, 100);
  },

  // Scheduler failure scenario
  schedulerFailure: async (scheduler: MockScheduler, projects: Project[]) => {
    await scheduler.start();
    
    for (const project of projects) {
      await scheduler.schedule(project);
    }

    // Simulate failure after 500ms
    setTimeout(() => {
      scheduler.simulateFailure();
    }, 500);
  },

  // Max capacity scenario
  maxCapacityTest: async (scheduler: MockScheduler, projects: Project[]) => {
    const limitedScheduler = new MockScheduler({ maxConcurrentJobs: 2 });
    await limitedScheduler.start();
    
    const results = [];
    for (const project of projects) {
      results.push(await limitedScheduler.schedule(project));
    }
    
    return results;
  },
};