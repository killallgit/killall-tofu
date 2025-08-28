// Configuration validator tests
// Tests YAML parsing, duration parsing, path validation, and security checks

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { parseDuration, validatePath, validateConfig, parseConfigFile, ConfigValidationError } from '../configValidator';

describe('parseDuration', () => {
  it('should parse valid duration strings correctly', () => {
    const testCases = [
      ['1 second', 1000],
      ['30 seconds', 30000],
      ['1 minute', 60000],
      ['5 minutes', 300000],
      ['1 hour', 3600000],
      ['2 hours', 7200000],
      ['1 day', 86400000],
      ['2 days', 172800000],
      // Test abbreviations
      ['1s', 1000],
      ['1m', 60000],
      ['1h', 3600000],
      ['1d', 86400000],
    ];

    testCases.forEach(([input, expected]) => {
      const result = parseDuration(input as string);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(expected);
      }
    });
  });

  it('should reject invalid duration strings', () => {
    const invalidCases = [
      '',
      'invalid',
      '1 invalidunit',
      '0 hours',
      '-1 hours',
      '31 days', // Too long
    ];

    invalidCases.forEach((input) => {
      const result = parseDuration(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ConfigValidationError);
      }
    });
  });

  it('should handle edge cases', () => {
    // Minimum valid duration
    const minResult = parseDuration('1 second');
    expect(minResult.ok).toBe(true);

    // Maximum valid duration  
    const maxResult = parseDuration('30 days');
    expect(maxResult.ok).toBe(true);

    // Case insensitive
    const caseResult = parseDuration('2 HOURS');
    expect(caseResult.ok).toBe(true);
    if (caseResult.ok) {
      expect(caseResult.value).toBe(7200000);
    }
  });
});

describe('validatePath', () => {
  const basePath = '/home/user/project';

  it('should accept valid paths within base directory', () => {
    const validPaths = [
      '.',
      './terraform',
      'terraform',
      'terraform/main.tf',
      'subdir/terraform',
    ];

    validPaths.forEach((testPath) => {
      const result = validatePath(testPath, basePath);
      expect(result.ok).toBe(true);
    });
  });

  it('should reject path traversal attempts', () => {
    const maliciousPaths = [
      '../',
      '../../etc/passwd',
      '../../../root',
      '/etc/passwd',
      'terraform/../../../etc/passwd',
    ];

    maliciousPaths.forEach((testPath) => {
      const result = validatePath(testPath, basePath);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ConfigValidationError);
        expect(result.error.message).toContain('Path traversal detected');
      }
    });
  });

  it('should handle empty or invalid inputs', () => {
    expect(validatePath('', basePath).ok).toBe(false);
    expect(validatePath(null as any, basePath).ok).toBe(false);
    expect(validatePath(undefined as any, basePath).ok).toBe(false);
  });
});

