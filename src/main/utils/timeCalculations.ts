/**
 * Calculate milliseconds until a future date
 */
export const calculateMillisecondsUntil = (targetDate: Date, currentDate: Date = new Date()): number => {
  return targetDate.getTime() - currentDate.getTime();
};

/**
 * Calculate warning time based on destroy time and warning minutes
 */
export const calculateWarningTime = (destroyAt: Date, warningMinutes: number): Date => {
  return new Date(destroyAt.getTime() - (warningMinutes * 60 * 1000));
};

/**
 * Check if a time is in the future
 */
export const isTimeInFuture = (targetTime: Date, currentTime: Date = new Date()): boolean => {
  return targetTime.getTime() > currentTime.getTime();
};

/**
 * Calculate warning schedule for a destruction time
 */
export interface WarningSchedule {
  warningMinutes: number;
  warningTime: Date;
  msUntilWarning: number;
  shouldSchedule: boolean;
}

export const calculateWarningSchedules = (
  destroyAt: Date, 
  warningTimes: number[],
  currentTime: Date = new Date()
): WarningSchedule[] => {
  return warningTimes.map(warningMinutes => {
    const warningTime = calculateWarningTime(destroyAt, warningMinutes);
    const msUntilWarning = calculateMillisecondsUntil(warningTime, currentTime);
    
    return {
      warningMinutes,
      warningTime,
      msUntilWarning,
      shouldSchedule: msUntilWarning > 0
    };
  });
};

/**
 * Format time remaining as human readable string
 */
export const formatTimeRemaining = (milliseconds: number): string => {
  const totalMinutes = Math.floor(milliseconds / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};