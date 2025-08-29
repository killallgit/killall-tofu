/**
 * ExecutorService - Executes Terraform destruction commands
 * 
 * Follows functional programming principles with:
 * - Result<T, E> pattern for error handling
 * - Pure functions where possible
 * - Event-driven architecture
 * - No global state
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

import { 
  ExecutorService as IExecutorService, 
  Project, 
  Execution,
  ExecutionRepository,
  ExecutionStatus,
  ExecutorConfig,
  Result
} from '../../shared/types';
import { Ok, Err } from '../../shared/utils/result';
import { 
  parseCommandString, 
  getDefaultCommand,
  validateCommandArgs 
} from '../utils/commandParser';
import { 
  buildExecutionEnvironment,
  filterSensitiveEnvVars,
  validateEnvironment 
} from '../utils/environmentBuilder';
import {
  generateExecutionId,
  createExecutionResult,
  isExecutionSuccessful,
  createExecutionError,
  validateExecutionOptions,
  ExecutionResult,
  ExecutionOptions
} from '../utils/processExecution';

interface RunningExecution {
  execution: Execution;
  process: ChildProcess;
  startTime: number;
  stdout: string;
  stderr: string;
}

interface ExecutorStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
  activeExecutions: number;
}

/**
 * Executor service that manages command execution for infrastructure destruction
 * Uses pure functional patterns with explicit dependency injection
 */