describe('validateConfig', () => {
  let testProjectPath: string;
  
  beforeEach(async () => {
    // Create temp directory for testing
    const randomId = Math.random().toString(36).substring(2, 15);
    testProjectPath = path.join(os.tmpdir(), `validate-test-${randomId}`);
    await fs.mkdir(testProjectPath, { recursive: true });
  });

  it('should validate minimal valid configuration', async () => {
    const config = {
      version: 1,
      timeout: '2 hours',
    };

    const result = await validateConfig(config, testProjectPath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.version).toBe(1);
      expect(result.value.timeout).toBe('2 hours');
    }
  });

  it('should validate complete configuration', async () => {
    const config = {
      version: 1,
      timeout: '2 hours',
      name: 'Test Project',
      command: 'terraform destroy -auto-approve',
      tags: ['test', 'development'],
      execution: {
        workingDirectory: '.',
        environment: {
          TF_VAR_env: 'test',
          AWS_REGION: 'us-west-2',
        },
      },
      hooks: {
        before_destroy: ['terraform plan -destroy'],
        after_destroy: ['echo "Destroyed"'],
      },
    };

    const result = await validateConfig(config, testProjectPath);
    if (!result.ok) {
      console.log('Validation failed:', result.error);
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Test Project');
      expect(result.value.command).toBe('terraform destroy -auto-approve');
      expect(result.value.tags).toEqual(['test', 'development']);
      expect(result.value.execution?.workingDir).toBe('.');
      expect(result.value.execution?.environment).toEqual({
        TF_VAR_env: 'test',
        AWS_REGION: 'us-west-2',
      });
    }
  });

  it('should reject invalid configurations', async () => {
    const invalidConfigs = [
      // Not an object
      null,
      'string',
      123,
      [],
      
      // Missing version
      { timeout: '2 hours' },
      
      // Invalid version
      { version: 2, timeout: '2 hours' },
      { version: '1', timeout: '2 hours' },
      
      // Missing timeout
      { version: 1 },
      
      // Invalid timeout
      { version: 1, timeout: 123 },
      { version: 1, timeout: 'invalid' },
      
      // Invalid types
      { version: 1, timeout: '2 hours', name: 123 },
      { version: 1, timeout: '2 hours', command: [] },
      { version: 1, timeout: '2 hours', tags: 'string' },
      { version: 1, timeout: '2 hours', tags: [123] },
    ];

    for (const config of invalidConfigs) {
      const result = await validateConfig(config, testProjectPath);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ConfigValidationError);
      }
    }
  });

  it('should validate execution section properly', async () => {
    // Invalid execution section
    const invalidExecution = {
      version: 1,
      timeout: '2 hours',
      execution: 'string', // Should be object
    };

    const result1 = await validateConfig(invalidExecution, testProjectPath);
    expect(result1.ok).toBe(false);

    // Invalid environment variables
    const invalidEnv = {
      version: 1,
      timeout: '2 hours',
      execution: {
        environment_variables: {
          VALID_VAR: 'value',
          INVALID_VAR: 123, // Should be string
        },
      },
    };

    const result2 = await validateConfig(invalidEnv, testProjectPath);
    expect(result2.ok).toBe(false);
  });

  it('should validate hooks section properly', async () => {
    // Invalid hooks structure
    const invalidHooks = {
      version: 1,
      timeout: '2 hours',
      hooks: 'string', // Should be object
    };

    const result1 = await validateConfig(invalidHooks, testProjectPath);
    expect(result1.ok).toBe(false);

    // Unknown hook
    const unknownHook = {
      version: 1,
      timeout: '2 hours',
      hooks: {
        unknown_hook: ['echo "test"'],
      },
    };

    const result2 = await validateConfig(unknownHook, testProjectPath);
    expect(result2.ok).toBe(false);

    // Invalid hook commands
    const invalidHookCommands = {
      version: 1,
      timeout: '2 hours',
      hooks: {
        before_destroy: 'string', // Should be array
      },
    };

    const result3 = await validateConfig(invalidHookCommands, testProjectPath);
    expect(result3.ok).toBe(false);
  });
});

describe('parseConfigFile', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory manually as fs.mkdtemp may not be available in Jest
    const randomId = Math.random().toString(36).substring(2, 15);
    tempDir = path.join(os.tmpdir(), `config-test-${randomId}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory - try-catch in case it doesn't exist
    try {
      // Use a more compatible approach for cleanup
      if (tempDir) {
        // We'll just leave it for OS cleanup or use a different approach
        // Since fs methods are limited in Jest environment
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should parse valid YAML configuration file', async () => {
    const configPath = path.join(tempDir, '.killall.yaml');
    const configContent = `
version: 1
timeout: "2 hours"
name: "Test Project"
command: "terraform destroy -auto-approve"
tags:
  - "test"
  - "development"
execution:
  working_directory: "."
  environment_variables:
    TF_VAR_env: "test"
hooks:
  before_destroy:
    - "terraform plan -destroy"
  after_destroy:
    - "echo 'Destroyed'"
`;

    await fs.writeFile(configPath, configContent);

    const result = await parseConfigFile(configPath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.version).toBe(1);
      expect(result.value.timeout).toBe('2 hours');
      expect(result.value.name).toBe('Test Project');
    }
  });

  it('should handle YAML parsing errors', async () => {
    const configPath = path.join(tempDir, '.killall.yaml');
    const invalidYaml = `
version: 1
timeout: "2 hours"
invalid_yaml: [unclosed array
`;

    await fs.writeFile(configPath, invalidYaml);

    const result = await parseConfigFile(configPath);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConfigValidationError);
      expect(result.error.message).toContain('YAML parsing failed');
    }
  });

  it('should handle file read errors', async () => {
    const nonExistentPath = path.join(tempDir, 'nonexistent.yaml');

    const result = await parseConfigFile(nonExistentPath);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConfigValidationError);
      expect(result.error.message).toContain('Failed to read configuration file');
    }
  });

  it('should validate configuration content', async () => {
    const configPath = path.join(tempDir, '.killall.yaml');
    const invalidConfig = `
version: 2
timeout: "invalid duration"
`;

    await fs.writeFile(configPath, invalidConfig);

    const result = await parseConfigFile(configPath);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConfigValidationError);
    }
  });
});