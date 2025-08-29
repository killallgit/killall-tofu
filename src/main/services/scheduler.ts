/**
 * SchedulerService - Manages timed destruction of Terraform infrastructure
 * 
 * Follows functional programming principles with:
 * - Result<T, E> pattern for error handling
 * - Pure functions where possible
 * - Event-driven architecture
 * - No global state
 */

import { EventEmitter } from 'events';

import { 
  SchedulerService as ISchedulerService, 
  Project, 
  ProjectRepository, 
  ExecutorService,
  Result,
  ProjectStatus
} from '../../shared/types';
import { Ok, Err } from '../../shared/utils/result';

interface ScheduledJob {
  projectId: string;
  destroyAt: Date;
  timeoutHandle: ReturnType<typeof setTimeout>;
  retryCount: number;
}

interface SchedulerStats {
  scheduledJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
}

interface SchedulerConfig {
  maxConcurrentJobs: number;
  defaultTimeout: string;
  retryAttempts: number;
  warningTimes: number[]; // Minutes before destruction to send warnings
}

/**
 * Scheduler service that manages timed destruction of infrastructure
 * Uses pure functional patterns with explicit dependency injection
 */
export class SchedulerService extends EventEmitter implements ISchedulerService {
  private scheduledJobs = new Map<string, ScheduledJob>();
  private isRunning = false;
  private stats: SchedulerStats = {
    scheduledJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    activeJobs: 0
  };

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly executorService: ExecutorService,
    private readonly config: SchedulerConfig = {
      maxConcurrentJobs: 5,
      defaultTimeout: '2 hours',
      retryAttempts: 3,
      warningTimes: [60, 15, 5, 1] // minutes before destruction
    }
  ) {
    super();
  }

  /**
   * Start the scheduler service
   */
  async start(): Promise<Result<void>> {
    if (this.isRunning) {
      return Ok(undefined);
    }

    try {
      // Load any existing scheduled projects from database
      const activeProjectsResult = await this.projectRepository.findByStatus('scheduled' as ProjectStatus);
      if (!activeProjectsResult.ok) {
        return Err(new Error(`Failed to load scheduled projects: ${activeProjectsResult.error.message}`));
      }

      // Reschedule any projects that were scheduled before restart
      for (const project of activeProjectsResult.value) {
        const scheduleResult = await this.scheduleInternal(project);
        if (!scheduleResult.ok) {
          // Log error but continue with other projects
          this.emit('error', {
            type: 'scheduler.reschedule_failed',
            projectId: project.id,
            error: scheduleResult.error
          });
        }
      }

      this.isRunning = true;
      this.emit('started', { scheduledCount: activeProjectsResult.value.length });
      return Ok(undefined);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Stop the scheduler service and cancel all scheduled jobs
   */
  async stop(): Promise<Result<void>> {
    if (!this.isRunning) {
      return Ok(undefined);
    }

    try {
      // Cancel all scheduled jobs
      for (const [projectId, job] of this.scheduledJobs.entries()) {
        clearTimeout(job.timeoutHandle);
        this.scheduledJobs.delete(projectId);
      }

      this.isRunning = false;
      this.stats.activeJobs = 0;
      this.emit('stopped', { cancelledJobs: this.scheduledJobs.size });
      return Ok(undefined);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Schedule a project for destruction
   */
  async schedule(project: Project): Promise<Result<void>> {
    if (!this.isRunning) {
      return Err(new Error('Scheduler is not running'));
    }

    // Update project status to scheduled
    const updateResult = await this.projectRepository.update(project.id, { 
      status: 'scheduled' as ProjectStatus 
    });
    if (!updateResult.ok) {
      return Err(new Error(`Failed to update project status: ${updateResult.error.message}`));
    }

    return this.scheduleInternal(updateResult.value);
  }

  /**
   * Cancel a scheduled project destruction
   */
  async cancel(projectId: string): Promise<Result<void>> {
    const scheduledJob = this.scheduledJobs.get(projectId);
    if (!scheduledJob) {
      return Err(new Error(`Project ${projectId} is not scheduled`));
    }

    // Cancel the timeout
    clearTimeout(scheduledJob.timeoutHandle);
    this.scheduledJobs.delete(projectId);
    this.stats.activeJobs--;

    // Update project status to active
    const updateResult = await this.projectRepository.update(projectId, { 
      status: 'active' as ProjectStatus 
    });
    if (!updateResult.ok) {
      return Err(new Error(`Failed to update project status: ${updateResult.error.message}`));
    }

    this.emit('cancelled', { projectId });
    return Ok(undefined);
  }

  /**
   * Reschedule a project with a new destruction time
   */
  async reschedule(projectId: string, newDate: Date): Promise<Result<void>> {
    // Cancel existing schedule
    const cancelResult = await this.cancel(projectId);
    if (!cancelResult.ok && !cancelResult.error.message.includes('is not scheduled')) {
      return cancelResult;
    }

    // Get project and update destroy time
    const projectResult = await this.projectRepository.findById(projectId);
    if (!projectResult.ok || !projectResult.value) {
      return Err(new Error(`Project ${projectId} not found`));
    }

    const updateResult = await this.projectRepository.update(projectId, { 
      destroyAt: newDate 
    });
    if (!updateResult.ok) {
      return updateResult;
    }

    // Reschedule with new time
    return this.schedule(updateResult.value);
  }

  /**
   * Get all scheduled projects
   */
  async getScheduled(): Promise<Result<Project[]>> {
    return this.projectRepository.findByStatus('scheduled' as ProjectStatus);
  }

  /**
   * Internal scheduling logic
   */
  private async scheduleInternal(project: Project): Promise<Result<void>> {
    const now = new Date();
    const destroyAt = new Date(project.destroyAt);
    const msUntilDestroy = destroyAt.getTime() - now.getTime();

    if (msUntilDestroy <= 0) {
      // Should be destroyed immediately
      return this.executeDestruction(project);
    }

    // Check if we're at max concurrent jobs
    if (this.scheduledJobs.size >= this.config.maxConcurrentJobs) {
      return Err(new Error('Maximum concurrent scheduled jobs reached'));
    }

    // Schedule warning notifications
    this.scheduleWarnings(project, destroyAt);

    // Schedule the actual destruction
    const timeoutHandle = setTimeout(async () => {
      await this.executeDestruction(project);
    }, msUntilDestroy);

    const job: ScheduledJob = {
      projectId: project.id,
      destroyAt,
      timeoutHandle,
      retryCount: 0
    };

    this.scheduledJobs.set(project.id, job);
    this.stats.activeJobs++;
    this.stats.scheduledJobs++;

    this.emit('scheduled', {
      projectId: project.id,
      destroyAt,
      msUntilDestroy
    });

    return Ok(undefined);
  }

  /**
   * Schedule warning notifications before destruction
   */
  private scheduleWarnings(project: Project, destroyAt: Date): void {
    const now = new Date();
    
    for (const warningMinutes of this.config.warningTimes) {
      const warningTime = new Date(destroyAt.getTime() - (warningMinutes * 60 * 1000));
      const msUntilWarning = warningTime.getTime() - now.getTime();
      
      if (msUntilWarning > 0) {
        setTimeout(() => {
          this.emit('warning', {
            projectId: project.id,
            minutesRemaining: warningMinutes,
            destroyAt
          });
        }, msUntilWarning);
      }
    }
  }

  /**
   * Execute the destruction of a project
   */
  private async executeDestruction(project: Project): Promise<Result<void>> {
    const job = this.scheduledJobs.get(project.id);
    
    try {
      // Update project status to destroying
      const updateResult = await this.projectRepository.update(project.id, { 
        status: 'destroying' as ProjectStatus 
      });
      if (!updateResult.ok) {
        throw new Error(`Failed to update project status: ${updateResult.error.message}`);
      }

      // Execute the destruction
      const executionResult = await this.executorService.execute(updateResult.value);
      
      if (executionResult.ok) {
        // Success - remove from scheduled jobs
        if (job) {
          this.scheduledJobs.delete(project.id);
          this.stats.activeJobs--;
          this.stats.completedJobs++;
        }

        this.emit('completed', {
          projectId: project.id,
          executionId: executionResult.value.id
        });

        return Ok(undefined);
      } else {
        // Execution failed - handle retry
        return this.handleExecutionFailure(project, executionResult.error, job);
      }
    } catch (error) {
      return this.handleExecutionFailure(project, error as Error, job);
    }
  }

  /**
   * Handle execution failure with retry logic
   */
  private async handleExecutionFailure(
    project: Project, 
    error: Error, 
    job?: ScheduledJob
  ): Promise<Result<void>> {
    const retryCount = job?.retryCount || 0;
    
    if (retryCount < this.config.retryAttempts) {
      // Schedule retry in 5 minutes
      const retryDelay = 5 * 60 * 1000; // 5 minutes
      const retryHandle = setTimeout(async () => {
        await this.executeDestruction(project);
      }, retryDelay);

      if (job) {
        job.retryCount++;
        job.timeoutHandle = retryHandle;
      }

      this.emit('retry_scheduled', {
        projectId: project.id,
        attempt: retryCount + 1,
        maxAttempts: this.config.retryAttempts,
        retryInMs: retryDelay
      });

      return Ok(undefined);
    } else {
      // Max retries exceeded - mark as failed
      await this.projectRepository.update(project.id, { 
        status: 'failed' as ProjectStatus 
      });

      if (job) {
        this.scheduledJobs.delete(project.id);
        this.stats.activeJobs--;
        this.stats.failedJobs++;
      }

      this.emit('failed', {
        projectId: project.id,
        error,
        attempts: this.config.retryAttempts + 1
      });

      return Err(new Error(`Project destruction failed after ${this.config.retryAttempts} retries: ${error.message}`));
    }
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  /**
   * Get scheduler configuration
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}