/**
 * Logging utility using Winston for structured, production-ready logging.
 * Replaces console.log statements with proper logging levels and formatting.
 */

import * as path from 'path';

import { app } from 'electron';
import * as winston from 'winston';

// Determine if we're in the main or renderer process
const isMainProcess = typeof process !== 'undefined' && 
  process.type === 'browser';

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Get appropriate log directory
const getLogDirectory = (): string => {
  if (isMainProcess && app?.getPath) {
    return path.join(app.getPath('userData'), 'logs');
  }
  // Fallback for renderer process or when app is not available
  return path.join(process.cwd(), 'logs');
};

// Custom format for readable logs
const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const metaString = Object.keys(meta).length > 0 ? 
    `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${message}${metaString}`;
});

// Create logger configuration
const createLoggerConfig = (): winston.LoggerOptions => ({
  level: isDevelopment ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    customFormat
  ),
  transports: [
    // Console transport for development
    ...(isDevelopment ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          customFormat
        )
      })
    ] : []),
    
    // File transports for production
    new winston.transports.File({
      filename: path.join(getLogDirectory(), 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    new winston.transports.File({
      filename: path.join(getLogDirectory(), 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    })
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(getLogDirectory(), 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(getLogDirectory(), 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  ]
});

// Create the logger instance
const logger = winston.createLogger(createLoggerConfig());

// Functional logging interface
export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, error?: Error | unknown, meta?: Record<string, unknown>) => void;
  child: (meta: Record<string, unknown>) => Logger;
}

// Create functional logger wrapper
const createLogger = (baseLogger: winston.Logger, defaultMeta: Record<string, unknown> = {}): Logger => ({
  debug: (message: string, meta?: Record<string, unknown>) => {
    baseLogger.debug(message, { ...defaultMeta, ...meta });
  },
  
  info: (message: string, meta?: Record<string, unknown>) => {
    baseLogger.info(message, { ...defaultMeta, ...meta });
  },
  
  warn: (message: string, meta?: Record<string, unknown>) => {
    baseLogger.warn(message, { ...defaultMeta, ...meta });
  },
  
  error: (message: string, error?: Error | unknown, meta?: Record<string, unknown>) => {
    const errorMeta = error instanceof Error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    } : error ? { error } : {};
    
    baseLogger.error(message, { ...defaultMeta, ...errorMeta, ...meta });
  },
  
  child: (meta: Record<string, unknown>) => {
    return createLogger(baseLogger, { ...defaultMeta, ...meta });
  }
});

// Export the functional logger
export const log = createLogger(logger);

// Create specialized loggers for different services
export const createServiceLogger = (service: string): Logger => {
  return log.child({ service });
};

// Specific service loggers
export const mainLogger = createServiceLogger('main');
export const rendererLogger = createServiceLogger('renderer');
export const databaseLogger = createServiceLogger('database');
export const schedulerLogger = createServiceLogger('scheduler');
export const executorLogger = createServiceLogger('executor');
export const watcherLogger = createServiceLogger('watcher');
export const configLogger = createServiceLogger('config');
export const notifierLogger = createServiceLogger('notifier');

// Helper function to safely log objects
export const logObject = (obj: unknown): string => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
};

// Helper to create timed operations logger
export const createTimedOperation = (operation: string, logger: Logger = log) => {
  const startTime = Date.now();
  
  return {
    start: (meta?: Record<string, unknown>) => {
      logger.debug(`Starting ${operation}`, meta);
    },
    
    complete: (meta?: Record<string, unknown>) => {
      const duration = Date.now() - startTime;
      logger.info(`Completed ${operation}`, { duration, ...meta });
    },
    
    fail: (error: Error | unknown, meta?: Record<string, unknown>) => {
      const duration = Date.now() - startTime;
      logger.error(`Failed ${operation}`, error, { duration, ...meta });
    }
  };
};

// Export default logger
export default log;