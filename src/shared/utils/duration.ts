/**
 * Duration parsing utilities for natural language time expressions.
 * Supports formats like "2 hours", "30m", "1 day", etc.
 */

import { Result } from '../types';

import { Ok, Err } from './result';

// Time unit definitions in milliseconds
const TIME_UNITS = {
  millisecond: 1,
  milliseconds: 1,
  ms: 1,
  second: 1000,
  seconds: 1000,
  sec: 1000,
  s: 1000,
  minute: 60 * 1000,
  minutes: 60 * 1000,
  min: 60 * 1000,
  m: 60 * 1000,
  hour: 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  hr: 60 * 60 * 1000,
  h: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000, // Approximate
  months: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000, // Approximate
  years: 365 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
} as const;

type TimeUnit = keyof typeof TIME_UNITS;

// Duration representation
export interface Duration {
  milliseconds: number;
  toString(): string;
  toHours(): number;
  toDays(): number;
  add(other: Duration): Duration;
  subtract(other: Duration): Duration;
  multiply(factor: number): Duration;
  divide(factor: number): Duration;
  equals(other: Duration): boolean;
  isGreaterThan(other: Duration): boolean;
  isLessThan(other: Duration): boolean;
}

class DurationImpl implements Duration {
  constructor(public readonly milliseconds: number) {}

  toString(): string {
    return formatDuration(this.milliseconds);
  }

  toHours(): number {
    return this.milliseconds / (60 * 60 * 1000);
  }

  toDays(): number {
    return this.milliseconds / (24 * 60 * 60 * 1000);
  }

  add(other: Duration): Duration {
    return new DurationImpl(this.milliseconds + other.milliseconds);
  }

  subtract(other: Duration): Duration {
    return new DurationImpl(Math.max(0, this.milliseconds - other.milliseconds));
  }

  multiply(factor: number): Duration {
    return new DurationImpl(this.milliseconds * factor);
  }

  divide(factor: number): Duration {
    if (factor === 0) {
      throw new Error('Cannot divide by zero');
    }
    return new DurationImpl(this.milliseconds / factor);
  }

  equals(other: Duration): boolean {
    return this.milliseconds === other.milliseconds;
  }

  isGreaterThan(other: Duration): boolean {
    return this.milliseconds > other.milliseconds;
  }

  isLessThan(other: Duration): boolean {
    return this.milliseconds < other.milliseconds;
  }
}

// Parse natural language duration strings
export const parseDuration = (input: string): Result<Duration, Error> => {
  if (!input || typeof input !== 'string') {
    return Err(new Error('Duration input must be a non-empty string'));
  }

  const trimmed = input.trim().toLowerCase();
  
  // Handle numeric-only input (assume milliseconds)
  if (/^\d+$/.test(trimmed)) {
    const ms = parseInt(trimmed, 10);
    return Ok(new DurationImpl(ms));
  }

  // Check for negative signs (should be rejected)
  if (trimmed.includes('-')) {
    return Err(new Error('Negative durations are not allowed'));
  }

  // Parse complex duration expressions
  const regex = /(\d+(?:\.\d+)?)\s*([a-z]+)/g;
  let totalMs = 0;
  let match;
  let hasMatch = false;

  while ((match = regex.exec(trimmed)) !== null) {
    hasMatch = true;
    const [, numberStr, unitStr] = match;
    const number = parseFloat(numberStr);
    
    if (isNaN(number) || number < 0) {
      return Err(new Error(`Invalid number: ${numberStr}`));
    }

    const unit = unitStr as TimeUnit;
    if (!(unit in TIME_UNITS)) {
      return Err(new Error(`Unknown time unit: ${unit}`));
    }

    totalMs += number * TIME_UNITS[unit];
  }

  if (!hasMatch) {
    return Err(new Error(`Invalid duration format: ${input}`));
  }

  return Ok(new DurationImpl(totalMs));
};

// Format milliseconds back to human-readable string
export const formatDuration = (milliseconds: number): string => {
  if (milliseconds === 0) {
    return '0ms';
  }

  const units = [
    { name: 'y', ms: TIME_UNITS.year },
    { name: 'd', ms: TIME_UNITS.day },
    { name: 'h', ms: TIME_UNITS.hour },
    { name: 'm', ms: TIME_UNITS.minute },
    { name: 's', ms: TIME_UNITS.second },
    { name: 'ms', ms: TIME_UNITS.millisecond },
  ];

  let remaining = Math.abs(milliseconds);
  const parts: string[] = [];

  for (const unit of units) {
    if (remaining >= unit.ms) {
      const count = Math.floor(remaining / unit.ms);
      parts.push(`${count}${unit.name}`);
      remaining -= count * unit.ms;
    }
  }

  return parts.join(' ') || '0ms';
};

// Common duration constants
export const DURATIONS = {
  ZERO: new DurationImpl(0),
  MILLISECOND: new DurationImpl(1),
  SECOND: new DurationImpl(1000),
  MINUTE: new DurationImpl(60 * 1000),
  HOUR: new DurationImpl(60 * 60 * 1000),
  DAY: new DurationImpl(24 * 60 * 60 * 1000),
  WEEK: new DurationImpl(7 * 24 * 60 * 60 * 1000),
} as const;

// Utility functions
export const milliseconds = (n: number): Duration => new DurationImpl(n);
export const seconds = (n: number): Duration => new DurationImpl(n * 1000);
export const minutes = (n: number): Duration => new DurationImpl(n * 60 * 1000);
export const hours = (n: number): Duration => new DurationImpl(n * 60 * 60 * 1000);
export const days = (n: number): Duration => new DurationImpl(n * 24 * 60 * 60 * 1000);

// Duration validation
export const isValidDuration = (input: string): boolean => {
  const result = parseDuration(input);
  return result.ok;
};

// Convert duration to timeout value (for setTimeout)
export const toTimeout = (duration: Duration): number => {
  const maxTimeout = 2147483647; // Maximum safe timeout value
  return Math.min(duration.milliseconds, maxTimeout);
};

// Parse timeout specifically (commonly used in config)
export const parseTimeout = (input: string): Result<number, Error> => {
  const durationResult = parseDuration(input);
  if (!durationResult.ok) {
    return durationResult;
  }
  return Ok(durationResult.value.milliseconds);
};

// Duration arithmetic
export const addDurations = (...durations: Duration[]): Duration => {
  const totalMs = durations.reduce((sum, d) => sum + d.milliseconds, 0);
  return new DurationImpl(totalMs);
};

export const maxDuration = (...durations: Duration[]): Duration => {
  if (durations.length === 0) {
    return DURATIONS.ZERO;
  }
  const maxMs = Math.max(...durations.map(d => d.milliseconds));
  return new DurationImpl(maxMs);
};

export const minDuration = (...durations: Duration[]): Duration => {
  if (durations.length === 0) {
    return DURATIONS.ZERO;
  }
  const minMs = Math.min(...durations.map(d => d.milliseconds));
  return new DurationImpl(minMs);
};