import { promises as fs } from 'fs';

import {
  validateFileExists,
  validatePath,
  readFileContent
} from '../fileValidation';

// Mock filesystem
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn()
  },
  constants: {
    R_OK: 4
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('fileValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateFileExists', () => {
    it('should return success for accessible file', async () => {
      mockFs.access.mockResolvedValueOnce(undefined);
      
      const result = await validateFileExists('/valid/file.txt');
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(undefined);
      expect(mockFs.access).toHaveBeenCalledWith('/valid/file.txt', 4);
    });

    it('should return error for inaccessible file', async () => {
      mockFs.access.mockRejectedValueOnce(new Error('File not found'));
      
      const result = await validateFileExists('/invalid/file.txt');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('File not accessible: /invalid/file.txt');
      }
    });
  });

  describe('validatePath', () => {
    it('should accept safe paths within project', () => {
      const result = validatePath('config.yaml', '/home/project');
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(undefined);
    });

    it('should accept nested paths within project', () => {
      const result = validatePath('subdir/config.yaml', '/home/project');
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(undefined);
    });

    it('should reject directory traversal attempts', () => {
      const result = validatePath('../../../etc/passwd', '/home/project');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Path traversal detected: ../../../etc/passwd');
      }
    });

    it('should reject absolute paths outside project', () => {
      const result = validatePath('/etc/passwd', '/home/project');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Path traversal detected: /etc/passwd');
      }
    });

    it('should accept exact project root', () => {
      const result = validatePath('.', '/home/project');
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(undefined);
    });
  });

  describe('readFileContent', () => {
    it('should read file content successfully', async () => {
      const mockContent = 'file content here';
      mockFs.readFile.mockResolvedValueOnce(mockContent);
      
      const result = await readFileContent('/path/to/file.txt');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(mockContent);
      }
      expect(mockFs.readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf8');
    });

    it('should handle file read errors', async () => {
      const error = new Error('Permission denied');
      mockFs.readFile.mockRejectedValueOnce(error);
      
      const result = await readFileContent('/path/to/file.txt');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to read file: Permission denied');
      }
    });

    it('should handle non-Error exceptions', async () => {
      mockFs.readFile.mockRejectedValueOnce('string error');
      
      const result = await readFileContent('/path/to/file.txt');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Failed to read file: Unknown error');
      }
    });
  });
});