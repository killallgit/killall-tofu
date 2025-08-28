/**
 * Tests for Result type utilities
 */

import {
  Ok,
  Err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  mapAsync,
  flatMapAsync,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  combine,
  combineObject,
  tryCatch,
  tryCatchAsync,
  filter,
  match,
  fromNullable,
} from '../result';

describe('Result utilities', () => {
  describe('constructors', () => {
    it('should create Ok results', () => {
      const result = Ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('should create Err results', () => {
      const error = new Error('test error');
      const result = Err(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe('type guards', () => {
    it('should identify Ok results', () => {
      const result = Ok(42);
      expect(isOk(result)).toBe(true);
      expect(isErr(result)).toBe(false);
    });

    it('should identify Err results', () => {
      const result = Err(new Error('test'));
      expect(isOk(result)).toBe(false);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('transformations', () => {
    it('should map Ok values', () => {
      const result = Ok(5);
      const mapped = map(result, x => x * 2);
      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(10);
      }
    });

    it('should not map Err values', () => {
      const error = new Error('test');
      const result = Err(error);
      const mapped = map(result, x => x * 2);
      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error).toBe(error);
      }
    });

    it('should map errors', () => {
      const result = Err(new Error('original'));
      const mapped = mapErr(result, err => new Error('mapped: ' + err.message));
      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error.message).toBe('mapped: original');
      }
    });

    it('should flatMap Ok values', () => {
      const result = Ok(5);
      const mapped = flatMap(result, x => Ok(x * 2));
      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(10);
      }
    });

    it('should flatMap to Err', () => {
      const result = Ok(5);
      const error = new Error('flatMap error');
      const mapped = flatMap(result, () => Err(error));
      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error).toBe(error);
      }
    });
  });

  describe('async transformations', () => {
    it('should mapAsync Ok values', async () => {
      const result = Ok(5);
      const mapped = await mapAsync(result, async x => x * 2);
      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(10);
      }
    });

    it('should not mapAsync Err values', async () => {
      const error = new Error('test');
      const result = Err(error);
      const mapped = await mapAsync(result, async x => x * 2);
      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error).toBe(error);
      }
    });

    it('should flatMapAsync Ok values', async () => {
      const result = Ok(5);
      const mapped = await flatMapAsync(result, async x => Ok(x * 2));
      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(10);
      }
    });
  });

  describe('unwrapping', () => {
    it('should unwrap Ok values', () => {
      const result = Ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it('should throw when unwrapping Err values', () => {
      const result = Err(new Error('test'));
      expect(() => unwrap(result)).toThrow();
    });

    it('should unwrapOr with default for Err', () => {
      const result = Err(new Error('test'));
      expect(unwrapOr(result, 42)).toBe(42);
    });

    it('should unwrapOr without default for Ok', () => {
      const result = Ok(100);
      expect(unwrapOr(result, 42)).toBe(100);
    });

    it('should unwrapOrElse with function for Err', () => {
      const result = Err(new Error('test'));
      expect(unwrapOrElse(result, err => err.message.length)).toBe(4);
    });
  });

  describe('combining', () => {
    it('should combine all Ok results', () => {
      const results = [Ok(1), Ok(2), Ok(3)] as const;
      const combined = combine(results);
      expect(isOk(combined)).toBe(true);
      if (isOk(combined)) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it('should return first Err when combining', () => {
      const error1 = new Error('first');
      const error2 = new Error('second');
      const results = [Ok(1), Err(error1), Err(error2)] as const;
      const combined = combine(results);
      expect(isErr(combined)).toBe(true);
      if (isErr(combined)) {
        expect(combined.error).toBe(error1);
      }
    });

    it('should combine object results', () => {
      const results = { a: Ok(1), b: Ok(2), c: Ok(3) };
      const combined = combineObject(results);
      expect(isOk(combined)).toBe(true);
      if (isOk(combined)) {
        expect(combined.value).toEqual({ a: 1, b: 2, c: 3 });
      }
    });
  });

  describe('exception handling', () => {
    it('should catch exceptions with tryCatch', () => {
      const result = tryCatch(() => {
        throw new Error('test error');
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('test error');
      }
    });

    it('should return Ok for successful tryCatch', () => {
      const result = tryCatch(() => 42);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('should catch async exceptions', async () => {
      const result = await tryCatchAsync(async () => {
        throw new Error('async error');
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('async error');
      }
    });
  });

  describe('filtering', () => {
    it('should pass filter with Ok value', () => {
      const result = Ok(5);
      const filtered = filter(result, x => x > 0, () => new Error('negative'));
      expect(isOk(filtered)).toBe(true);
    });

    it('should fail filter with Ok value', () => {
      const result = Ok(-5);
      const filtered = filter(result, x => x > 0, () => new Error('negative'));
      expect(isErr(filtered)).toBe(true);
      if (isErr(filtered)) {
        expect(filtered.error.message).toBe('negative');
      }
    });

    it('should pass through Err values', () => {
      const error = new Error('original');
      const result = Err(error);
      const filtered = filter(result, x => true, () => new Error('filter'));
      expect(isErr(filtered)).toBe(true);
      if (isErr(filtered)) {
        expect(filtered.error).toBe(error);
      }
    });
  });

  describe('pattern matching', () => {
    it('should match Ok pattern', () => {
      const result = Ok(42);
      const matched = match(result, {
        Ok: value => value * 2,
        Err: () => 0,
      });
      expect(matched).toBe(84);
    });

    it('should match Err pattern', () => {
      const result = Err(new Error('test'));
      const matched = match(result, {
        Ok: () => 0,
        Err: error => error.message.length,
      });
      expect(matched).toBe(4);
    });
  });

  describe('nullable conversion', () => {
    it('should convert non-null value to Ok', () => {
      const result = fromNullable(42);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('should convert null to Err', () => {
      const result = fromNullable(null);
      expect(isErr(result)).toBe(true);
    });

    it('should convert undefined to Err', () => {
      const result = fromNullable(undefined);
      expect(isErr(result)).toBe(true);
    });

    it('should use custom error message', () => {
      const customError = new Error('custom message');
      const result = fromNullable(null, customError);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe(customError);
      }
    });
  });
});