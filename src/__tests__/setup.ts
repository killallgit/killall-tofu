/**
 * Jest test environment setup
 * This file runs before all tests to configure the testing environment
 */

// Mock Electron APIs for testing
const mockElectron = {
  app: {
    getPath: jest.fn(() => '/tmp/test'),
    quit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn(),
    },
    show: jest.fn(),
    close: jest.fn(),
  })),
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  ipcRenderer: {
    send: jest.fn(),
    on: jest.fn(),
    invoke: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  dialog: {
    showMessageBox: jest.fn(),
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
    openPath: jest.fn(),
  },
};

// Mock electron module
jest.mock('electron', () => mockElectron);

// Mock Node.js built-in modules commonly used in the app
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn(),
  unlink: jest.fn(),
  rmdir: jest.fn(),
}));

jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => '/' + args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/') || '/'),
  basename: jest.fn((path) => path.split('/').pop() || ''),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  }),
}));

jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/test'),
  tmpdir: jest.fn(() => '/tmp'),
  platform: jest.fn(() => 'linux'),
  cpus: jest.fn(() => [{ model: 'Test CPU' }]),
}));

// Mock file system watching
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn(),
    add: jest.fn(),
    unwatch: jest.fn(),
  })),
}));

// Mock database
jest.mock('sqlite3', () => ({
  Database: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    prepare: jest.fn(() => ({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
      finalize: jest.fn(),
    })),
  })),
}));

// Mock YAML parsing
jest.mock('js-yaml', () => ({
  load: jest.fn(),
  dump: jest.fn(),
}));

// Mock logging
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
    json: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Global test utilities
global.testUtils = {
  // Create a timeout promise for async testing
  timeout: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock date for consistent testing
  mockDate: (date: Date) => {
    jest.useFakeTimers();
    jest.setSystemTime(date);
  },
  
  // Restore real timers
  restoreDate: () => {
    jest.useRealTimers();
  },
  
  // Helper to create temporary test data
  createTempPath: (name: string) => `/tmp/test/${name}`,
  
  // Mock environment variables
  mockEnv: (vars: Record<string, string>) => {
    const originalEnv = process.env;
    process.env = { ...originalEnv, ...vars };
    return () => {
      process.env = originalEnv;
    };
  },
};

// Suppress console.warn/error in tests unless explicitly enabled
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

if (!process.env.TEST_VERBOSE) {
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Clean up after tests
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Restore console methods after all tests
afterAll(() => {
  if (!process.env.TEST_VERBOSE) {
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  }
});

// Type declarations for global utilities
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        timeout: (ms: number) => Promise<void>;
        mockDate: (date: Date) => void;
        restoreDate: () => void;
        createTempPath: (name: string) => string;
        mockEnv: (vars: Record<string, string>) => () => void;
      };
    }
  }
}