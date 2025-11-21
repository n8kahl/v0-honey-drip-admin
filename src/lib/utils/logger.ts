/**
 * Structured Logging Utility
 *
 * Provides consistent logging with:
 * - Log levels (debug, info, warn, error)
 * - Environment-based filtering
 * - Structured data logging
 * - Performance-friendly in production
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get the minimum log level from environment
 * Production: warn (only warnings and errors)
 * Development: debug (all logs)
 */
function getMinLogLevel(): LogLevel {
  const envLevel = (import.meta as any)?.env?.VITE_LOG_LEVEL as LogLevel | undefined;

  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel;
  }

  // Default: warn in production, debug in development
  const isProd = (import.meta as any)?.env?.PROD === true;
  return isProd ? 'warn' : 'debug';
}

const MIN_LOG_LEVEL = getMinLogLevel();
const MIN_LOG_LEVEL_VALUE = LOG_LEVELS[MIN_LOG_LEVEL];

/**
 * Check if a log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= MIN_LOG_LEVEL_VALUE;
}

/**
 * Format log message with timestamp and context
 */
function formatMessage(level: LogLevel, context: string, message: string, data?: any): string {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);

  let formatted = `[${timestamp}] ${levelStr} [${context}] ${message}`;

  if (data !== undefined) {
    formatted += ` ${JSON.stringify(data)}`;
  }

  return formatted;
}

/**
 * Structured logger interface
 */
export interface Logger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, data?: any): void;
}

/**
 * Create a logger for a specific context/component
 *
 * @param context - Context identifier (e.g., 'marketDataStore', 'HDLiveChart')
 * @returns Logger instance with level-specific methods
 *
 * @example
 * const logger = createLogger('marketDataStore');
 * logger.info('Initializing', { symbols: ['SPY', 'QQQ'] });
 * logger.error('Failed to connect', { error: err.message });
 */
export function createLogger(context: string): Logger {
  return {
    debug: (message: string, data?: any) => {
      if (shouldLog('debug')) {
        console.debug(formatMessage('debug', context, message, data));
      }
    },

    info: (message: string, data?: any) => {
      if (shouldLog('info')) {
        console.info(formatMessage('info', context, message, data));
      }
    },

    warn: (message: string, data?: any) => {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', context, message, data));
      }
    },

    error: (message: string, data?: any) => {
      if (shouldLog('error')) {
        console.error(formatMessage('error', context, message, data));
      }
    },
  };
}

/**
 * Default logger for general use
 * For component-specific logging, use createLogger() instead
 */
export const logger = createLogger('app');

/**
 * Convenience function for performance logging
 *
 * @example
 * const end = logger.time('fetchData');
 * // ... do work ...
 * end(); // Logs duration
 */
export function logPerformance(context: string, operation: string): () => void {
  const start = performance.now();
  const log = createLogger(context);

  return () => {
    const duration = performance.now() - start;
    log.debug(`${operation} completed`, { durationMs: duration.toFixed(2) });
  };
}
