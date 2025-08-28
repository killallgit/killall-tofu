/**
 * Path validation and utility functions for file system operations.
 */

import * as path from 'path';

import { Result } from '../types';

import { Ok, Err } from './result';

// Path validation
export const isValidPath = (pathStr: string): boolean => {
  try {
    path.resolve(pathStr);
    return true;
  } catch {
    return false;
  }
};

export const validatePath = (pathStr: string): Result<string, Error> => {
  if (!pathStr || typeof pathStr !== 'string') {
    return Err(new Error('Path must be a non-empty string'));
  }

  const trimmed = pathStr.trim();
  if (trimmed.length === 0) {
    return Err(new Error('Path cannot be empty'));
  }

  if (!isValidPath(trimmed)) {
    return Err(new Error(`Invalid path: ${trimmed}`));
  }

  return Ok(path.resolve(trimmed));
};

// Path normalization
export const normalizePath = (pathStr: string): Result<string, Error> => {
  const validationResult = validatePath(pathStr);
  if (!validationResult.ok) {
    return validationResult;
  }

  try {
    const normalized = path.normalize(validationResult.value);
    return Ok(normalized);
  } catch (error) {
    return Err(new Error(`Failed to normalize path: ${error}`));
  }
};

// Safe path joining
export const joinPaths = (...pathSegments: string[]): Result<string, Error> => {
  if (pathSegments.length === 0) {
    return Err(new Error('No path segments provided'));
  }

  try {
    const joined = path.join(...pathSegments);
    return Ok(joined);
  } catch (error) {
    return Err(new Error(`Failed to join paths: ${error}`));
  }
};

// Path relationship checks
export const isSubPath = (childPath: string, parentPath: string): Result<boolean, Error> => {
  const childResult = normalizePath(childPath);
  const parentResult = normalizePath(parentPath);

  if (!childResult.ok) return childResult;
  if (!parentResult.ok) return parentResult;

  const relative = path.relative(parentResult.value, childResult.value);
  const isSubPath = !relative.startsWith('..') && !path.isAbsolute(relative);
  
  return Ok(isSubPath);
};

export const getRelativePath = (fromPath: string, toPath: string): Result<string, Error> => {
  const fromResult = normalizePath(fromPath);
  const toResult = normalizePath(toPath);

  if (!fromResult.ok) return fromResult;
  if (!toResult.ok) return toResult;

  try {
    const relative = path.relative(fromResult.value, toResult.value);
    return Ok(relative);
  } catch (error) {
    return Err(new Error(`Failed to get relative path: ${error}`));
  }
};

// Path information extraction
export const getPathInfo = (pathStr: string): Result<{
  directory: string;
  filename: string;
  basename: string;
  extension: string;
  isAbsolute: boolean;
}, Error> => {
  const validationResult = validatePath(pathStr);
  if (!validationResult.ok) {
    return validationResult;
  }

  const resolvedPath = validationResult.value;

  return Ok({
    directory: path.dirname(resolvedPath),
    filename: path.basename(resolvedPath),
    basename: path.basename(resolvedPath, path.extname(resolvedPath)),
    extension: path.extname(resolvedPath),
    isAbsolute: path.isAbsolute(resolvedPath),
  });
};

// Configuration file detection
export const findConfigFile = (
  startPath: string,
  configFilenames: string[]
): Result<string | null, Error> => {
  const validationResult = validatePath(startPath);
  if (!validationResult.ok) {
    return validationResult;
  }

  let currentPath = validationResult.value;
  const root = path.parse(currentPath).root;

  while (currentPath !== root) {
    for (const filename of configFilenames) {
      const configPath = path.join(currentPath, filename);
      try {
        // Note: In a real implementation, you'd check if the file exists
        // For now, we'll just construct the path
        return Ok(configPath);
      } catch {
        // Continue searching
      }
    }
    currentPath = path.dirname(currentPath);
  }

  return Ok(null);
};

// Path sanitization for safe file operations
export const sanitizePath = (pathStr: string): Result<string, Error> => {
  if (!pathStr || typeof pathStr !== 'string') {
    return Err(new Error('Path must be a non-empty string'));
  }

  // Remove dangerous characters and sequences
  const dangerous = [
    /\.\./g,           // Directory traversal
    /[<>:"|?*]/g,      // Windows reserved characters
    // eslint-disable-next-line no-control-regex
    /[\x00-\x1f]/g,    // Control characters
    /^\.+$/,           // Dot-only names
    /\s+$/,            // Trailing whitespace
  ];

  let sanitized = pathStr.trim();

  for (const pattern of dangerous) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Check for Windows reserved names
  const windowsReserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  const basename = path.basename(sanitized, path.extname(sanitized));
  
  if (windowsReserved.test(basename)) {
    return Err(new Error(`Reserved filename: ${basename}`));
  }

  if (sanitized.length === 0) {
    return Err(new Error('Path becomes empty after sanitization'));
  }

  return Ok(sanitized);
};

// Path matching utilities
export const matchesPattern = (pathStr: string, pattern: string): Result<boolean, Error> => {
  const pathResult = normalizePath(pathStr);
  if (!pathResult.ok) return pathResult;

  try {
    // Simple glob-like pattern matching
    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\\\*/g, '.*') // Convert * to .*
      .replace(/\\\?/g, '.'); // Convert ? to .

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return Ok(regex.test(pathResult.value));
  } catch (error) {
    return Err(new Error(`Invalid pattern: ${pattern}`));
  }
};

// Path array utilities
export const filterPaths = (
  paths: string[],
  predicate: (path: string) => boolean
): Result<string[], Error> => {
  const validPaths: string[] = [];
  
  for (const pathStr of paths) {
    const validationResult = validatePath(pathStr);
    if (validationResult.ok && predicate(validationResult.value)) {
      validPaths.push(validationResult.value);
    }
  }
  
  return Ok(validPaths);
};

export const dedupePaths = (paths: string[]): Result<string[], Error> => {
  const normalizedPaths = new Set<string>();
  
  for (const pathStr of paths) {
    const normalizationResult = normalizePath(pathStr);
    if (normalizationResult.ok) {
      normalizedPaths.add(normalizationResult.value);
    }
  }
  
  return Ok(Array.from(normalizedPaths));
};

// Common path constants
export const COMMON_CONFIG_FILES = [
  '.killall.yaml',
  '.killall.yml',
  'killall.config.js',
  'killall.config.json',
] as const;

export const COMMON_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.DS_Store',
  '**/Thumbs.db',
] as const;

// Path validation predicates
export const isHiddenPath = (pathStr: string): boolean => {
  return path.basename(pathStr).startsWith('.');
};

export const hasExtension = (pathStr: string, extension: string): boolean => {
  return path.extname(pathStr).toLowerCase() === extension.toLowerCase();
};

export const isInDirectory = (pathStr: string, directory: string): Result<boolean, Error> => {
  const pathResult = normalizePath(pathStr);
  const dirResult = normalizePath(directory);

  if (!pathResult.ok) return pathResult;
  if (!dirResult.ok) return dirResult;

  return Ok(pathResult.value.startsWith(dirResult.value + path.sep));
};