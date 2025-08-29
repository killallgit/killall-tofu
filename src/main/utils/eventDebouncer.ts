/**
 * Create a debounced function that delays execution
 */
export const createDebouncedFunction = (
  fn: (...args: any[]) => void,
  delay: number
): (...args: any[]) => void => {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
};

/**
 * Create a timer registry for managing multiple debounced operations
 */
export class TimerRegistry {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Set a debounced timer for a specific key
   */
  public setTimer(key: string, fn: () => void, delay: number): void {
    // Clear existing timer if it exists
    this.clearTimer(key);
    
    // Set new timer
    const timerId = setTimeout(() => {
      fn();
      this.timers.delete(key);
    }, delay);
    
    this.timers.set(key, timerId);
  }

  /**
   * Clear a specific timer
   */
  public clearTimer(key: string): void {
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(key);
    }
  }

  /**
   * Clear all timers
   */
  public clearAllTimers(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Check if a timer exists for a key
   */
  public hasTimer(key: string): boolean {
    return this.timers.has(key);
  }

  /**
   * Get the number of active timers
   */
  public getActiveCount(): number {
    return this.timers.size;
  }
}