import { setLogger, type LogEntry } from '@breeztech/breez-sdk-liquid/web';
import { appendLog } from './logStorage';

// Log levels
export enum LogLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  LOG = 'LOG',
}

const PERSIST_LEVELS_PROD: LogLevel[] = [
  LogLevel.INFO,
  LogLevel.WARN,
  LogLevel.ERROR,
  LogLevel.LOG,
];

function shouldPersist(level: LogLevel): boolean {
  if (import.meta.env.PROD) {
    return PERSIST_LEVELS_PROD.includes(level);
  }
  return true;
}

// Logger class for Breez SDK
class BreezLogger {
  log = (entry: LogEntry) => {
    const timestamp = new Date().toISOString();
    const raw = entry.level.toUpperCase();
    const level = LogLevel[raw as keyof typeof LogLevel] ?? LogLevel.INFO;
    const prefix = `[${timestamp}] [Breez SDK] [${level}]`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(`${prefix}:`, entry.line);
        break;
      case LogLevel.WARN:
        console.warn(`${prefix}:`, entry.line);
        break;
      case LogLevel.INFO:
        console.info(`${prefix}:`, entry.line);
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        console.debug(`${prefix}:`, entry.line);
        break;
      default:
        console.log(`${prefix}:`, entry.line);
    }

    // Persist Breez log
    if (shouldPersist(level)) {
      void appendLog(`${prefix}: ${entry.line}`);
    }
  };
}

// Initialize Breez SDK logger
export const initBreezLogger = () => {
  const logger = new BreezLogger();
  setLogger(logger);
};

// Custom application logger with tags
export class Logger {
  constructor(private tag: string) { }

  private format(level: string, ...args: any[]): any[] {
    const timestamp = new Date().toISOString();
    return [`[${timestamp}] [${this.tag}] [${level}]`, ...args];
  }

  private persist(level: LogLevel, ...args: any[]) {
    if (!shouldPersist(level)) return;

    const [prefix, ...rest] = this.format(level, ...args);
    const line = `${prefix}: ${rest
      .map((arg) => {
        try {
          if (typeof arg === 'object' && arg !== null) {
            const serialized = JSON.stringify(arg);
            return serialized.length > 1000
              ? serialized.slice(0, 1000) + '...[truncated]'
              : serialized;
          }
          return String(arg);
        } catch {
          const type = Object.prototype.toString.call(arg);
          return `[unserializable ${type}]`;
        }
      })
      .join(' ')}`;

    void appendLog(line);
  }

  trace(...args: any[]) {
    console.debug(...this.format('TRACE', ...args));
    this.persist(LogLevel.TRACE, ...args);
  }

  debug(...args: any[]) {
    console.debug(...this.format('DEBUG', ...args));
    this.persist(LogLevel.DEBUG, ...args);
  }

  info(...args: any[]) {
    console.info(...this.format('INFO', ...args));
    this.persist(LogLevel.INFO, ...args);
  }

  warn(...args: any[]) {
    console.warn(...this.format('WARN', ...args));
    this.persist(LogLevel.WARN, ...args);
  }

  error(...args: any[]) {
    console.error(...this.format('ERROR', ...args));
    this.persist(LogLevel.ERROR, ...args);
  }

  log(...args: any[]) {
    console.log(...this.format('LOG', ...args));
    this.persist(LogLevel.LOG, ...args);
  }
}

// Create logger instances for different modules
export const createLogger = (tag: string): Logger => new Logger(tag);

// Pre-configured loggers
export const walletLogger = createLogger('Wallet');
export const sdkLogger = createLogger('SDK');
export const storageLogger = createLogger('Storage');
export const socketLogger = createLogger('Socket');
export const transactionLogger = createLogger('Transaction');
export const nostrLogger = createLogger('Nostr');
export const paymentLogger = createLogger('Payment');
export const lightningAddressLogger = createLogger('Lightning Address');
