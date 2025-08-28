/**
 * Mock executor service implementation for testing and parallel development.
 */

import { ExecutorService, Project, Execution, ExecutionStatus, Result } from '../types';
import { Ok, Err } from '../utils/result';
import { EventEmitter } from 'events';

interface RunningExecution {
  execution: Execution;
  timeoutId?: NodeJS.Timeout;
  startTime: number;
}

export class MockExecutor extends EventEmitter implements ExecutorService {
  private runningExecutions = new Map<string, RunningExecution>();
  private config: {
    maxConcurrentExecutions: number;
    baseExecutionTime: number;
    executionTimeVariance: number;
    successRate: number;
    timeoutRate: number;
  };

  constructor(config: Partial<MockExecutor['config']> = {}) {
    super();
    this.config = {
      maxConcurrentExecutions: 3,
      baseExecutionTime: 1000, // ms
      executionTimeVariance: 500, // ms
      successRate: 0.8, // 80% success rate
      timeoutRate: 0.05, // 5% timeout rate
      ...config,
    };
  }

  async execute(project: Project): Promise<Result<Execution>> {
    // Check concurrent execution limit
    if (this.runningExecutions.size >= this.config.maxConcurrentExecutions) {
      return Err(new Error('Maximum concurrent executions reached'));
    }

    // Create execution record
    const execution: Execution = {
      id: this.generateExecutionId(),
      projectId: project.id,
      startedAt: new Date(),
      status: 'running',
    };

    const runningExecution: RunningExecution = {
      execution,
      startTime: Date.now(),
    };

    this.runningExecutions.set(execution.id, runningExecution);

    // Start execution simulation
    this.simulateExecution(execution.id, project);

    this.emit('started', { execution, project });
    return Ok(execution);
  }

  async cancel(executionId: string): Promise<Result<void>> {
    const running = this.runningExecutions.get(executionId);
    if (!running) {
      return Err(new Error(`No running execution found with id ${executionId}`));
    }

    // Cancel the timeout
    if (running.timeoutId) {
      clearTimeout(running.timeoutId);
    }

    // Update execution status
    const cancelledExecution: Execution = {
      ...running.execution,
      status: 'cancelled',
      completedAt: new Date(),
      duration: Date.now() - running.startTime,
      exitCode: 130, // SIGINT exit code
    };

    this.runningExecutions.delete(executionId);
    this.emit('cancelled', { execution: cancelledExecution });
    
    return Ok(void 0);
  }

  async getRunning(): Promise<Result<Execution[]>> {
    const executions = Array.from(this.runningExecutions.values()).map(r => r.execution);
    return Ok(executions);
  }

  // Private methods
  private generateExecutionId(): string {
    return 'exec_' + Math.random().toString(36).substring(2, 15);
  }

  private simulateExecution(executionId: string, project: Project): void {
    const running = this.runningExecutions.get(executionId);
    if (!running) return;

    // Calculate execution time with variance
    const executionTime = this.config.baseExecutionTime + 
      (Math.random() - 0.5) * this.config.executionTimeVariance;

    // Determine outcome
    const willTimeout = Math.random() < this.config.timeoutRate;
    const willSucceed = !willTimeout && Math.random() < this.config.successRate;

    if (willTimeout) {
      // Simulate timeout
      const timeoutDuration = Math.random() * 5000 + 5000; // 5-10 seconds
      running.timeoutId = setTimeout(() => {
        this.completeExecution(executionId, 'timeout', 124, 'Execution timed out');
      }, timeoutDuration);
    } else {
      // Normal execution
      running.timeoutId = setTimeout(() => {
        if (willSucceed) {
          this.completeExecution(executionId, 'completed', 0, 'Execution completed successfully');
        } else {
          this.completeExecution(executionId, 'failed', 1, 'Execution failed');
        }
      }, executionTime);
    }

    // Emit progress events
    this.emitProgressEvents(executionId, executionTime);
  }

  private completeExecution(
    executionId: string, 
    status: ExecutionStatus, 
    exitCode: number,
    message: string
  ): void {
    const running = this.runningExecutions.get(executionId);
    if (!running) return;

    const duration = Date.now() - running.startTime;
    const completedExecution: Execution = {
      ...running.execution,
      status,
      completedAt: new Date(),
      exitCode,
      duration,
      stdout: status === 'completed' ? this.generateSuccessOutput() : undefined,
      stderr: status === 'failed' ? this.generateErrorOutput() : undefined,
    };

    this.runningExecutions.delete(executionId);
    this.emit('completed', { execution: completedExecution, message });
  }

  private emitProgressEvents(executionId: string, totalTime: number): void {
    const progressSteps = [0.25, 0.5, 0.75];
    
    progressSteps.forEach(progress => {
      setTimeout(() => {
        if (this.runningExecutions.has(executionId)) {
          this.emit('progress', { executionId, progress, message: `${Math.round(progress * 100)}% complete` });
        }
      }, totalTime * progress);
    });
  }

