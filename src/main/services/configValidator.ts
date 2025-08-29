// Configuration validation service for .killall.yaml files
// Orchestrates YAML parsing and configuration validation

import * as path from 'path';

import { Result, ProjectConfig } from '../database/types';
import { parseYaml } from '../../shared/utils/configParser';
import { validateProjectConfig } from '../../shared/utils/configValidation';
import { validatePath, readFileContent } from '../../shared/utils/fileValidation';

// Re-export for backwards compatibility
export { parseTimeoutDuration as parseDuration } from '../../shared/utils/durationParser';
export { validatePath } from '../../shared/utils/fileValidation';
export { validateProjectConfig as validateConfig } from '../../shared/utils/configValidation';

// Configuration validation errors
export interface ConfigValidationError extends Error {
  name: 'ConfigValidationError';
  readonly field?: string;
  readonly value?: unknown;
}

export const createConfigValidationError = (
  message: string,
  field?: string,
  value?: unknown
): ConfigValidationError => {
  const error = new Error(message) as ConfigValidationError;
  error.name = 'ConfigValidationError';
  (error as any).field = field;
  (error as any).value = value;
  return error;
};

/**
 * Parse and validate a .killall.yaml configuration file
 */
export const parseConfigFile = async (filePath: string): Promise<Result<ProjectConfig>> => {
  try {
    // Validate file path security
    const projectPath = path.dirname(filePath);
    const pathResult = validatePath('.killall.yaml', projectPath);
    if (!pathResult.ok) {
      return {
        ok: false,
        error: createConfigValidationError(
          pathResult.error.message,
          'file',
          filePath
        )
      };
    }

    // Read file
    const contentResult = await readFileContent(filePath);
    if (!contentResult.ok) {
      return {
        ok: false,
        error: createConfigValidationError(
          contentResult.error.message,
          'file',
          filePath
        )
      };
    }
    
    // Parse YAML
    const parseResult = parseYaml(contentResult.value);
    if (!parseResult.ok) {
      return {
        ok: false,
        error: createConfigValidationError(
          parseResult.error.message,
          'yaml',
          contentResult.value
        )
      };
    }

    // Validate configuration
    const validationResult = await validateProjectConfig(parseResult.value, projectPath);
    if (!validationResult.ok) {
      return {
        ok: false,
        error: createConfigValidationError(
          validationResult.error.message,
          'config',
          parseResult.value
        )
      };
    }

    return validationResult;

  } catch (error) {
    return {
      ok: false,
      error: createConfigValidationError(
        `Failed to process configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'file',
        filePath
      )
    };
  }
};