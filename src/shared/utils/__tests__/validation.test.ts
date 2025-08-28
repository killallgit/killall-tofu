/**
 * Tests for validation utilities
 */

import {
  required,
  isString,
  isNumber,
  isBoolean,
  isArray,
  isObject,
  minLength,
  maxLength,
  minValue,
  maxValue,
  oneOf,
  matches,
  combine,
  optional,
  validateArray,
  isDuration,
  isValidPath,
  isValidTag,
  isValidProjectName,
  validateProjectConfig,
  validateExecutionConfig,
  validateHookConfig,
  ValidationError,
} from '../validation';
import { isOk, isErr } from '../result';

describe('Validation utilities', () => {
  describe('basic validators', () => {
    it('should validate required fields', () => {
      const validator = required('testField');
      
      expect(isOk(validator('value'))).toBe(true);
      expect(isErr(validator(null))).toBe(true);
      expect(isErr(validator(undefined))).toBe(true);
    });

    it('should validate strings', () => {
      const validator = isString('testField');
      
      expect(isOk(validator('test'))).toBe(true);
      expect(isErr(validator(123))).toBe(true);
      expect(isErr(validator(null))).toBe(true);
      expect(isErr(validator(undefined))).toBe(true);
    });

    it('should validate numbers', () => {
      const validator = isNumber('testField');
      
      expect(isOk(validator(123))).toBe(true);
      expect(isOk(validator(0))).toBe(true);
      expect(isOk(validator(-123))).toBe(true);
      expect(isErr(validator('123'))).toBe(true);
      expect(isErr(validator(NaN))).toBe(true);
      expect(isErr(validator(null))).toBe(true);
    });

    it('should validate booleans', () => {
      const validator = isBoolean('testField');
      
      expect(isOk(validator(true))).toBe(true);
      expect(isOk(validator(false))).toBe(true);
      expect(isErr(validator('true'))).toBe(true);
      expect(isErr(validator(1))).toBe(true);
      expect(isErr(validator(null))).toBe(true);
    });

    it('should validate arrays', () => {
      const validator = isArray('testField');
      
      expect(isOk(validator([]))).toBe(true);
      expect(isOk(validator([1, 2, 3]))).toBe(true);
      expect(isErr(validator('array'))).toBe(true);
      expect(isErr(validator({}))).toBe(true);
      expect(isErr(validator(null))).toBe(true);
    });

    it('should validate objects', () => {
      const validator = isObject('testField');
      
      expect(isOk(validator({}))).toBe(true);
      expect(isOk(validator({ key: 'value' }))).toBe(true);
      expect(isErr(validator(null))).toBe(true);
      expect(isErr(validator([]))).toBe(true);
      expect(isErr(validator('object'))).toBe(true);
    });
  });

  describe('constraint validators', () => {
    it('should validate minimum length', () => {
      const validator = minLength(3, 'testField');
      
      expect(isOk(validator('test'))).toBe(true);
      expect(isOk(validator('abc'))).toBe(true);
      expect(isErr(validator('ab'))).toBe(true);
      expect(isErr(validator(''))).toBe(true);
    });

    it('should validate maximum length', () => {
      const validator = maxLength(5, 'testField');
      
      expect(isOk(validator('test'))).toBe(true);
      expect(isOk(validator('hello'))).toBe(true);
      expect(isErr(validator('toolong'))).toBe(true);
    });

    it('should validate minimum value', () => {
      const validator = minValue(10, 'testField');
      
      expect(isOk(validator(15))).toBe(true);
      expect(isOk(validator(10))).toBe(true);
      expect(isErr(validator(5))).toBe(true);
    });

    it('should validate maximum value', () => {
      const validator = maxValue(100, 'testField');
      
      expect(isOk(validator(50))).toBe(true);
      expect(isOk(validator(100))).toBe(true);
      expect(isErr(validator(150))).toBe(true);
    });

    it('should validate oneOf values', () => {
      const validator = oneOf(['red', 'green', 'blue'], 'color');
      
      expect(isOk(validator('red'))).toBe(true);
      expect(isOk(validator('green'))).toBe(true);
      expect(isErr(validator('yellow'))).toBe(true);
      expect(isErr(validator(''))).toBe(true);
    });

    it('should validate regex patterns', () => {
      const validator = matches(/^[a-z]+$/, 'lowercase');
      
      expect(isOk(validator('hello'))).toBe(true);
      expect(isOk(validator('world'))).toBe(true);
      expect(isErr(validator('Hello'))).toBe(true);
      expect(isErr(validator('hello123'))).toBe(true);
    });
  });

  describe('validator combinators', () => {
    it('should combine multiple validators', () => {
      const validator = combine(
        isString('testField'),
        minLength(3, 'testField'),
        maxLength(10, 'testField')
      );

      expect(isOk(validator('hello'))).toBe(true);
      expect(isErr(validator('hi'))).toBe(true); // Too short
      expect(isErr(validator('verylongstring'))).toBe(true); // Too long
      expect(isErr(validator(123 as any))).toBe(true); // Not a string
    });

    it('should make validators optional', () => {
      const validator = optional(combine(
        isString('testField'),
        minLength(3, 'testField')
      ));

      expect(isOk(validator('hello'))).toBe(true);
      expect(isOk(validator(null))).toBe(true);
      expect(isOk(validator(undefined))).toBe(true);
      expect(isErr(validator('hi'))).toBe(true); // Too short
      expect(isErr(validator(123 as any))).toBe(true); // Not a string
    });

    it('should validate arrays with item validators', () => {
      const validator = validateArray(
        combine(isString('item'), minLength(2, 'item')),
        'items'
      );

      expect(isOk(validator(['hello', 'world']))).toBe(true);
      expect(isErr(validator(['hello', 'a']))).toBe(true); // 'a' too short
      expect(isErr(validator(['hello', 123 as any]))).toBe(true); // 123 not string
    });
  });

  describe('domain-specific validators', () => {
    it('should validate duration strings', () => {
      const validator = isDuration('timeout');
      
      expect(isOk(validator('1 hour'))).toBe(true);
      expect(isOk(validator('30 minutes'))).toBe(true);
      expect(isOk(validator('5s'))).toBe(true);
      expect(isErr(validator('invalid duration'))).toBe(true);
    });

    it('should validate paths', () => {
      const validator = isValidPath('path');
      
      expect(isOk(validator('/valid/path'))).toBe(true);
      expect(isOk(validator('./relative/path'))).toBe(true);
      expect(isErr(validator(''))).toBe(true);
    });

    it('should validate tags', () => {
      const validator = isValidTag('tag');
      
      expect(isOk(validator('valid-tag'))).toBe(true);
      expect(isOk(validator('tag_123'))).toBe(true);
      expect(isErr(validator('invalid tag'))).toBe(true); // Space
      expect(isErr(validator('invalid@tag'))).toBe(true); // Special char
      expect(isErr(validator(''))).toBe(true); // Empty
    });

    it('should validate project names', () => {
      const validator = isValidProjectName('name');
      
      expect(isOk(validator('valid-project'))).toBe(true);
      expect(isOk(validator('project.name'))).toBe(true);
      expect(isOk(validator('project_123'))).toBe(true);
      expect(isErr(validator('invalid project'))).toBe(true); // Space
      expect(isErr(validator('invalid@project'))).toBe(true); // Special char
    });
  });

  describe('configuration validators', () => {
    it('should validate valid project config', () => {
      const config = {
        version: 1,
        timeout: '1 hour',
        name: 'test-project',
        tags: ['test', 'development'],
        command: 'npm run destroy',
      };

      const result = validateProjectConfig(config);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.version).toBe(1);
        expect(result.value.timeout).toBe('1 hour');
        expect(result.value.name).toBe('test-project');
      }
    });

    it('should reject invalid project config', () => {
      const configs = [
        {}, // Missing required fields
        { version: 2, timeout: '1 hour' }, // Invalid version
        { version: 1, timeout: 'invalid' }, // Invalid timeout
        { version: 1, timeout: '1 hour', tags: ['invalid tag'] }, // Invalid tag
        { version: 1, timeout: '1 hour', name: 'invalid name' }, // Invalid name
      ];

      configs.forEach(config => {
        const result = validateProjectConfig(config);
        expect(isErr(result)).toBe(true);
      });
    });

    it('should validate execution config', () => {
      const config = {
        retries: 3,
        environment: { NODE_ENV: 'test' },
        workingDirectory: './project',
        shell: '/bin/bash',
      };

      const result = validateExecutionConfig(config);
      expect(isOk(result)).toBe(true);
    });

    it('should validate hook config', () => {
      const config = {
        beforeDestroy: ['echo "starting"'],
        afterDestroy: ['echo "completed"'],
        onFailure: ['echo "failed"'],
      };

      const result = validateHookConfig(config);
      expect(isOk(result)).toBe(true);
    });

    it('should reject invalid hook config', () => {
      const config = {
        beforeDestroy: [''], // Empty string not allowed
      };

      const result = validateHookConfig(config);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('ValidationError', () => {
    it('should create validation errors with field names', () => {
      const error = new ValidationError('Test message', 'testField');
      expect(error.message).toBe('Test message');
      expect(error.field).toBe('testField');
      expect(error.name).toBe('ValidationError');
    });

    it('should create validation errors without field names', () => {
      const error = new ValidationError('Test message');
      expect(error.message).toBe('Test message');
      expect(error.field).toBeUndefined();
    });
  });
});