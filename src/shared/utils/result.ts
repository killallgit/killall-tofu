/**
 * Result type utilities for functional error handling.
 * Implements a functional approach to error handling without exceptions.
 */

import { Result, AsyncResult } from '../types';

// Result constructors
export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Result type guards
export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } => 
  result.ok === true;

export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } => 
  result.ok === false;

// Result transformations
export const map = <T, U, E>(
  result: Result<T, E>,
  mapper: (value: T) => U
): Result<U, E> => {
  if (isOk(result)) {
    return Ok(mapper(result.value));
  }
  return result;
};

export const mapErr = <T, E, F>(
  result: Result<T, E>,
  mapper: (error: E) => F
): Result<T, F> => {
  if (isErr(result)) {
    return Err(mapper(result.error));
  }
  return result;
};

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  mapper: (value: T) => Result<U, E>
): Result<U, E> => {
  if (isOk(result)) {
    return mapper(result.value);
  }
  return result;
};

// Async Result transformations
export const mapAsync = async <T, U, E>(
  result: Result<T, E>,
  mapper: (value: T) => Promise<U>
): AsyncResult<U, E> => {
  if (isOk(result)) {
    return Ok(await mapper(result.value));
  }
  return result;
};

export const flatMapAsync = async <T, U, E>(
  result: Result<T, E>,
  mapper: (value: T) => AsyncResult<U, E>
): AsyncResult<U, E> => {
  if (isOk(result)) {
    return await mapper(result.value);
  }
  return result;
};

// Result unwrapping
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(`Called unwrap on Err: ${result.error}`);
};

export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
};

export const unwrapOrElse = <T, E>(
  result: Result<T, E>,
  defaultFn: (error: E) => T
): T => {
  if (isOk(result)) {
    return result.value;
  }
  return defaultFn(result.error);
};

// Result combining
export const combine = <T extends readonly unknown[], E>(
  results: { readonly [K in keyof T]: Result<T[K], E> }
): Result<T, E> => {
  const values = [] as unknown as T;
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (isErr(result)) {
      return result;
    }
    (values as unknown[])[i] = result.value;
  }
  
  return Ok(values);
};

export const combineObject = <T extends Record<string, unknown>, E>(
  results: { [K in keyof T]: Result<T[K], E> }
): Result<T, E> => {
  const values = {} as T;
  
  for (const key in results) {
    const result = results[key];
    if (isErr(result)) {
      return result;
    }
    values[key] = result.value;
  }
  
  return Ok(values);
};

// Helper for catching exceptions
export const tryCatch = <T>(fn: () => T): Result<T, Error> => {
  try {
    return Ok(fn());
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
};

export const tryCatchAsync = async <T>(
  fn: () => Promise<T>
): AsyncResult<T, Error> => {
  try {
    return Ok(await fn());
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
};

// Result filtering
export const filter = <T, E>(
  result: Result<T, E>,
  predicate: (value: T) => boolean,
  errorFn: () => E
): Result<T, E> => {
  if (isOk(result) && predicate(result.value)) {
    return result;
  }
  if (isOk(result)) {
    return Err(errorFn());
  }
  return result;
};

// Result matching (pattern matching)
export const match = <T, E, U>(
  result: Result<T, E>,
  patterns: {
    Ok: (value: T) => U;
    Err: (error: E) => U;
  }
): U => {
  if (isOk(result)) {
    return patterns.Ok(result.value);
  }
  return patterns.Err(result.error);
};

// Utility for converting nullable values to Results
export const fromNullable = <T>(
  value: T | null | undefined,
  error: Error = new Error('Value is null or undefined')
): Result<T, Error> => {
  if (value == null) {
    return Err(error);
  }
  return Ok(value);
};