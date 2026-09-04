interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
}

class Logger {
  private context: LogContext = {};

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  private formatLog(level: string, message: string, ctx?: LogContext): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(ctx || this.context ? { context: { ...this.context, ...ctx } } : {}),
    };
  }

  private output(entry: LogEntry): void {
    console.log(JSON.stringify(entry));
  }

  debug(message: string, context?: LogContext): void {
    this.output(this.formatLog('DEBUG', message, context));
  }

  info(message: string, context?: LogContext): void {
    this.output(this.formatLog('INFO', message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.output(this.formatLog('WARN', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const ctx = {
      ...context,
      ...(error instanceof Error && {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      }),
    };
    this.output(this.formatLog('ERROR', message, ctx));
  }
}

export const logger = new Logger();
