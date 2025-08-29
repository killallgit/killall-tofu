import { Result } from '../types';

/**
 * Regular expression for parsing duration strings
 */
export const DURATION_REGEX = /^(\d+)\s*(second|seconds|sec|s|minute|minutes|min|m|hour|hours|hr|h|day|days|d|week|weeks|w)$/i;

/**
 * Duration multipliers in milliseconds
 */
export const DURATION_MULTIPLIERS: Record<string, number> = {
  // Seconds
  'second': 1000,
  'seconds': 1000,
  'sec': 1000,
  's': 1000,
  
  // Minutes
  'minute': 60 * 1000,
  'minutes': 60 * 1000,
  'min': 60 * 1000,
  'm': 60 * 1000,
  
  // Hours
  'hour': 60 * 60 * 1000,
  'hours': 60 * 60 * 1000,
  'hr': 60 * 60 * 1000,
  'h': 60 * 60 * 1000,
  
  // Days
  'day': 24 * 60 * 60 * 1000,
  'days': 24 * 60 * 60 * 1000,
  'd': 24 * 60 * 60 * 1000,
  
  // Weeks
  'week': 7 * 24 * 60 * 60 * 1000,
  'weeks': 7 * 24 * 60 * 60 * 1000,
  'w': 7 * 24 * 60 * 60 * 1000,
};

/**
 * Parse a duration string into milliseconds
 */
export const parseTimeoutDuration = (duration: string): Result<number> => {
  if (!duration || typeof duration !== 'string') {
    return {
      ok: false as const,
      error: new Error('Duration must be a non-empty string')
    };
  }

  const trimmed = duration.trim();
  const match = trimmed.match(DURATION_REGEX);

  if (!match) {
    return {
      ok: false as const,
      error: new Error('Invalid duration format. Use formats like "2 hours", "30 minutes", "1 day"')
    };
  }

  const [, value, unit] = match;
  const multiplier = DURATION_MULTIPLIERS[unit.toLowerCase()];

  if (!multiplier) {
    return {
      ok: false as const,
      error: new Error(`Unsupported duration unit: ${unit}`)
    };
  }

  const milliseconds = parseInt(value, 10) * multiplier;

  // Validate reasonable bounds (1 second to 30 days)
  if (milliseconds < 1000 || milliseconds > 30 * 24 * 60 * 60 * 1000) {
    return {
      ok: false as const,
      error: new Error('Duration must be between 1 second and 30 days')
    };
  }

  return { ok: true as const, value: milliseconds };
};