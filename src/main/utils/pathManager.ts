import * as path from 'path';

/**
 * Extract project path from config file path
 */
export const getProjectPathFromConfig = (configFilePath: string): string => {
  return path.dirname(configFilePath);
};

/**
 * Check if a path is being watched
 */
export const isPathWatched = (targetPath: string, watchedPaths: Set<string>): boolean => {
  return watchedPaths.has(targetPath);
};

/**
 * Add path to watched paths set
 */
export const addPathToWatched = (targetPath: string, watchedPaths: Set<string>): Set<string> => {
  const newWatched = new Set(watchedPaths);
  newWatched.add(targetPath);
  return newWatched;
};

/**
 * Remove path from watched paths set
 */
export const removePathFromWatched = (targetPath: string, watchedPaths: Set<string>): Set<string> => {
  const newWatched = new Set(watchedPaths);
  newWatched.delete(targetPath);
  return newWatched;
};

/**
 * Check if file is a killall config file
 */
export const isKillallConfigFile = (filePath: string): boolean => {
  return path.basename(filePath) === '.killall.yaml';
};