import * as yaml from 'js-yaml';

import { Result } from '../types';

/**
 * Parse YAML content from string
 */
export const parseYaml = (content: string): Result<unknown> => {
  try {
    const parsed = yaml.load(content);
    return { ok: true as const, value: parsed };
  } catch (error) {
    return {
      ok: false as const,
      error: new Error(`YAML parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    };
  }
};