import { ErrorLog } from "../../../types";

const ERROR_LOGS_KEY = 'reicrew_error_logs_v1';
const REQUEST_STATS_KEY = 'reicrew_request_stats_v1';
const MAX_LOGS = 200;
const MAX_REQUEST_LOGS = 100;

type ErrorCategory = 'interview' | 'evaluation' | 'database' | 'system' | 'api' | 'proctoring';

type ErrorLevel = 'error' | 'warn' | 'info';

const getSessionId = (): string | undefined =>
  sessionStorage.getItem('current_session_id') || undefined;

export const ErrorLogService = {
  logEvent(
    category: ErrorCategory,
    message: string,
    details?: any,
    level: ErrorLevel = 'error',
    sessionId?: string,
    candidateName?: string
  ): void {
    try {
      const logsStr = localStorage.getItem(ERROR_LOGS_KEY);
      const logs: ErrorLog[] = logsStr ? JSON.parse(logsStr) : [];

      const newLog: ErrorLog = {
        id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        category,
        message: message || "Unknown error",
        details: details ? (typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)) : undefined,
        sessionId: sessionId || getSessionId(),
        candidateName: candidateName || undefined
      };

      logs.unshift(newLog);

      if (logs.length > MAX_LOGS) {
        logs.pop();
      }

      localStorage.setItem(ERROR_LOGS_KEY, JSON.stringify(logs));

      if (level === 'warn') {
        console.warn(`[ErrorLogService] [${category.toUpperCase()}] ${message}`, details);
      } else if (level === 'info') {
        console.info(`[ErrorLogService] [${category.toUpperCase()}] ${message}`, details);
      } else {
        console.error(`[ErrorLogService] [${category.toUpperCase()}] ${message}`, details);
      }
    } catch (e) {
      console.error("Failed to write to ErrorLogService:", e);
    }
  },

  logError(
    category: ErrorCategory,
    message: string,
    details?: any,
    sessionId?: string,
    candidateName?: string
  ): void {
    this.logEvent(category, message, details, 'error', sessionId, candidateName);
  },

  logWarning(
    category: ErrorCategory,
    message: string,
    details?: any,
    sessionId?: string,
    candidateName?: string
  ): void {
    this.logEvent(category, message, details, 'warn', sessionId, candidateName);
  },

  logInfo(
    category: ErrorCategory,
    message: string,
    details?: any,
    sessionId?: string,
    candidateName?: string
  ): void {
    this.logEvent(category, message, details, 'info', sessionId, candidateName);
  },

  getErrors(): ErrorLog[] {
    try {
      const logsStr = localStorage.getItem(ERROR_LOGS_KEY);
      return logsStr ? JSON.parse(logsStr) : [];
    } catch (e) {
      return [];
    }
  },

  clearErrors(): void {
    try {
      localStorage.removeItem(ERROR_LOGS_KEY);
    } catch (e) {
      console.error("Failed to clear ErrorLogService logs:", e);
    }
  },
// records every API call
logRequest(
  service: string,
  operation: string,
  durationMs: number,
  success: boolean,
  errorMessage?: string
): void {
  try {
    const statsStr = localStorage.getItem(REQUEST_STATS_KEY);
    const stats = statsStr ? JSON.parse(statsStr) : { total: 0, failed: 0, slowest: 0, log: [] };

    stats.total += 1;
    if (!success) stats.failed += 1;
    if (durationMs > stats.slowest) stats.slowest = durationMs;

    stats.log.unshift({
      service,
      operation,
      durationMs,
      success,
      errorMessage: errorMessage || null,
      timestamp: new Date().toISOString()
    });

    if (stats.log.length > MAX_REQUEST_LOGS) stats.log.pop();

    localStorage.setItem(REQUEST_STATS_KEY, JSON.stringify(stats));

    if (durationMs > 3000) {
      console.warn(`[SLOW REQUEST] ${service}.${operation} took ${durationMs}ms`);
    }
  } catch (e) {
    console.error("Failed to write request log:", e);
  }
},
//for summary
getRequestStats() {
  try {
    const statsStr = localStorage.getItem(REQUEST_STATS_KEY);
    return statsStr ? JSON.parse(statsStr) : null;
  } catch (e) {
    return null;
  }
},

clearRequestStats(): void {
  try {
    localStorage.removeItem(REQUEST_STATS_KEY);
  } catch (e) {
    console.error("Failed to clear request stats:", e);
  }
}
};
