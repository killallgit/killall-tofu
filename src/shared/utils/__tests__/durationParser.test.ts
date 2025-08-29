import { 
  parseTimeoutDuration, 
  DURATION_REGEX, 
  DURATION_MULTIPLIERS 
} from '../durationParser';

describe('durationParser', () => {
  describe('DURATION_REGEX', () => {
    it('should match valid duration formats', () => {
      expect('2 hours'.match(DURATION_REGEX)).toBeTruthy();
      expect('30 minutes'.match(DURATION_REGEX)).toBeTruthy();
      expect('1 day'.match(DURATION_REGEX)).toBeTruthy();
      expect('5 seconds'.match(DURATION_REGEX)).toBeTruthy();
    });

    it('should match abbreviated formats', () => {
      expect('2h'.match(DURATION_REGEX)).toBeTruthy();
      expect('30m'.match(DURATION_REGEX)).toBeTruthy();
      expect('1d'.match(DURATION_REGEX)).toBeTruthy();
      expect('5s'.match(DURATION_REGEX)).toBeTruthy();
    });

    it('should not match invalid formats', () => {
      expect('invalid'.match(DURATION_REGEX)).toBeFalsy();
      expect('2'.match(DURATION_REGEX)).toBeFalsy();
      expect('hours 2'.match(DURATION_REGEX)).toBeFalsy();
    });
  });

  describe('DURATION_MULTIPLIERS', () => {
    it('should have correct second multipliers', () => {
      expect(DURATION_MULTIPLIERS.s).toBe(1000);
      expect(DURATION_MULTIPLIERS.sec).toBe(1000);
      expect(DURATION_MULTIPLIERS.second).toBe(1000);
      expect(DURATION_MULTIPLIERS.seconds).toBe(1000);
    });

    it('should have correct minute multipliers', () => {
      expect(DURATION_MULTIPLIERS.m).toBe(60 * 1000);
      expect(DURATION_MULTIPLIERS.min).toBe(60 * 1000);
      expect(DURATION_MULTIPLIERS.minute).toBe(60 * 1000);
      expect(DURATION_MULTIPLIERS.minutes).toBe(60 * 1000);
    });

    it('should have correct hour multipliers', () => {
      expect(DURATION_MULTIPLIERS.h).toBe(60 * 60 * 1000);
      expect(DURATION_MULTIPLIERS.hr).toBe(60 * 60 * 1000);
      expect(DURATION_MULTIPLIERS.hour).toBe(60 * 60 * 1000);
      expect(DURATION_MULTIPLIERS.hours).toBe(60 * 60 * 1000);
    });

    it('should have correct day multipliers', () => {
      expect(DURATION_MULTIPLIERS.d).toBe(24 * 60 * 60 * 1000);
      expect(DURATION_MULTIPLIERS.day).toBe(24 * 60 * 60 * 1000);
      expect(DURATION_MULTIPLIERS.days).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('parseTimeoutDuration', () => {
    it('should parse valid durations correctly', () => {
      expect(parseTimeoutDuration('2 hours')).toEqual({
        ok: true,
        value: 2 * 60 * 60 * 1000
      });
      
      expect(parseTimeoutDuration('30 minutes')).toEqual({
        ok: true,
        value: 30 * 60 * 1000
      });
      
      expect(parseTimeoutDuration('1 day')).toEqual({
        ok: true,
        value: 24 * 60 * 60 * 1000
      });
    });

    it('should parse abbreviated formats', () => {
      expect(parseTimeoutDuration('2h')).toEqual({
        ok: true,
        value: 2 * 60 * 60 * 1000
      });
      
      expect(parseTimeoutDuration('30m')).toEqual({
        ok: true,
        value: 30 * 60 * 1000
      });
    });

    it('should handle case insensitive input', () => {
      expect(parseTimeoutDuration('2 HOURS')).toEqual({
        ok: true,
        value: 2 * 60 * 60 * 1000
      });
    });

    it('should reject invalid formats', () => {
      const result = parseTimeoutDuration('invalid');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid duration format');
      }
    });

    it('should reject empty or null input', () => {
      const result1 = parseTimeoutDuration('');
      expect(result1.ok).toBe(false);
      if (!result1.ok) {
        expect(result1.error.message).toBe('Duration must be a non-empty string');
      }

      const result2 = parseTimeoutDuration(null as any);
      expect(result2.ok).toBe(false);
    });

    it('should reject durations outside valid range', () => {
      // Too short (less than 1 second)
      const tooShort = parseTimeoutDuration('500 milliseconds');
      expect(tooShort.ok).toBe(false);

      // Too long (more than 30 days)
      const tooLong = parseTimeoutDuration('31 days');
      expect(tooLong.ok).toBe(false);
      if (!tooLong.ok) {
        expect(tooLong.error.message).toContain('Duration must be between 1 second and 30 days');
      }
    });

    it('should handle boundary values correctly', () => {
      // Minimum (1 second)
      const min = parseTimeoutDuration('1 second');
      expect(min.ok).toBe(true);
      if (min.ok) {
        expect(min.value).toBe(1000);
      }

      // Maximum (30 days)
      const max = parseTimeoutDuration('30 days');
      expect(max.ok).toBe(true);
      if (max.ok) {
        expect(max.value).toBe(30 * 24 * 60 * 60 * 1000);
      }
    });

    it('should reject unsupported units', () => {
      const result = parseTimeoutDuration('2 fortnights');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Unsupported duration unit');
      }
    });
  });
});