import * as path from 'path';

import { parseDuration } from '../../shared/utils/duration';
import { Result } from '../../shared/utils/result';

/**
 * Calculate destroy time based on timeout string
 */
export const calculateDestroyTime = (timeout: string, baseTime: Date): Date => {
  const durationResult = parseDuration(timeout);
  if (durationResult.ok) {
    return new Date(baseTime.getTime() + durationResult.value.milliseconds);
  }
  
  // Fallback to 2 hours if parsing fails
  return new Date(baseTime.getTime() + 2 * 60 * 60 * 1000);
};

/**
 * Extract project path from config file path
 */
export const getProjectPath = (configFilePath: string): string => {
  return path.dirname(configFilePath);
};

/**
 * Create project paths set from config file paths
 */
export const createProjectPathsSet = (configFiles: string[]): Set<string> => {
  return new Set(configFiles.map(f => path.dirname(f)));
};