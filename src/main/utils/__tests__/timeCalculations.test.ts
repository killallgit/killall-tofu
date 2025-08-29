import { 
  calculateMillisecondsUntil,
  calculateWarningTime,
  isTimeInFuture,
  calculateWarningSchedules,
  formatTimeRemaining
} from '../timeCalculations';

describe('timeCalculations', () => {
  describe('calculateMillisecondsUntil', () => {
    it('should calculate positive milliseconds for future date', () => {
      const currentTime = new Date('2025-01-01T12:00:00Z');
      const futureTime = new Date('2025-01-01T14:00:00Z');
      
      const result = calculateMillisecondsUntil(futureTime, currentTime);
      
      expect(result).toBe(2 * 60 * 60 * 1000); // 2 hours in ms
    });

    it('should calculate negative milliseconds for past date', () => {
      const currentTime = new Date('2025-01-01T12:00:00Z');
      const pastTime = new Date('2025-01-01T10:00:00Z');
      
      const result = calculateMillisecondsUntil(pastTime, currentTime);
      
      expect(result).toBe(-2 * 60 * 60 * 1000); // -2 hours in ms
    });

    it('should handle same time', () => {
      const time = new Date('2025-01-01T12:00:00Z');
      
      const result = calculateMillisecondsUntil(time, time);
      
      expect(result).toBe(0);
    });
  });

  describe('calculateWarningTime', () => {
    it('should calculate warning time before destruction', () => {
      const destroyAt = new Date('2025-01-01T12:00:00Z');
      const warningMinutes = 30;
      
      const result = calculateWarningTime(destroyAt, warningMinutes);
      
      expect(result).toEqual(new Date('2025-01-01T11:30:00Z'));
    });

    it('should handle different warning intervals', () => {
      const destroyAt = new Date('2025-01-01T12:00:00Z');
      
      expect(calculateWarningTime(destroyAt, 60)).toEqual(new Date('2025-01-01T11:00:00Z'));
      expect(calculateWarningTime(destroyAt, 5)).toEqual(new Date('2025-01-01T11:55:00Z'));
      expect(calculateWarningTime(destroyAt, 1)).toEqual(new Date('2025-01-01T11:59:00Z'));
    });
  });

  describe('isTimeInFuture', () => {
    it('should return true for future time', () => {
      const currentTime = new Date('2025-01-01T12:00:00Z');
      const futureTime = new Date('2025-01-01T14:00:00Z');
      
      expect(isTimeInFuture(futureTime, currentTime)).toBe(true);
    });

    it('should return false for past time', () => {
      const currentTime = new Date('2025-01-01T12:00:00Z');
      const pastTime = new Date('2025-01-01T10:00:00Z');
      
      expect(isTimeInFuture(pastTime, currentTime)).toBe(false);
    });

    it('should return false for same time', () => {
      const time = new Date('2025-01-01T12:00:00Z');
      
      expect(isTimeInFuture(time, time)).toBe(false);
    });
  });

  describe('calculateWarningSchedules', () => {
    it('should create schedules for all warning times', () => {
      const destroyAt = new Date('2025-01-01T12:00:00Z');
      const currentTime = new Date('2025-01-01T10:00:00Z'); // 2 hours before
      const warningTimes = [60, 30, 15]; // minutes before
      
      const result = calculateWarningSchedules(destroyAt, warningTimes, currentTime);
      
      expect(result).toHaveLength(3);
      expect(result[0].warningMinutes).toBe(60);
      expect(result[0].shouldSchedule).toBe(true);
      expect(result[0].msUntilWarning).toBe(60 * 60 * 1000); // 1 hour
    });

    it('should mark past warnings as non-schedulable', () => {
      const destroyAt = new Date('2025-01-01T12:00:00Z');
      const currentTime = new Date('2025-01-01T11:45:00Z'); // 15 minutes before
      const warningTimes = [60, 30, 15]; // minutes before
      
      const result = calculateWarningSchedules(destroyAt, warningTimes, currentTime);
      
      expect(result[0].shouldSchedule).toBe(false); // 60min warning is past
      expect(result[1].shouldSchedule).toBe(false); // 30min warning is past  
      expect(result[2].shouldSchedule).toBe(false); // 15min warning is now (not future)
    });
  });

  describe('formatTimeRemaining', () => {
    it('should format hours and minutes', () => {
      const twoHours30Minutes = 2.5 * 60 * 60 * 1000;
      expect(formatTimeRemaining(twoHours30Minutes)).toBe('2h 30m');
    });

    it('should format only minutes when less than an hour', () => {
      const fortyFiveMinutes = 45 * 60 * 1000;
      expect(formatTimeRemaining(fortyFiveMinutes)).toBe('45m');
    });

    it('should handle exact hours', () => {
      const threeHours = 3 * 60 * 60 * 1000;
      expect(formatTimeRemaining(threeHours)).toBe('3h 0m');
    });

    it('should handle zero time', () => {
      expect(formatTimeRemaining(0)).toBe('0m');
    });

    it('should handle partial minutes', () => {
      const oneMinute30Seconds = 90 * 1000;
      expect(formatTimeRemaining(oneMinute30Seconds)).toBe('1m');
    });
  });
});