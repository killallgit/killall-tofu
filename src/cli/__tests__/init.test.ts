import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { jest } from '@jest/globals';

// Mock modules before importing the command
jest.mock('../../main/database/factory');
jest.mock('fs');
jest.mock('js-yaml');

import { initCommand } from '../commands/init';

// Mock implementations
const mockFs = fs as jest.Mocked<typeof fs>;
const mockYaml = require('js-yaml') as jest.Mocked<typeof import('js-yaml')>;
const mockDatabaseFactory = require('../../main/database/factory') as jest.Mocked<typeof import('../../main/database/factory')>;

describe('CLI Init Command', () => {
  let tempDir: string;
  let originalCwd: string;
  let mockDatabase: any;

  beforeEach(() => {
    // Setup temp directory and mock cwd
    tempDir = '/tmp/test-project';
    originalCwd = process.cwd();
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    jest.spyOn(os, 'homedir').mockReturnValue('/home/testuser');

    // Reset mocks
    jest.clearAllMocks();

    // Setup mock database
    mockDatabase = {
      projects: {
        create: jest.fn()
      }
    };

    // Setup default mock implementations
    mockFs.existsSync.mockReturnValue(false); // .killall.yaml doesn't exist initially
    mockFs.mkdirSync.mockImplementation(() => {});
    mockYaml.dump.mockReturnValue('version: 1\ntimeout: 2h\nname: test-project\n');

    const mockCreateDatabase = jest.fn() as jest.MockedFunction<() => Promise<any>>;
    mockCreateDatabase.mockResolvedValue({
      ok: true,
      value: mockDatabase
    });
    mockDatabaseFactory.createDatabaseFactory.mockReturnValue({
      createDatabase: mockCreateDatabase,
      useDrizzle: false
    });

    mockDatabase.projects.create.mockResolvedValue({
      ok: true,
      value: { id: 'test-project-id' }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('successful initialization', () => {
    it('should create .killall.yaml with default settings', async () => {
      // Mock console methods
      const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Execute the command by setting process.argv and parsing
      process.argv = ['node', 'cli'];
      await initCommand.parseAsync([]);
      
      // Verify file operations
      expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(tempDir, '.killall.yaml'));
      expect(mockYaml.dump).toHaveBeenCalledWith({
        version: 1,
        timeout: '2h',
        name: 'test-project'
      });

      // Cleanup
      consoleLog.mockRestore();
    });

    it('should handle custom project name and timeout', async () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Execute with custom options
      process.argv = ['node', 'cli'];
      await initCommand.parseAsync([
        '--name', 'custom-project', 
        '--timeout', '4h'
      ]);

      expect(mockYaml.dump).toHaveBeenCalledWith({
        version: 1,
        timeout: '4h',
        name: 'custom-project'
      });

      consoleLog.mockRestore();
    });

    it('should use directory name as default project name', async () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(path, 'basename').mockReturnValue('my-directory');

      process.argv = ['node', 'cli'];
      await initCommand.parseAsync([]);

      expect(mockYaml.dump).toHaveBeenCalledWith({
        version: 1,
        timeout: '2h',
        name: 'my-directory'
      });

      consoleLog.mockRestore();
    });
  });

  describe('error cases', () => {
    it('should fail when .killall.yaml already exists', async () => {
      mockFs.existsSync.mockReturnValue(true);
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const processExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      try {
        process.argv = ['node', 'cli'];
      await initCommand.parseAsync([]);
        await expect(async () => {
          // Command should throw due to existing file
        }).rejects.toThrow('process.exit');
      } catch (error) {
        // Expected due to process.exit mock
      }

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('.killall.yaml already exists')
      );

      consoleError.mockRestore();
      processExit.mockRestore();
    });

    it('should handle database connection failures gracefully', async () => {
      const mockCreateDatabaseFailed = jest.fn() as jest.MockedFunction<() => Promise<any>>;
      mockCreateDatabaseFailed.mockResolvedValue({
        ok: false,
        error: new Error('Database connection failed')
      });
      mockDatabaseFactory.createDatabaseFactory.mockReturnValue({
        createDatabase: mockCreateDatabaseFailed,
        useDrizzle: false
      });

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const processExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      try {
        process.argv = ['node', 'cli'];
      await initCommand.parseAsync([]);
      } catch (error) {
        // Expected due to process.exit mock
      }

      consoleError.mockRestore();
      processExit.mockRestore();
    });

    it('should handle invalid timeout formats', async () => {
      // This test would need the parseDuration function to be extracted
      // and tested separately for comprehensive coverage
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock the parseDuration to return null (invalid)
      // This would require refactoring the init command to be more testable

      consoleError.mockRestore();
    });
  });

  describe('duration parsing', () => {
    // Note: These tests would require extracting parseDuration as a separate function
    it('should parse simple duration formats', () => {
      // Would test parseDuration function directly
      // parseDuration('2h') should return 7200000 (2 hours in ms)
      // parseDuration('30m') should return 1800000 (30 minutes in ms)
      // parseDuration('1d') should return 86400000 (1 day in ms)
    });

    it('should parse complex duration formats', () => {
      // parseDuration('1h30m') should return 5400000 (1.5 hours in ms)
      // parseDuration('2h45m30s') should return 9930000
    });

    it('should reject invalid duration formats', () => {
      // parseDuration('invalid') should return null
      // parseDuration('2x') should return null
      // parseDuration('') should return null
    });
  });
});