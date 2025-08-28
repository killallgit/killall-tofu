/**
 * Schema validation utilities for configuration and data validation.
 */

import { Result, ValidationError, ProjectConfig, ExecutionConfig, HookConfig } from '../types';

// Re-export type and constructor for convenience
export { ValidationError } from '../types';

import { Ok, Err } from './result';
import { parseDuration } from './duration';
import { validatePath } from './paths';

// Generic validation utilities
export type ValidationRule<T> = (value: T) => Result<void, ValidationError>;

export const required = <T>(fieldName: string): ValidationRule<T | null | undefined> =>
  (value: T | null | undefined): Result<void, ValidationError> => {
    if (value == null) {
      return Err(new ValidationError(`${fieldName} is required`, fieldName));
    }
    return Ok(void 0);
  };

export const isString = (fieldName: string): ValidationRule<unknown> =>
  (value: unknown): Result<void, ValidationError> => {
    if (typeof value !== 'string') {
      return Err(new ValidationError(`${fieldName} must be a string`, fieldName));
    }
    return Ok(void 0);
  };

export const isNumber = (fieldName: string): ValidationRule<unknown> =>
  (value: unknown): Result<void, ValidationError> => {
    if (typeof value !== 'number' || isNaN(value)) {
      return Err(new ValidationError(`${fieldName} must be a number`, fieldName));
    }
    return Ok(void 0);
  };

export const isBoolean = (fieldName: string): ValidationRule<unknown> =>
  (value: unknown): Result<void, ValidationError> => {
    if (typeof value !== 'boolean') {
      return Err(new ValidationError(`${fieldName} must be a boolean`, fieldName));
    }
    return Ok(void 0);
  };

export const isArray = (fieldName: string): ValidationRule<unknown> =>
  (value: unknown): Result<void, ValidationError> => {
    if (!Array.isArray(value)) {
      return Err(new ValidationError(`${fieldName} must be an array`, fieldName));
    }
    return Ok(void 0);
  };

export const isObject = (fieldName: string): ValidationRule<unknown> =>
  (value: unknown): Result<void, ValidationError> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return Err(new ValidationError(`${fieldName} must be an object`, fieldName));
    }
    return Ok(void 0);
  };

export const minLength = (min: number, fieldName: string): ValidationRule<string> =>
  (value: string): Result<void, ValidationError> => {
    if (value.length < min) {
      return Err(new ValidationError(`${fieldName} must be at least ${min} characters`, fieldName));
    }
    return Ok(void 0);
  };

export const maxLength = (max: number, fieldName: string): ValidationRule<string> =>
  (value: string): Result<void, ValidationError> => {
    if (value.length > max) {
      return Err(new ValidationError(`${fieldName} must be at most ${max} characters`, fieldName));
    }
    return Ok(void 0);
  };

export const minValue = (min: number, fieldName: string): ValidationRule<number> =>
  (value: number): Result<void, ValidationError> => {
    if (value < min) {
      return Err(new ValidationError(`${fieldName} must be at least ${min}`, fieldName));
    }
    return Ok(void 0);
  };

export const maxValue = (max: number, fieldName: string): ValidationRule<number> =>
  (value: number): Result<void, ValidationError> => {
    if (value > max) {
      return Err(new ValidationError(`${fieldName} must be at most ${max}`, fieldName));
    }
    return Ok(void 0);
  };

export const oneOf = <T>(values: T[], fieldName: string): ValidationRule<T> =>
  (value: T): Result<void, ValidationError> => {
    if (!values.includes(value)) {
      return Err(new ValidationError(`${fieldName} must be one of: ${values.join(', ')}`, fieldName));
    }
    return Ok(void 0);
  };

export const matches = (pattern: RegExp, fieldName: string): ValidationRule<string> =>
  (value: string): Result<void, ValidationError> => {
    if (!pattern.test(value)) {
      return Err(new ValidationError(`${fieldName} has invalid format`, fieldName));
    }
    return Ok(void 0);
  };

