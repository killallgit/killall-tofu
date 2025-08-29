import { promises as fs, constants as fsConstants } from 'fs';
import * as path from 'path';

import { Result } from '../../shared/utils/result';

/**
 * Default patterns to exclude from project scanning
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.terraform',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'target',
  'bin',
  'obj'
];

/**
 * Recursively find all .killall.yaml files in a directory
 */
export const findConfigFiles = async (
  dirPath: string,
  maxDepth: number,
  excludePatterns: string[] = DEFAULT_EXCLUDE_PATTERNS
): Promise<Result<string[]>> => {
  const configFiles: string[] = [];

  try {
    await scanDirectory(dirPath, configFiles, maxDepth, 0, excludePatterns);
    return { ok: true, value: configFiles };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error('Directory scan failed')
    };
  }
};

/**
 * Recursively scan directory for config files
 */
export const scanDirectory = async (
  dirPath: string,
  configFiles: string[],
  maxDepth: number,
  currentDepth: number,
  excludePatterns: string[]
): Promise<void> => {
  if (currentDepth > maxDepth) {
    return;
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Check exclusion patterns
      if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
        continue;
      }

      // Check if entry has isFile/isDirectory methods or if it's an object with type property
      const isFile = typeof entry.isFile === 'function' ? entry.isFile() : false;
      const isDirectory = typeof entry.isDirectory === 'function' ? entry.isDirectory() : false;

      if (isFile && entry.name === '.killall.yaml') {
        configFiles.push(fullPath);
      } else if (isDirectory) {
        await scanDirectory(
          fullPath,
          configFiles,
          maxDepth,
          currentDepth + 1,
          excludePatterns
        );
      }
    }
  } catch (error) {
    // Skip directories we can't read (permissions, etc.)
    // This is normal for system directories
  }
};

/**
 * Validate that all scan paths are accessible
 */
export const validateScanPaths = async (scanPaths: string[]): Promise<Result<void>> => {
  for (const scanPath of scanPaths) {
    try {
      await fs.access(scanPath, fsConstants.R_OK);
    } catch (error) {
      return {
        ok: false,
        error: new Error(`Scan path not accessible: ${scanPath}`)
      };
    }
  }
  
  return { ok: true, value: undefined };
};

/**
 * Create batches of items for processing
 */
export const createBatches = <T>(items: T[], batchSize: number): T[][] => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
};