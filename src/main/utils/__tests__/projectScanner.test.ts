import { promises as fs } from 'fs';

import { 
  findConfigFiles, 
  scanDirectory, 
  validateScanPaths, 
  createBatches,
  DEFAULT_EXCLUDE_PATTERNS 
} from '../projectScanner';

// Mock filesystem
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readdir: jest.fn()
  },
  constants: {
    R_OK: 4
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('projectScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DEFAULT_EXCLUDE_PATTERNS', () => {
    it('should include common patterns to exclude', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS).toContain('node_modules');
      expect(DEFAULT_EXCLUDE_PATTERNS).toContain('.git');
      expect(DEFAULT_EXCLUDE_PATTERNS).toContain('.terraform');
      expect(DEFAULT_EXCLUDE_PATTERNS).toContain('dist');
    });
  });

  describe('validateScanPaths', () => {
    it('should validate accessible paths', async () => {
      mockFs.access.mockResolvedValueOnce(undefined);
      
      const result = await validateScanPaths(['/valid/path']);
      
      expect(result.ok).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith('/valid/path', 4);
    });

    it('should reject inaccessible paths', async () => {
      mockFs.access.mockRejectedValueOnce(new Error('Access denied'));
      
      const result = await validateScanPaths(['/invalid/path']);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Scan path not accessible: /invalid/path');
      }
    });

    it('should validate multiple paths', async () => {
      mockFs.access
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      
      const result = await validateScanPaths(['/path1', '/path2']);
      
      expect(result.ok).toBe(true);
      expect(mockFs.access).toHaveBeenCalledTimes(2);
    });
  });

  describe('createBatches', () => {
    it('should create batches of correct size', () => {
      const items = [1, 2, 3, 4, 5, 6, 7];
      const batches = createBatches(items, 3);
      
      expect(batches).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7]
      ]);
    });

    it('should handle empty arrays', () => {
      const batches = createBatches([], 3);
      expect(batches).toEqual([]);
    });

    it('should handle single item', () => {
      const batches = createBatches([1], 3);
      expect(batches).toEqual([[1]]);
    });

    it('should handle batch size larger than array', () => {
      const batches = createBatches([1, 2], 5);
      expect(batches).toEqual([[1, 2]]);
    });
  });

  describe('findConfigFiles', () => {
    it('should find config files in directory', async () => {
      const mockEntries = [
        { name: '.killall.yaml', isFile: () => true, isDirectory: () => false },
        { name: 'other.txt', isFile: () => true, isDirectory: () => false }
      ];
      
      mockFs.readdir.mockResolvedValueOnce(mockEntries as any);
      
      const result = await findConfigFiles('/test/path', 1, []);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('/test/path/.killall.yaml');
      }
    });

    it('should exclude directories matching patterns', async () => {
      const mockEntries = [
        { name: '.killall.yaml', isFile: () => true, isDirectory: () => false },
        { name: 'node_modules', isFile: () => false, isDirectory: () => true }
      ];
      
      mockFs.readdir.mockResolvedValueOnce(mockEntries as any);
      
      const result = await findConfigFiles('/test/path', 1, ['node_modules']);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('/test/path/.killall.yaml');
      }
    });

    it('should handle directory read errors', async () => {
      mockFs.readdir.mockRejectedValueOnce(new Error('Permission denied'));
      
      const result = await findConfigFiles('/test/path', 1, []);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Directory scan failed');
      }
    });
  });
});