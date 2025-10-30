import { setLogger, type LogEntry } from '@breeztech/breez-sdk-liquid/web';

// Log levels
export enum LogLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// Logger class for Breez SDK
class BreezLogger {
  log = (entry: LogEntry) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [Breez SDK] [${entry.level}]`;

    switch (entry.level.toUpperCase()) {
      case 'ERROR':
        console.error(`${prefix}:`, entry.line);
        break;
      case 'WARN':
        console.warn(`${prefix}:`, entry.line);
        break;
      case 'INFO':
        console.info(`${prefix}:`, entry.line);
        break;
      case 'DEBUG':
      case 'TRACE':
        console.debug(`${prefix}:`, entry.line);
        break;
      default:
        console.log(`${prefix}:`, entry.line);
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
  constructor(private tag: string) {}

  private format(level: string, ...args: any[]): any[] {
    const timestamp = new Date().toISOString();
    return [`[${timestamp}] [${this.tag}] [${level}]`, ...args];
  }

  trace(...args: any[]) {
    console.debug(...this.format('TRACE', ...args));
  }

  debug(...args: any[]) {
    console.debug(...this.format('DEBUG', ...args));
  }

  info(...args: any[]) {
    console.info(...this.format('INFO', ...args));
  }

  warn(...args: any[]) {
    console.warn(...this.format('WARN', ...args));
  }

  error(...args: any[]) {
    console.error(...this.format('ERROR', ...args));
  }

  log(...args: any[]) {
    console.log(...this.format('LOG', ...args));
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