// Validation combinators
export const combine = <T>(...rules: ValidationRule<T>[]): ValidationRule<T> =>
  (value: T): Result<void, ValidationError> => {
    for (const rule of rules) {
      const result = rule(value);
      if (!result.ok) {
        return result;
      }
    }
    return Ok(void 0);
  };

export const optional = <T>(rule: ValidationRule<T>): ValidationRule<T | null | undefined> =>
  (value: T | null | undefined): Result<void, ValidationError> => {
    if (value == null) {
      return Ok(void 0);
    }
    return rule(value);
  };

export const validateArray = <T>(
  itemRule: ValidationRule<T>,
  fieldName: string
): ValidationRule<T[]> =>
  (array: T[]): Result<void, ValidationError> => {
    for (let i = 0; i < array.length; i++) {
      const result = itemRule(array[i]);
      if (!result.ok) {
        return Err(new ValidationError(`${fieldName}[${i}]: ${result.error.message}`, fieldName));
      }
    }
    return Ok(void 0);
  };

// Domain-specific validators
export const isDuration = (fieldName: string): ValidationRule<string> =>
  (value: string): Result<void, ValidationError> => {
    const result = parseDuration(value);
    if (!result.ok) {
      return Err(new ValidationError(`${fieldName} is not a valid duration: ${result.error.message}`, fieldName));
    }
    return Ok(void 0);
  };

export const isValidPath = (fieldName: string): ValidationRule<string> =>
  (value: string): Result<void, ValidationError> => {
    const result = validatePath(value);
    if (!result.ok) {
      return Err(new ValidationError(`${fieldName} is not a valid path: ${result.error.message}`, fieldName));
    }
    return Ok(void 0);
  };

export const isValidTag = (fieldName: string): ValidationRule<string> =>
  combine(
    isString(fieldName),
    minLength(1, fieldName),
    maxLength(50, fieldName),
    matches(/^[a-zA-Z0-9_-]+$/, fieldName)
  );

export const isValidProjectName = (fieldName: string): ValidationRule<string> =>
  combine(
    isString(fieldName),
    minLength(1, fieldName),
    maxLength(100, fieldName),
    matches(/^[a-zA-Z0-9_.-]+$/, fieldName)
  );

// Configuration validators
export const validateProjectConfig = (config: unknown): Result<ProjectConfig, ValidationError> => {
  // Type check
  const objectCheck = isObject('config')(config);
  if (!objectCheck.ok) return objectCheck;

  const obj = config as Record<string, unknown>;

  // Validate version
  const versionCheck = combine(
    required('version'),
    isNumber('version'),
    oneOf([1], 'version')
  )(obj.version as any);
  if (!versionCheck.ok) return versionCheck;

  // Validate timeout
  const timeoutCheck = combine(
    required('timeout'),
    isString('timeout'),
    isDuration('timeout')
  )(obj.timeout as any);
  if (!timeoutCheck.ok) return timeoutCheck;

  // Validate optional fields
  if (obj.command != null) {
    const commandCheck = combine(
      isString('command'),
      minLength(1, 'command')
    )(obj.command as any);
    if (!commandCheck.ok) return commandCheck;
  }

  if (obj.name != null) {
    const nameCheck = isValidProjectName('name')(obj.name as any);
    if (!nameCheck.ok) return nameCheck;
  }

  if (obj.tags != null) {
    const tagsCheck = combine(
      isArray('tags'),
      validateArray(isValidTag('tag'), 'tags')
    )(obj.tags as any);
    if (!tagsCheck.ok) return tagsCheck;
  }

  if (obj.execution != null) {
    const executionResult = validateExecutionConfig(obj.execution);
    if (!executionResult.ok) return executionResult;
  }

  if (obj.hooks != null) {
    const hooksResult = validateHookConfig(obj.hooks);
    if (!hooksResult.ok) return hooksResult;
  }

  return Ok({
    version: obj.version as number,
    timeout: obj.timeout as string,
    command: obj.command as string | undefined,
    name: obj.name as string | undefined,
    tags: obj.tags as string[] | undefined,
    execution: obj.execution as ExecutionConfig | undefined,
    hooks: obj.hooks as HookConfig | undefined,
  });
};

