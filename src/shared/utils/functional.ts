/**
 * Functional programming utilities for composition and data transformation.
 */

import { Result, Mapper, AsyncMapper, Predicate, AsyncPredicate } from '../types';

// Function composition
export const compose = <A, B, C>(
  f: (b: B) => C,
  g: (a: A) => B
) => (a: A): C => f(g(a));

export const pipe = <T>(...fns: Array<(arg: T) => T>) => (value: T): T =>
  fns.reduce((acc, fn) => fn(acc), value);

export const pipeAsync = <T>(...fns: Array<(arg: T) => Promise<T>>) => 
  async (value: T): Promise<T> => {
    let result = value;
    for (const fn of fns) {
      result = await fn(result);
    }
    return result;
  };

// Currying utilities
export const curry2 = <A, B, C>(fn: (a: A, b: B) => C) => 
  (a: A) => (b: B) => fn(a, b);

export const curry3 = <A, B, C, D>(fn: (a: A, b: B, c: C) => D) => 
  (a: A) => (b: B) => (c: C) => fn(a, b, c);

// Array utilities
export const head = <T>(array: readonly T[]): T | undefined => array[0];

export const tail = <T>(array: readonly T[]): T[] => array.slice(1);

export const last = <T>(array: readonly T[]): T | undefined => 
  array.length > 0 ? array[array.length - 1] : undefined;

export const init = <T>(array: readonly T[]): T[] => array.slice(0, -1);

// Functional array operations
export const mapArray = <T, U>(mapper: Mapper<T, U>) => 
  (array: readonly T[]): U[] => array.map(mapper);

export const filterArray = <T>(predicate: Predicate<T>) => 
  (array: readonly T[]): T[] => array.filter(predicate);

export const reduceArray = <T, U>(
  reducer: (acc: U, value: T, index: number) => U,
  initial: U
) => (array: readonly T[]): U => array.reduce(reducer, initial);

export const findArray = <T>(predicate: Predicate<T>) => 
  (array: readonly T[]): T | undefined => array.find(predicate);

// Async array operations
export const mapArrayAsync = <T, U>(mapper: AsyncMapper<T, U>) => 
  async (array: readonly T[]): Promise<U[]> => Promise.all(array.map(mapper));

export const filterArrayAsync = <T>(predicate: AsyncPredicate<T>) => 
  async (array: readonly T[]): Promise<T[]> => {
    const results = await Promise.all(array.map(async (item, index) => ({
      item,
      index,
      include: await predicate(item)
    })));
    return results.filter(r => r.include).map(r => r.item);
  };

export const findArrayAsync = <T>(predicate: AsyncPredicate<T>) => 
  async (array: readonly T[]): Promise<T | undefined> => {
    for (const item of array) {
      if (await predicate(item)) {
        return item;
      }
    }
    return undefined;
  };

// Object utilities
export const pick = <T extends object, K extends keyof T>(keys: readonly K[]) => 
  (obj: T): Pick<T, K> => {
    const result = {} as Pick<T, K>;
    keys.forEach(key => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  };

export const omit = <T, K extends keyof T>(keys: readonly K[]) => 
  (obj: T): Omit<T, K> => {
    const result = { ...obj } as Omit<T, K>;
    keys.forEach(key => {
      delete (result as any)[key];
    });
    return result;
  };

export const mapObject = <T, U>(mapper: Mapper<T, U>) => 
  <K extends string | number | symbol>(obj: Record<K, T>): Record<K, U> => {
    const result = {} as Record<K, U>;
    Object.entries(obj).forEach(([key, value]) => {
      result[key as K] = mapper(value as T);
    });
    return result;
  };

// Predicate combinators
export const and = <T>(...predicates: Predicate<T>[]): Predicate<T> => 
  (value: T) => predicates.every(p => p(value));

export const or = <T>(...predicates: Predicate<T>[]): Predicate<T> => 
  (value: T) => predicates.some(p => p(value));

export const not = <T>(predicate: Predicate<T>): Predicate<T> => 
  (value: T) => !predicate(value);

// Utility functions
export const identity = <T>(value: T): T => value;

export const constant = <T>(value: T) => (): T => value;

export const noop = (): void => {};

// Maybe/Optional utilities
export type Maybe<T> = T | null | undefined;

export const isSome = <T>(value: Maybe<T>): value is T => 
  value != null;

export const isNone = <T>(value: Maybe<T>): value is null | undefined => 
  value == null;

export const mapMaybe = <T, U>(
  value: Maybe<T>,
  mapper: Mapper<T, U>
): Maybe<U> => isSome(value) ? mapper(value) : value as any;

export const flatMapMaybe = <T, U>(
  value: Maybe<T>,
  mapper: (value: T) => Maybe<U>
): Maybe<U> => isSome(value) ? mapper(value) : value as any;

export const getOrElse = <T>(value: Maybe<T>, defaultValue: T): T => 
  isSome(value) ? value : defaultValue;

// Debounce and throttle utilities
export const debounce = <T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
) => {
  const state = { timeoutId: undefined as ReturnType<typeof setTimeout> | undefined };
  return (...args: T) => {
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }
    state.timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const throttle = <T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
) => {
  const state = { lastCall: 0 };
  return (...args: T) => {
    const now = Date.now();
    if (now - state.lastCall >= delay) {
      state.lastCall = now;
      fn(...args);
    }
  };
};

// Retry utility
export const retry = <T>(
  fn: () => Promise<T>,
  attempts: number,
  delay: number = 1000
): Promise<T> => {
  return fn().catch(async (error) => {
    if (attempts > 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retry(fn, attempts - 1, delay);
    }
    throw error;
  });
};

// Result-specific functional utilities
export const sequenceResults = <T, E>(
  results: Result<T, E>[]
): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      return result;
    }
  }
  return { ok: true, value: values };
};

export const traverseResults = <T, U, E>(
  array: T[],
  fn: (item: T) => Result<U, E>
): Result<U[], E> => {
  const results = array.map(fn);
  return sequenceResults(results);
};