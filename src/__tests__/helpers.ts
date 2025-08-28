/**
 * Test helper utilities and common test functions
 */

import { Project, Execution, ProjectConfig, NotificationMessage } from '../shared/types';
import { Result, Ok, Err } from '../shared/utils/result';

// Test data generators
export const createTestId = (): string => {
  return 'test_' + Math.random().toString(36).substring(2, 15);
};

export const createTestProject = (overrides: Partial<Project> = {}): Project => {
  const id = createTestId();
  return {
    id,
    path: `/test/projects/${id}`,
    config: {
      version: 1,
      timeout: '1 hour',
      name: `test-project-${id}`,
      tags: ['test'],
    },
    discoveredAt: new Date(),
    destroyAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    status: 'discovered',
    ...overrides,
  };
};

export const createTestExecution = (overrides: Partial<Execution> = {}): Execution => {
  return {
    id: createTestId(),
    projectId: createTestId(),
    startedAt: new Date(),
    status: 'queued',
    ...overrides,
  };
};

export const createTestConfig = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => {
  return {
    version: 1,
    timeout: '30 minutes',
    ...overrides,
  };
};

export const createTestNotification = (overrides: Partial<NotificationMessage> = {}): NotificationMessage => {
  return {
    type: 'info',
    title: 'Test Notification',
    body: 'This is a test notification',
    timestamp: new Date(),
    ...overrides,
  };
};

// Result testing helpers
export const expectOk = <T, E>(result: Result<T, E>): T => {
  expect(result.ok).toBe(true);
  if (result.ok) {
    return result.value;
  }
  throw new Error('Expected Ok result but got Err');
};

export const expectErr = <T, E>(result: Result<T, E>): E => {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    return result.error;
  }
  throw new Error('Expected Err result but got Ok');
};

export const expectOkWith = <T, E>(result: Result<T, E>, expectedValue: T): void => {
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value).toEqual(expectedValue);
  }
};

export const expectErrWith = <T, E extends Error>(result: Result<T, E>, expectedMessage: string): void => {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.message).toContain(expectedMessage);
  }
};

// Async testing helpers
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
};

export const expectEventually = async (
  fn: () => void | Promise<void>,
  timeout: number = 5000
): Promise<void> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      await fn();
      return; // Success
    } catch (error) {
      // Continue trying
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Final attempt to get the actual error
  await fn();
};

// Mock helpers
export const createMockFunction = <T extends (...args: any[]) => any>(
  implementation?: T
): jest.MockedFunction<T> => {
  return jest.fn(implementation) as jest.MockedFunction<T>;
};

export const createSpyObject = <T extends Record<string, any>>(
  baseName: string,
  methodNames: (keyof T)[]
): { [K in keyof T]: jest.MockedFunction<T[K]> } => {
  const spy: any = {};
  
  methodNames.forEach(name => {
    spy[name] = jest.fn();
  });
  
  return spy;
};

// Date testing helpers
export const mockDateNow = (date: Date): jest.SpyInstance => {
  return jest.spyOn(Date, 'now').mockReturnValue(date.getTime());
};

export const advanceTime = async (ms: number): Promise<void> => {
  jest.advanceTimersByTime(ms);
  await Promise.resolve(); // Allow promises to resolve
};

// Array testing helpers
export const expectArrayToContain = <T>(
  array: T[],
  predicate: (item: T) => boolean,
  message?: string
): void => {
  const found = array.some(predicate);
  expect(found).toBe(true);
  if (!found && message) {
    throw new Error(message);
  }
};

export const expectArrayLength = <T>(array: T[], expectedLength: number): void => {
  expect(array).toHaveLength(expectedLength);
};

export const expectArrayToBeEmpty = <T>(array: T[]): void => {
  expect(array).toHaveLength(0);
};

// Error testing helpers
export const expectToThrow = async (
  fn: () => Promise<any> | any,
  expectedError?: string | RegExp
): Promise<void> => {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (expectedError) {
      if (typeof expectedError === 'string') {
        expect(error.message).toContain(expectedError);
      } else {
        expect(error.message).toMatch(expectedError);
      }
    }
  }
};

export const expectNotToThrow = async (fn: () => Promise<any> | any): Promise<any> => {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`Expected function not to throw, but it threw: ${error.message}`);
  }
};

// Object testing helpers
export const expectObjectToHaveKeys = (obj: object, keys: string[]): void => {
  keys.forEach(key => {
    expect(obj).toHaveProperty(key);
  });
};

export const expectObjectNotToHaveKeys = (obj: object, keys: string[]): void => {
  keys.forEach(key => {
    expect(obj).not.toHaveProperty(key);
  });
};

// Performance testing helpers
export const measureTime = async <T>(fn: () => Promise<T> | T): Promise<{ result: T; duration: number }> => {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();
  
  return {
    result,
    duration: endTime - startTime,
  };
};

export const expectPerformance = async <T>(
  fn: () => Promise<T> | T,
  maxDurationMs: number
): Promise<T> => {
  const { result, duration } = await measureTime(fn);
  expect(duration).toBeLessThan(maxDurationMs);
  return result;
};

// File system testing helpers
export const createTempDir = (): string => {
  return `/tmp/test_${createTestId()}`;
};

export const createTempFile = (extension: string = 'txt'): string => {
  return `/tmp/test_${createTestId()}.${extension}`;
};

// Environment helpers
export const withEnv = <T>(
  envVars: Record<string, string>,
  fn: () => T | Promise<T>
): Promise<T> => {
  const originalEnv = { ...process.env };
  
  Object.assign(process.env, envVars);
  
  const cleanup = () => {
    process.env = originalEnv;
  };
  
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(cleanup);
    } else {
      cleanup();
      return Promise.resolve(result);
    }
  } catch (error) {
    cleanup();
    throw error;
  }
};

// Collection testing helpers
export const expectMapToHaveSize = (map: Map<any, any>, expectedSize: number): void => {
  expect(map.size).toBe(expectedSize);
};

export const expectSetToHaveSize = (set: Set<any>, expectedSize: number): void => {
  expect(set.size).toBe(expectedSize);
};

export const expectSetToContain = <T>(set: Set<T>, value: T): void => {
  expect(set.has(value)).toBe(true);
};

export const expectMapToHaveKey = <K, V>(map: Map<K, V>, key: K): void => {
  expect(map.has(key)).toBe(true);
};