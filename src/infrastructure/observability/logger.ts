export type LogContext = {
  request_id?: string;
  job_id?: string;
  repository?: string;
  source?: string;
  parser_version?: string;
  duration_ms?: number;
  status?: string;
  retry_count?: number;
  [key: string]: unknown;
};

function write(level: "info" | "warn" | "error", message: string, context: LogContext): void {
  const entry = { timestamp: new Date().toISOString(), level, message, ...context };
  const line = `${JSON.stringify(entry)}\n`;
  if (level === "error") process.stderr.write(line);
  else process.stdout.write(line);
}

export const logger = {
  info: (message: string, context: LogContext = {}) => write("info", message, context),
  warn: (message: string, context: LogContext = {}) => write("warn", message, context),
  error: (message: string, context: LogContext = {}) => write("error", message, context),
};
