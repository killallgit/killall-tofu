import { 
  calculateDestroyTime, 
  getProjectPath, 
  createProjectPathsSet 
} from '../configProcessor';

// Mock the duration parser
jest.mock('../../../shared/utils/duration', () => ({
  parseDuration: jest.fn()
}));

import { parseDuration } from '../../../shared/utils/duration';
const mockParseDuration = parseDuration as jest.MockedFunction<typeof parseDuration>;

describe('configProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateDestroyTime', () => {
    it('should calculate destroy time from valid duration', () => {
      const mockDuration = { 
        milliseconds: 2 * 60 * 60 * 1000,
        toString: () => '2h',
        toHours: () => 2,
        toDays: () => 0.083,
        add: jest.fn(),
        subtract: jest.fn(),
        multiply: jest.fn(),
        divide: jest.fn(),
        equals: jest.fn(),
        isGreaterThan: jest.fn(),
        isLessThan: jest.fn()
      };
      mockParseDuration.mockReturnValueOnce({ ok: true, value: mockDuration });
      
      const baseTime = new Date('2025-01-01T12:00:00Z');
      const result = calculateDestroyTime('2 hours', baseTime);
      
      expect(result).toEqual(new Date('2025-01-01T14:00:00Z'));
    });

    it('should fall back to 2 hours for invalid duration', () => {
      mockParseDuration.mockReturnValueOnce({ 
        ok: false, 
        error: new Error('Invalid duration') 
      });
      
      const baseTime = new Date('2025-01-01T12:00:00Z');
      const result = calculateDestroyTime('invalid', baseTime);
      
      expect(result).toEqual(new Date('2025-01-01T14:00:00Z'));
    });

    it('should handle different base times', () => {
      const mockDuration = { 
        milliseconds: 30 * 60 * 1000,
        toString: () => '30m',
        toHours: () => 0.5,
        toDays: () => 0.021,
        add: jest.fn(),
        subtract: jest.fn(),
        multiply: jest.fn(),
        divide: jest.fn(),
        equals: jest.fn(),
        isGreaterThan: jest.fn(),
        isLessThan: jest.fn()
      };
      mockParseDuration.mockReturnValueOnce({ ok: true, value: mockDuration });
      
      const baseTime = new Date('2025-01-01T10:30:00Z');
      const result = calculateDestroyTime('30 minutes', baseTime);
      
      expect(result).toEqual(new Date('2025-01-01T11:00:00Z'));
    });
  });

  describe('getProjectPath', () => {
    it('should extract directory from config file path', () => {
      const path = require('path');
      console.log('Debug: path.dirname directly:', path.dirname('/home/user/project/.killall.yaml'));
      console.log('Debug: getProjectPath function:', getProjectPath);
      const result = getProjectPath('/home/user/project/.killall.yaml');
      console.log('Debug: getProjectPath result:', result);
      expect(result).toBe('/home/user/project');
    });

    it('should handle nested paths', () => {
      const result = getProjectPath('/deep/nested/path/project/.killall.yaml');
      expect(result).toBe('/deep/nested/path/project');
    });

    it('should handle root directory', () => {
      const result = getProjectPath('/.killall.yaml');
      expect(result).toBe('/');
    });
  });

  describe('createProjectPathsSet', () => {
    it('should create set of project paths from config files', () => {
      const configFiles = [
        '/project1/.killall.yaml',
        '/project2/.killall.yaml',
        '/nested/project3/.killall.yaml'
      ];
      
      const result = createProjectPathsSet(configFiles);
      
      expect(result).toBeInstanceOf(Set);
      expect(result.has('/project1')).toBe(true);
      expect(result.has('/project2')).toBe(true);
      expect(result.has('/nested/project3')).toBe(true);
      expect(result.size).toBe(3);
    });

    it('should handle duplicate project paths', () => {
      const configFiles = [
        '/project/.killall.yaml',
        '/project/.killall.yaml'  // Duplicate
      ];
      
      const result = createProjectPathsSet(configFiles);
      
      expect(result.size).toBe(1);
      expect(result.has('/project')).toBe(true);
    });

    it('should handle empty array', () => {
      const result = createProjectPathsSet([]);
      expect(result.size).toBe(0);
    });
  });
});