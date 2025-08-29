import { Result } from '../../shared/utils/result';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  command: string[];
  workingDir: string;
}

export interface ExecutionOptions {
  workingDir: string;
  environment: Record<string, string>;
  timeout?: number;
}

/**
 * Generate unique execution ID
 */
export const generateExecutionId = (): string => {
  return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create execution result object
 */
export const createExecutionResult = (
  command: string[],
  workingDir: string,
  stdout: string = '',
  stderr: string = '',
  exitCode: number = 0,
  duration: number = 0
): ExecutionResult => {
  return {
    stdout,
    stderr,
    exitCode,
    duration,
    command,
    workingDir
  };
};

/**
 * Check if execution was successful
 */
export const isExecutionSuccessful = (result: ExecutionResult): boolean => {
  return result.exitCode === 0;
};

/**
 * Create execution error message
 */
export const createExecutionError = (
  command: string[],
  exitCode: number,
  stderr: string
): Error => {
  return new Error(
    `Command failed with exit code ${exitCode}: ${command.join(' ')}\n${stderr}`
  );
};

/**
 * Validate execution options
 */
export const validateExecutionOptions = (options: ExecutionOptions): Result<void> => {
  if (!options.workingDir || typeof options.workingDir !== 'string') {
    return {
      ok: false,
      error: new Error('Working directory must be a valid string')
    };
  }
  
  if (!options.environment || typeof options.environment !== 'object') {
    return {
      ok: false,
      error: new Error('Environment must be an object')
    };
  }
  
  if (options.timeout !== undefined && (typeof options.timeout !== 'number' || options.timeout <= 0)) {
    return {
      ok: false,
      error: new Error('Timeout must be a positive number')
    };
  }
  
  return { ok: true, value: undefined };
};