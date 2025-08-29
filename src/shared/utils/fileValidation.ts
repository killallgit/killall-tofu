import { promises as fs } from 'fs';
import * as path from 'path';

import { Result } from '../types';

/**
 * Check if a file exists and is readable
 */
export const validateFileExists = async (filePath: string): Promise<Result<void>> => {
  try {
    await fs.access(filePath, fs.constants.R_OK);
    return { ok: true as const, value: undefined };
  } catch (error) {
    return {
      ok: false as const,
      error: new Error(`File not accessible: ${filePath}`)
    };
  }
};

/**
 * Validate path security to prevent directory traversal
 */
export const validatePath = (filename: string, projectPath: string): Result<void> => {
  const resolvedPath = path.resolve(projectPath, filename);
  const resolvedProjectPath = path.resolve(projectPath);

  // Ensure the resolved path is within the project directory
  if (!resolvedPath.startsWith(resolvedProjectPath + path.sep) && resolvedPath !== resolvedProjectPath) {
    return {
      ok: false as const,
      error: new Error(`Path traversal detected: ${filename}`)
    };
  }

  return { ok: true as const, value: undefined };
};

/**
 * Read file content safely
 */
export const readFileContent = async (filePath: string): Promise<Result<string>> => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { ok: true as const, value: content };
  } catch (error) {
    return {
      ok: false as const,
      error: new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    };
  }
};