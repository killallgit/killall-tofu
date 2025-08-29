import { Result } from './result';
import { parseTimeoutDuration } from './durationParser';
import { validatePath, validateFileExists } from './fileValidation';

export interface ProjectConfig {
  version: number;
  timeout: string;
  name?: string;
  command?: string;
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

/**
 * Validate that config is an object
 */
export const validateConfigObject = (config: unknown): Result<Record<string, unknown>> => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {
      ok: false,
      error: new Error('Configuration must be an object')
    };
  }
  return { ok: true, value: config as Record<string, unknown> };
};

/**
 * Validate version field
 */
export const validateVersion = (version: unknown): Result<number> => {
  if (typeof version !== 'number' || version !== 1) {
    return {
      ok: false,
      error: new Error('Version must be 1 (only supported version)')
    };
  }
  return { ok: true, value: version };
};

/**
 * Validate timeout field
 */
export const validateTimeout = (timeout: unknown): Result<string> => {
  if (typeof timeout !== 'string') {
    return {
      ok: false,
      error: new Error('Timeout must be a string')
    };
  }

  const timeoutResult = parseTimeoutDuration(timeout);
  if (!timeoutResult.ok) {
    return timeoutResult;
  }

  return { ok: true, value: timeout };
};

/**
 * Validate optional name field
 */
export const validateName = (name: unknown): Result<string | undefined> => {
  if (name !== undefined && typeof name !== 'string') {
    return {
      ok: false,
      error: new Error('Name must be a string')
    };
  }
  return { ok: true, value: name as string | undefined };
};

/**
 * Validate optional command field
 */
export const validateCommand = (command: unknown): Result<string | undefined> => {
  if (command !== undefined && typeof command !== 'string') {
    return {
      ok: false,
      error: new Error('Command must be a string')
    };
  }
  return { ok: true, value: command as string | undefined };
};

/**
 * Validate optional tags field
 */
export const validateTags = (tags: unknown): Result<string[] | undefined> => {
  if (tags !== undefined) {
    if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string')) {
      return {
        ok: false,
        error: new Error('Tags must be an array of strings')
      };
    }
  }
  return { ok: true, value: tags as string[] | undefined };
};

/**
 * Validate optional execution configuration
 */
export const validateExecution = async (
  execution: unknown,
  projectPath: string
): Promise<Result<ProjectConfig['execution']>> => {
  if (execution === undefined) {
    return { ok: true, value: undefined };
  }

  if (!execution || typeof execution !== 'object' || Array.isArray(execution)) {
    return {
      ok: false,
      error: new Error('Execution must be an object')
    };
  }

  const exec = execution as Record<string, unknown>;

  // Validate working_directory
  if (exec.working_directory !== undefined) {
    if (typeof exec.working_directory !== 'string') {
      return {
        ok: false,
        error: new Error('Working directory must be a string')
      };
    }

    const pathResult = validatePath(exec.working_directory, projectPath);
    if (!pathResult.ok) {
      return pathResult;
    }

    // Check if directory exists
    const existsResult = await validateFileExists(exec.working_directory);
    if (!existsResult.ok) {
      return existsResult;
    }
  }

  // Validate environment_variables
  if (exec.environment_variables !== undefined) {
    if (!exec.environment_variables || typeof exec.environment_variables !== 'object' || Array.isArray(exec.environment_variables)) {
      return {
        ok: false,
        error: new Error('Environment variables must be an object')
      };
    }

    const envVars = exec.environment_variables as Record<string, unknown>;
    for (const [key, value] of Object.entries(envVars)) {
      if (typeof value !== 'string') {
        return {
          ok: false,
          error: new Error(`Environment variable ${key} must be a string`)
        };
      }
    }
  }

  return {
    ok: true,
    value: {
      timeout: exec.timeout as number | undefined,
      workingDir: exec.working_directory as string | undefined,
      environment: exec.environment_variables as Record<string, string> | undefined,
    }
  };
};

/**
 * Validate optional hooks configuration
 */
export const validateHooks = (hooks: unknown): Result<ProjectConfig['hooks']> => {
  if (hooks === undefined) {
    return { ok: true, value: undefined };
  }

  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) {
    return {
      ok: false,
      error: new Error('Hooks must be an object')
    };
  }

  const hooksObj = hooks as Record<string, unknown>;

  // Validate hook arrays
  for (const [hookName, hookCommands] of Object.entries(hooksObj)) {
    if (!['before_destroy', 'after_destroy'].includes(hookName)) {
      return {
        ok: false,
        error: new Error(`Unknown hook: ${hookName}. Supported hooks: before_destroy, after_destroy`)
      };
    }

    if (hookCommands !== undefined) {
      if (!Array.isArray(hookCommands) || !hookCommands.every(cmd => typeof cmd === 'string')) {
        return {
          ok: false,
          error: new Error(`Hook ${hookName} must be an array of strings`)
        };
      }
    }
  }

  return {
    ok: true,
    value: {
      preDestroy: (hooksObj as any).before_destroy,
      postDestroy: (hooksObj as any).after_destroy,
    }
  };
};

/**
 * Validate complete configuration object
 */
export const validateProjectConfig = async (
  config: unknown,
  projectPath: string
): Promise<Result<ProjectConfig>> => {
  // Check if config is an object
  const configResult = validateConfigObject(config);
  if (!configResult.ok) {
    return configResult;
  }

  const cfg = configResult.value;

  // Validate required fields
  const versionResult = validateVersion(cfg.version);
  if (!versionResult.ok) {
    return versionResult;
  }

  const timeoutResult = validateTimeout(cfg.timeout);
  if (!timeoutResult.ok) {
    return timeoutResult;
  }

  // Validate optional fields
  const nameResult = validateName(cfg.name);
  if (!nameResult.ok) {
    return nameResult;
  }

  const commandResult = validateCommand(cfg.command);
  if (!commandResult.ok) {
    return commandResult;
  }

  const tagsResult = validateTags(cfg.tags);
  if (!tagsResult.ok) {
    return tagsResult;
  }

  const executionResult = await validateExecution(cfg.execution, projectPath);
  if (!executionResult.ok) {
    return executionResult;
  }

  const hooksResult = validateHooks(cfg.hooks);
  if (!hooksResult.ok) {
    return hooksResult;
  }

  // Build validated config object
  const validatedConfig: ProjectConfig = {
    version: versionResult.value,
    timeout: timeoutResult.value,
    name: nameResult.value,
    command: commandResult.value,
    tags: tagsResult.value,
    execution: executionResult.value,
    hooks: hooksResult.value,
  };

  return { ok: true, value: validatedConfig };
};