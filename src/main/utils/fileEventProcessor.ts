import { Result } from '../../shared/utils/result';

export interface FileEventContext {
  event: string;
  filePath: string;
  projectPath: string;
}

export interface ProcessingStats {
  discoveredProjects: number;
  errors: number;
}

/**
 * Determine the appropriate action based on file event type
 */
export const determineFileEventAction = (event: string): 'discover' | 'remove' | 'ignore' => {
  switch (event) {
    case 'add':
    case 'change':
      return 'discover';
    case 'unlink':
      return 'remove';
    default:
      return 'ignore';
  }
};

/**
 * Update processing statistics based on result
 */
export const updateStatsFromResult = (
  stats: ProcessingStats,
  result: Result<any>
): ProcessingStats => {
  if (result.ok) {
    return {
      ...stats,
      discoveredProjects: stats.discoveredProjects + 1
    };
  } else {
    return {
      ...stats,
      errors: stats.errors + 1
    };
  }
};

/**
 * Create event details for logging
 */
export const createEventDetails = (action: string, reason: string, path: string): string => {
  return JSON.stringify({
    action,
    reason,
    path
  });
};