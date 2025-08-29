import { promises as fs, constants as fsConstants } from 'fs';
import * as path from 'path';

import { Result } from '../../shared/utils/result';

/**
 * Check if a project config file exists at the given path
 */
export const projectConfigExists = async (projectPath: string): Promise<boolean> => {
  const configFile = path.join(projectPath, '.killall.yaml');
  
  try {
    await fs.access(configFile, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate a project path is accessible
 */
export const validateProjectPath = async (projectPath: string): Promise<Result<void>> => {
  try {
    await fs.access(projectPath, fsConstants.R_OK);
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: new Error(`Project path not accessible: ${projectPath}`)
    };
  }
};