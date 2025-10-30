import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type LogLevel = 'info' | 'error';
export type LogContext = Record<string, unknown>;
export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
};

@Injectable({ providedIn: 'root' })
export class LoggingService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = environment.loggingApiUrl ?? '/api/logs';

  logInfo(message: string, context?: LogContext): void {
    this.append('info', message, context);
  }

  logError(message: string, errorOrContext?: unknown, maybeContext?: LogContext): void {
    let capturedError: unknown;
    let context: LogContext | undefined = undefined;

    if (maybeContext !== undefined) {
      capturedError = errorOrContext;
      context = maybeContext;
    } else if (errorOrContext instanceof Error || typeof errorOrContext === 'string') {
      capturedError = errorOrContext;
    } else if (errorOrContext && typeof errorOrContext === 'object') {
      context = errorOrContext as LogContext;
    }

    const payload = { ...(context ?? {}) } as LogContext;
    if (capturedError !== undefined) {
      payload['error'] = this.describeError(capturedError);
    }

    this.append('error', message, payload);
  }

  private append(level: LogLevel, message: string, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.normaliseContext(context),
    };

    this.http.post(this.endpoint, entry).subscribe({
      error: (err) => {
        console.error('Failed to persist log entry', err);
      },
    });
  }

  private normaliseContext(context?: LogContext): LogContext | undefined {
    if (!context) {
      return undefined;
    }

    const safe: LogContext = {};
    for (const [key, value] of Object.entries(context)) {
      safe[key] = this.serialiseValue(value);
    }

    return safe;
  }

  private serialiseValue(value: unknown): unknown {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    if (value && typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return String(value);
      }
    }

    if (typeof value === 'undefined') {
      return 'undefined';
    }

    return value;
  }

  private describeError(error: unknown): LogContext {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (typeof error === 'string') {
      return { message: error };
    }

    if (error && typeof error === 'object') {
      try {
        return { message: JSON.stringify(error) };
      } catch {
        return { message: String(error) };
      }
    }

    return { message: String(error) };
  }
}