export class ExecutorService extends EventEmitter implements IExecutorService {
  private runningExecutions = new Map<string, RunningExecution>();
  private executionCounter = 0;
  private stats: ExecutorStats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    cancelledExecutions: 0,
    activeExecutions: 0
  };

  constructor(
    private readonly executionRepository: ExecutionRepository,
    private readonly config: ExecutorConfig = {
      maxConcurrentExecutions: 3,
      defaultShell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      environment: {
        PATH: process.env.PATH || '',
        HOME: process.env.HOME || '',
        USER: process.env.USER || ''
      }
    }
  ) {
    super();
  }

  /**
   * Execute a project's destruction command
   */
  async execute(project: Project): Promise<Result<Execution>> {
    try {
      // Check concurrent execution limit
      if (this.runningExecutions.size >= (this.config.maxConcurrentExecutions || 3)) {
        return Err(new Error('Maximum concurrent executions reached'));
      }

      // Determine command to execute
      const command = this.getExecutionCommand(project);
      const workingDir = project.path;
      const environment = buildExecutionEnvironment(this.config, project);

      // Create execution record
      const execution: Omit<Execution, 'id'> = {
        projectId: project.id,
        startedAt: new Date(),
        status: 'running' as ExecutionStatus,
        stdout: '',
        stderr: ''
      };

      const createResult = await this.executionRepository.create(execution as Execution);
      if (!createResult.ok) {
        return Err(new Error(`Failed to create execution record: ${createResult.error.message}`));
      }

      const executionRecord = createResult.value;

      // Start the execution
      const executeResult = await this.executeCommand(
        executionRecord,
        command,
        workingDir,
        environment
      );

      if (!executeResult.ok) {
        // Update execution record with failure
        await this.executionRepository.update(executionRecord.id, {
          status: 'failed' as ExecutionStatus,
          completedAt: new Date(),
          stderr: executeResult.error.message
        });
        return executeResult;
      }

      this.stats.totalExecutions++;
      this.stats.activeExecutions++;

      return Ok(executionRecord);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Cancel a running execution
   */
  async cancel(executionId: string): Promise<Result<void>> {
    const runningExecution = this.runningExecutions.get(executionId);
    if (!runningExecution) {
      return Err(new Error(`Execution ${executionId} is not running`));
    }

    try {
      // Kill the process
      const killed = runningExecution.process.kill('SIGTERM');
      if (!killed) {
        // Try SIGKILL if SIGTERM failed
        runningExecution.process.kill('SIGKILL');
      }

      // Update execution record
      const duration = Date.now() - runningExecution.startTime;
      const updateResult = await this.executionRepository.update(executionId, {
        status: 'cancelled' as ExecutionStatus,
        completedAt: new Date(),
        duration,
        stdout: runningExecution.stdout,
        stderr: runningExecution.stderr
      });

      if (!updateResult.ok) {
        return Err(new Error(`Failed to update execution record: ${updateResult.error.message}`));
      }

      // Clean up
      this.runningExecutions.delete(executionId);
      this.stats.activeExecutions--;
      this.stats.cancelledExecutions++;

      this.emit('cancelled', {
        executionId,
        projectId: runningExecution.execution.projectId,
        duration
      });

      return Ok(undefined);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Get all currently running executions
   */
  async getRunning(): Promise<Result<Execution[]>> {
    const runningIds = Array.from(this.runningExecutions.keys());
    const executions: Execution[] = [];

    for (const executionId of runningIds) {
      const findResult = await this.executionRepository.findById(executionId);
      if (findResult.ok && findResult.value) {
        executions.push(findResult.value);
      }
    }

    return Ok(executions);
  }

  /**
   * Execute a command with proper process management
   */
  private async executeCommand(
    execution: Execution,
    command: string,
    workingDir: string,
    environment: Record<string, string>
  ): Promise<Result<void>> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      const startTime = Date.now();

      // Parse command and arguments
      const [cmd, ...args] = parseCommandString(command);

      // Spawn the process
      const childProcess = spawn(cmd, args, {
        cwd: workingDir,
        env: { ...process.env, ...environment },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: this.config.defaultShell !== cmd
      });

      // Store running execution
      const runningExecution: RunningExecution = {
        execution,
        process: childProcess,
        startTime,
        stdout: '',
        stderr: ''
      };
      this.runningExecutions.set(execution.id, runningExecution);

      // Handle stdout
      childProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        stdout += output;
        runningExecution.stdout += output;
        
        this.emit('stdout', {
          executionId: execution.id,
          projectId: execution.projectId,
          output
        });
      });

      // Handle stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        stderr += output;
        runningExecution.stderr += output;
        
        this.emit('stderr', {
          executionId: execution.id,
          projectId: execution.projectId,
          output
        });
      });

      // Handle process completion
      childProcess.on('close', async (code: number | null, signal: string | null) => {
        const duration = Date.now() - startTime;
        const exitCode = code ?? -1;
        
        // Determine status based on exit code and signal
        let status: ExecutionStatus;
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          status = 'cancelled';
        } else if (exitCode === 0) {
          status = 'completed';
          this.stats.successfulExecutions++;
        } else {
          status = 'failed';
          this.stats.failedExecutions++;
        }

        // Update execution record
        const updateResult = await this.executionRepository.update(execution.id, {
          status,
          completedAt: new Date(),
          exitCode,
          duration,
          stdout,
          stderr
        });

        // Clean up
        this.runningExecutions.delete(execution.id);
        this.stats.activeExecutions--;

        if (!updateResult.ok) {
          this.emit('error', {
            executionId: execution.id,
            projectId: execution.projectId,
            error: new Error(`Failed to update execution record: ${updateResult.error.message}`)
          });
          resolve(Err(updateResult.error));
          return;
        }

        // Emit completion event
        this.emit('completed', {
          executionId: execution.id,
          projectId: execution.projectId,
          status,
          exitCode,
          duration,
          stdout,
          stderr
        });

        if (status === 'completed') {
          resolve(Ok(undefined));
        } else {
          resolve(Err(new Error(`Command failed with exit code ${exitCode}: ${stderr}`)));
        }
      });

      // Handle process errors
      childProcess.on('error', async (error: Error) => {
        const duration = Date.now() - startTime;
        
        // Update execution record
        await this.executionRepository.update(execution.id, {
          status: 'failed' as ExecutionStatus,
          completedAt: new Date(),
          duration,
          stderr: error.message
        });

        // Clean up
        this.runningExecutions.delete(execution.id);
        this.stats.activeExecutions--;
        this.stats.failedExecutions++;

        this.emit('error', {
          executionId: execution.id,
          projectId: execution.projectId,
          error
        });

        resolve(Err(error));
      });

      // Emit started event
      this.emit('started', {
        executionId: execution.id,
        projectId: execution.projectId,
        command,
        workingDir
      });
    });
  }

  /**
   * Get the command to execute for a project
   */
  private getExecutionCommand(project: Project): string {
    const projectConfig = typeof project.config === 'string' 
      ? JSON.parse(project.config) 
      : project.config;
    return projectConfig?.command || 'terraform destroy -auto-approve';
  }

  /**
   * Build execution environment variables
   */


  /**
   * Get executor statistics
   */
  getStats(): ExecutorStats {
    return { ...this.stats };
  }

  /**
   * Get executor configuration
   */
  getConfig(): ExecutorConfig {
    return { ...this.config };
  }

  /**
   * Check if execution is running
   */
  isExecutionRunning(executionId: string): boolean {
    return this.runningExecutions.has(executionId);
  }
}