  private generateSuccessOutput(): string {
    const outputs = [
      'Project destroyed successfully\nCleanup completed\nAll resources freed',
      'Terraform destroy completed\nInfrastructure removed\nState file updated',
      'Docker containers stopped\nImages removed\nVolumes cleaned up',
      'Build artifacts deleted\nCache cleared\nDirectories removed',
    ];
    return outputs[Math.floor(Math.random() * outputs.length)];
  }

  private generateErrorOutput(): string {
    const errors = [
      'Error: Permission denied accessing resource\nFailed to destroy infrastructure',
      'Error: Resource still in use\nCannot delete active database',
      'Error: Network timeout\nFailed to connect to service',
      'Error: Invalid configuration\nMissing required parameters',
    ];
    return errors[Math.floor(Math.random() * errors.length)];
  }

  // Testing utilities
  getRunningCount(): number {
    return this.runningExecutions.size;
  }

  getRunningExecutions(): Execution[] {
    return Array.from(this.runningExecutions.values()).map(r => r.execution);
  }

  isRunning(executionId: string): boolean {
    return this.runningExecutions.has(executionId);
  }

  // Force completion (for testing)
  async forceComplete(executionId: string, status: ExecutionStatus, exitCode: number): Promise<Result<void>> {
    if (!this.runningExecutions.has(executionId)) {
      return Err(new Error(`No running execution found with id ${executionId}`));
    }

    this.completeExecution(executionId, status, exitCode, `Forced completion: ${status}`);
    return Ok(void 0);
  }

  // Force all executions to complete (for testing)
  forceCompleteAll(status: ExecutionStatus = 'completed', exitCode: number = 0): void {
    const executionIds = Array.from(this.runningExecutions.keys());
    executionIds.forEach(id => {
      this.forceComplete(id, status, exitCode).catch(console.error);
    });
  }

  // Simulate executor failure
  simulateFailure(error?: Error): void {
    // Cancel all running executions
    for (const [id, running] of this.runningExecutions) {
      if (running.timeoutId) {
        clearTimeout(running.timeoutId);
      }
      this.completeExecution(id, 'failed', 1, 'Executor failure');
    }

    this.emit('error', error || new Error('Simulated executor failure'));
  }

  // Clear all executions (for testing)
  clearAll(): void {
    for (const running of this.runningExecutions.values()) {
      if (running.timeoutId) {
        clearTimeout(running.timeoutId);
      }
    }
    this.runningExecutions.clear();
  }
}

// Factory functions with different configurations
export const createMockExecutor = (): MockExecutor => {
  return new MockExecutor();
};

export const createReliableExecutor = (): MockExecutor => {
  return new MockExecutor({
    maxConcurrentExecutions: 5,
    baseExecutionTime: 500,
    executionTimeVariance: 100,
    successRate: 0.95,
    timeoutRate: 0.01,
  });
};

export const createUnreliableExecutor = (): MockExecutor => {
  return new MockExecutor({
    maxConcurrentExecutions: 2,
    baseExecutionTime: 2000,
    executionTimeVariance: 1000,
    successRate: 0.6, // 60% success rate
    timeoutRate: 0.15, // 15% timeout rate
  });
};

export const createSlowExecutor = (): MockExecutor => {
  return new MockExecutor({
    maxConcurrentExecutions: 1,
    baseExecutionTime: 5000,
    executionTimeVariance: 2000,
    successRate: 0.8,
    timeoutRate: 0.1,
  });
};

// Test scenario helpers
export const TEST_SCENARIOS = {
  // Single successful execution
  singleSuccess: async (executor: MockExecutor, project: Project) => {
    const reliableExecutor = createReliableExecutor();
    return await reliableExecutor.execute(project);
  },

  // Single failed execution
  singleFailure: async (executor: MockExecutor, project: Project) => {
    const unreliableExecutor = new MockExecutor({ successRate: 0 });
    return await unreliableExecutor.execute(project);
  },

  // Multiple concurrent executions
  concurrentExecutions: async (executor: MockExecutor, projects: Project[]) => {
    const results = [];
    for (const project of projects) {
      results.push(await executor.execute(project));
    }
    return results;
  },

  // Execution then cancellation
  executionAndCancel: async (executor: MockExecutor, project: Project, cancelDelay = 500) => {
    const result = await executor.execute(project);
    if (result.ok) {
      setTimeout(async () => {
        await executor.cancel(result.value.id);
      }, cancelDelay);
    }
    return result;
  },

  // Max capacity test
  maxCapacityTest: async (executor: MockExecutor, projects: Project[]) => {
    const limitedExecutor = new MockExecutor({ maxConcurrentExecutions: 2 });
    const results = [];
    
    for (const project of projects) {
      results.push(await limitedExecutor.execute(project));
    }
    
    return results;
  },

  // Timeout scenario
  timeoutScenario: async (project: Project) => {
    const timeoutExecutor = new MockExecutor({ 
      timeoutRate: 1.0, // 100% timeout rate
      baseExecutionTime: 1000 
    });
    return await timeoutExecutor.execute(project);
  },

  // Executor failure scenario
  executorFailure: async (executor: MockExecutor, projects: Project[]) => {
    // Start multiple executions
    for (const project of projects) {
      await executor.execute(project);
    }

    // Simulate failure after 1 second
    setTimeout(() => {
      executor.simulateFailure();
    }, 1000);
  },
};