export const validateExecutionConfig = (config: unknown): Result<ExecutionConfig, ValidationError> => {
  const objectCheck = isObject('execution')(config);
  if (!objectCheck.ok) return objectCheck;

  const obj = config as Record<string, unknown>;

  if (obj.retries != null) {
    const retriesCheck = combine(
      isNumber('retries'),
      minValue(0, 'retries'),
      maxValue(10, 'retries')
    )(obj.retries as any);
    if (!retriesCheck.ok) return retriesCheck;
  }

  if (obj.environment != null) {
    const envCheck = isObject('environment')(obj.environment);
    if (!envCheck.ok) return envCheck;

    // Validate environment variables
    const envObj = obj.environment as Record<string, unknown>;
    for (const [key, value] of Object.entries(envObj)) {
      if (typeof value !== 'string') {
        return Err(new ValidationError(`environment.${key} must be a string`, 'environment'));
      }
    }
  }

  if (obj.workingDirectory != null) {
    const workDirCheck = isValidPath('workingDirectory')(obj.workingDirectory as any);
    if (!workDirCheck.ok) return workDirCheck;
  }

  if (obj.shell != null) {
    const shellCheck = combine(
      isString('shell'),
      minLength(1, 'shell')
    )(obj.shell as any);
    if (!shellCheck.ok) return shellCheck;
  }

  return Ok({
    retries: obj.retries as number | undefined,
    environment: obj.environment as Record<string, string> | undefined,
    workingDirectory: obj.workingDirectory as string | undefined,
    shell: obj.shell as string | undefined,
  });
};

export const validateHookConfig = (config: unknown): Result<HookConfig, ValidationError> => {
  const objectCheck = isObject('hooks')(config);
  if (!objectCheck.ok) return objectCheck;

  const obj = config as Record<string, unknown>;
  const hookArrayValidator = validateArray(
    combine(isString('hook'), minLength(1, 'hook')),
    'hooks'
  );

  if (obj.beforeDestroy != null) {
    const beforeCheck = combine(isArray('beforeDestroy'), hookArrayValidator)(obj.beforeDestroy as any);
    if (!beforeCheck.ok) return beforeCheck;
  }

  if (obj.afterDestroy != null) {
    const afterCheck = combine(isArray('afterDestroy'), hookArrayValidator)(obj.afterDestroy as any);
    if (!afterCheck.ok) return afterCheck;
  }

  if (obj.onFailure != null) {
    const failureCheck = combine(isArray('onFailure'), hookArrayValidator)(obj.onFailure as any);
    if (!failureCheck.ok) return failureCheck;
  }

  return Ok({
    beforeDestroy: obj.beforeDestroy as string[] | undefined,
    afterDestroy: obj.afterDestroy as string[] | undefined,
    onFailure: obj.onFailure as string[] | undefined,
  });
};

// Generic object validation
export const validateObject = <T>(
  schema: Record<keyof T, ValidationRule<unknown>>,
  obj: unknown
): Result<T, ValidationError> => {
  const objectCheck = isObject('object')(obj);
  if (!objectCheck.ok) return objectCheck;

  const input = obj as Record<string, unknown>;
  const result: Partial<T> = {};

  for (const [key, rule] of Object.entries(schema) as Array<[keyof T, ValidationRule<unknown>]>) {
    const value = input[key as string];
    const validationResult = rule(value);
    if (!validationResult.ok) {
      return validationResult as Result<T, ValidationError>;
    }
    (result as any)[key] = value;
  }

  return Ok(result as T);
};

// Validation result aggregation
export const collectValidationErrors = <T>(
  validators: Array<() => Result<T, ValidationError>>
): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  for (const validator of validators) {
    const result = validator();
    if (!result.ok) {
      errors.push(result.error);
    }
  }
  
  return errors;
};