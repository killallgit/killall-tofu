/**
 * Tests for duration parsing utilities
 */

import {
  parseDuration,
  formatDuration,
  parseTimeout,
  DURATIONS,
  milliseconds,
  seconds,
  minutes,
  hours,
  days,
  isValidDuration,
  toTimeout,
  addDurations,
  maxDuration,
  minDuration,
} from '../duration';
import { isOk, isErr } from '../result';

describe('Duration utilities', () => {
  describe('parseDuration', () => {
    it('should parse simple durations', () => {
      const testCases = [
        { input: '5 seconds', expected: 5000 },
        { input: '2 minutes', expected: 120000 },
        { input: '1 hour', expected: 3600000 },
        { input: '3 days', expected: 259200000 },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseDuration(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.milliseconds).toBe(expected);
        }
      });
    });

    it('should parse abbreviated units', () => {
      const testCases = [
        { input: '5s', expected: 5000 },
        { input: '2m', expected: 120000 },
        { input: '1h', expected: 3600000 },
        { input: '3d', expected: 259200000 },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseDuration(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.milliseconds).toBe(expected);
        }
      });
    });

    it('should parse complex durations', () => {
      const result = parseDuration('1 hour 30 minutes 15 seconds');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.milliseconds).toBe(5415000); // 1h + 30m + 15s
      }
    });

    it('should parse numeric-only input as milliseconds', () => {
      const result = parseDuration('5000');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.milliseconds).toBe(5000);
      }
    });

    it('should handle decimal values', () => {
      const result = parseDuration('1.5 hours');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.milliseconds).toBe(5400000); // 1.5 hours
      }
    });

    it('should be case insensitive', () => {
      const result = parseDuration('2 HOURS');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.milliseconds).toBe(7200000);
      }
    });

    it('should handle whitespace', () => {
      const result = parseDuration('  2   hours  ');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.milliseconds).toBe(7200000);
      }
    });

    it('should reject invalid inputs', () => {
      const invalidInputs = ['', '  ', 'invalid', 'abc hours', '5 invalid-unit'];
      
      invalidInputs.forEach(input => {
        const result = parseDuration(input);
        expect(isErr(result)).toBe(true);
      });
    });

    it('should reject negative numbers', () => {
      const result = parseDuration('-5 hours');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds to readable string', () => {
      const testCases = [
        { input: 0, expected: '0ms' },
        { input: 1000, expected: '1s' },
        { input: 60000, expected: '1m' },
        { input: 3600000, expected: '1h' },
        { input: 86400000, expected: '1d' },
        { input: 90000, expected: '1m 30s' },
        { input: 3665000, expected: '1h 1m 5s' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(formatDuration(input)).toBe(expected);
      });
    });

    it('should handle negative values', () => {
      expect(formatDuration(-5000)).toBe('5s');
    });

    it('should handle very large values', () => {
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      const result = formatDuration(oneYear + 86400000); // 1 year + 1 day
      expect(result).toContain('1y');
      expect(result).toContain('1d');
    });
  });

  describe('Duration class methods', () => {
    it('should convert to hours', () => {
      const duration = seconds(3600);
      expect(duration.toHours()).toBe(1);
    });

    it('should convert to days', () => {
      const duration = hours(24);
      expect(duration.toDays()).toBe(1);
    });

    it('should add durations', () => {
      const duration1 = minutes(30);
      const duration2 = minutes(45);
      const sum = duration1.add(duration2);
      expect(sum.milliseconds).toBe(75 * 60 * 1000);
    });

    it('should subtract durations', () => {
      const duration1 = hours(2);
      const duration2 = minutes(30);
      const diff = duration1.subtract(duration2);
      expect(diff.milliseconds).toBe(90 * 60 * 1000);
    });

    it('should not go negative when subtracting', () => {
      const duration1 = minutes(30);
      const duration2 = hours(1);
      const diff = duration1.subtract(duration2);
      expect(diff.milliseconds).toBe(0);
    });

    it('should multiply durations', () => {
      const duration = minutes(30);
      const multiplied = duration.multiply(2);
      expect(multiplied.milliseconds).toBe(60 * 60 * 1000);
    });

    it('should divide durations', () => {
      const duration = hours(2);
      const divided = duration.divide(4);
      expect(divided.milliseconds).toBe(30 * 60 * 1000);
    });

    it('should throw when dividing by zero', () => {
      const duration = hours(1);
      expect(() => duration.divide(0)).toThrow();
    });

    it('should compare durations', () => {
      const duration1 = minutes(30);
      const duration2 = minutes(45);
      const duration3 = minutes(30);

      expect(duration1.isLessThan(duration2)).toBe(true);
      expect(duration2.isGreaterThan(duration1)).toBe(true);
      expect(duration1.equals(duration3)).toBe(true);
    });

    it('should convert to string', () => {
      const duration = hours(1.5);
      expect(duration.toString()).toBe('1h 30m');
    });
  });

  describe('helper functions', () => {
    it('should create durations with helper functions', () => {
      expect(milliseconds(1000).milliseconds).toBe(1000);
      expect(seconds(60).milliseconds).toBe(60000);
      expect(minutes(1).milliseconds).toBe(60000);
      expect(hours(1).milliseconds).toBe(3600000);
      expect(days(1).milliseconds).toBe(86400000);
    });

    it('should validate duration strings', () => {
      expect(isValidDuration('1 hour')).toBe(true);
      expect(isValidDuration('invalid')).toBe(false);
      expect(isValidDuration('')).toBe(false);
    });

    it('should convert to timeout value', () => {
      const duration = seconds(5);
      expect(toTimeout(duration)).toBe(5000);
    });

    it('should cap timeout at maximum safe value', () => {
      const hugeDuration = days(365 * 100); // 100 years
      const timeout = toTimeout(hugeDuration);
      expect(timeout).toBe(2147483647); // Max safe timeout
    });

    it('should parse timeout values', () => {
      const result = parseTimeout('30 seconds');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(30000);
      }
    });
  });

  describe('duration constants', () => {
    it('should provide common duration constants', () => {
      expect(DURATIONS.ZERO.milliseconds).toBe(0);
      expect(DURATIONS.MILLISECOND.milliseconds).toBe(1);
      expect(DURATIONS.SECOND.milliseconds).toBe(1000);
      expect(DURATIONS.MINUTE.milliseconds).toBe(60000);
      expect(DURATIONS.HOUR.milliseconds).toBe(3600000);
      expect(DURATIONS.DAY.milliseconds).toBe(86400000);
      expect(DURATIONS.WEEK.milliseconds).toBe(604800000);
    });
  });

  describe('duration arithmetic', () => {
    it('should add multiple durations', () => {
      const result = addDurations(minutes(30), hours(1), seconds(30));
      expect(result.milliseconds).toBe(5430000); // 1h 30m 30s
    });

    it('should find maximum duration', () => {
      const result = maxDuration(minutes(30), hours(1), seconds(30));
      expect(result.milliseconds).toBe(3600000); // 1 hour
    });

    it('should find minimum duration', () => {
      const result = minDuration(minutes(30), hours(1), seconds(30));
      expect(result.milliseconds).toBe(30000); // 30 seconds
    });

    it('should handle empty arrays', () => {
      expect(maxDuration().equals(DURATIONS.ZERO)).toBe(true);
      expect(minDuration().equals(DURATIONS.ZERO)).toBe(true);
    });
  });
});