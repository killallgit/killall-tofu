import {
  validateConfigObject,
  validateVersion,
  validateTimeout,
  validateName,
  validateCommand,
  validateTags,
  validateProjectConfig
} from '../configValidation';

// Mock dependencies
jest.mock('../durationParser', () => ({
  parseTimeoutDuration: jest.fn()
}));

jest.mock('../fileValidation', () => ({
  validatePath: jest.fn(),
  validateFileExists: jest.fn()
}));

import { parseTimeoutDuration } from '../durationParser';
import { validatePath, validateFileExists } from '../fileValidation';

const mockParseTimeoutDuration = parseTimeoutDuration as jest.MockedFunction<typeof parseTimeoutDuration>;
const mockValidatePath = validatePath as jest.MockedFunction<typeof validatePath>;
const mockValidateFileExists = validateFileExists as jest.MockedFunction<typeof validateFileExists>;

describe('configValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateConfigObject', () => {
    it('should accept valid object', () => {
      const config = { version: 1, timeout: '2 hours' };
      const result = validateConfigObject(config);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(config);
      }
    });

    it('should reject null/undefined', () => {
      expect(validateConfigObject(null).ok).toBe(false);
      expect(validateConfigObject(undefined).ok).toBe(false);
    });

    it('should reject arrays', () => {
      const result = validateConfigObject([1, 2, 3]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Configuration must be an object');
      }
    });

    it('should reject primitive types', () => {
      expect(validateConfigObject('string').ok).toBe(false);
      expect(validateConfigObject(123).ok).toBe(false);
      expect(validateConfigObject(true).ok).toBe(false);
    });
  });

  describe('validateVersion', () => {
    it('should accept version 1', () => {
      const result = validateVersion(1);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(1);
      }
    });

    it('should reject other versions', () => {
      expect(validateVersion(2).ok).toBe(false);
      expect(validateVersion(0).ok).toBe(false);
    });

    it('should reject non-number types', () => {
      expect(validateVersion('1').ok).toBe(false);
      expect(validateVersion(null).ok).toBe(false);
    });
  });

  describe('validateTimeout', () => {
    it('should validate timeout with successful parsing', () => {
      mockParseTimeoutDuration.mockReturnValueOnce({ ok: true, value: 3600000 });
      
      const result = validateTimeout('1 hour');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('1 hour');
      }
      expect(mockParseTimeoutDuration).toHaveBeenCalledWith('1 hour');
    });

    it('should reject timeout with failed parsing', () => {
      mockParseTimeoutDuration.mockReturnValueOnce({ 
        ok: false, 
        error: new Error('Invalid format') 
      });
      
      const result = validateTimeout('invalid');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Invalid format');
      }
    });

    it('should reject non-string timeout', () => {
      const result = validateTimeout(123);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Timeout must be a string');
      }
    });
  });

  describe('validateName', () => {
    it('should accept valid string name', () => {
      const result = validateName('My Project');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('My Project');
      }
    });

    it('should accept undefined name', () => {
      const result = validateName(undefined);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(undefined);
      }
    });

    it('should reject non-string name', () => {
      const result = validateName(123);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Name must be a string');
      }
    });
  });

  describe('validateCommand', () => {
    it('should accept valid string command', () => {
      const result = validateCommand('terraform destroy -auto-approve');
      expect(result.ok).toBe(true);
      expect(result.value).toBe('terraform destroy -auto-approve');
    });

    it('should accept undefined command', () => {
      const result = validateCommand(undefined);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(undefined);
    });

    it('should reject non-string command', () => {
      const result = validateCommand(['terraform', 'destroy']);
      expect(result.ok).toBe(false);
      expect(result.error?.message).toBe('Command must be a string');
    });
  });

  describe('validateTags', () => {
    it('should accept valid string array', () => {
      const tags = ['dev', 'test', 'temporary'];
      const result = validateTags(tags);
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(tags);
    });

    it('should accept undefined tags', () => {
      const result = validateTags(undefined);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(undefined);
    });

    it('should reject non-array tags', () => {
      const result = validateTags('not-array');
      expect(result.ok).toBe(false);
      expect(result.error?.message).toBe('Tags must be an array of strings');
    });

    it('should reject array with non-string elements', () => {
      const result = validateTags(['valid', 123, 'also-valid']);
      expect(result.ok).toBe(false);
      expect(result.error?.message).toBe('Tags must be an array of strings');
    });
  });

  describe('validateProjectConfig', () => {
    beforeEach(() => {
      // Setup default mocks for successful validation
      mockParseTimeoutDuration.mockReturnValue({ ok: true, value: 3600000 });
      mockValidatePath.mockReturnValue({ ok: true, value: undefined });
      mockValidateFileExists.mockResolvedValue({ ok: true, value: undefined });
    });

    it('should validate minimal valid config', async () => {
      const config = {
        version: 1,
        timeout: '2 hours'
      };
      
      const result = await validateProjectConfig(config, '/project/path');
      
      expect(result.ok).toBe(true);
      expect(result.value?.version).toBe(1);
      expect(result.value?.timeout).toBe('2 hours');
    });

    it('should validate full valid config', async () => {
      const config = {
        version: 1,
        timeout: '2 hours',
        name: 'Test Project',
        command: 'terraform destroy -auto-approve',
        tags: ['dev', 'test'],
        execution: {
          environment_variables: {
            AWS_PROFILE: 'dev'
          }
        },
        hooks: {
          before_destroy: ['echo "Starting destruction"']
        }
      };
      
      const result = await validateProjectConfig(config, '/project/path');
      
      expect(result.ok).toBe(true);
      expect(result.value?.name).toBe('Test Project');
      expect(result.value?.tags).toEqual(['dev', 'test']);
    });

    it('should reject config missing version', async () => {
      const config = { timeout: '2 hours' };
      
      const result = await validateProjectConfig(config, '/project/path');
      
      expect(result.ok).toBe(false);
    });

    it('should reject config missing timeout', async () => {
      const config = { version: 1 };
      
      const result = await validateProjectConfig(config, '/project/path');
      
      expect(result.ok).toBe(false);
    });

    it('should propagate validation errors from sub-validators', async () => {
      mockParseTimeoutDuration.mockReturnValue({ 
        ok: false, 
        error: new Error('Invalid timeout format') 
      });
      
      const config = {
        version: 1,
        timeout: 'invalid-timeout'
      };
      
      const result = await validateProjectConfig(config, '/project/path');
      
      expect(result.ok).toBe(false);
      expect(result.error?.message).toBe('Invalid timeout format');
    });
  });
});