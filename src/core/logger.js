import { createLogger, transports, format } from 'winston';
import path from 'path';
import { config } from 'process';

/**
 * Custom error format to include stack trace in the log message.
 * This format modifies the log info to append the error stack trace to the message.
 */
const enumerateErrorFormat = format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

/**
 * Winston logger configuration.
 * - Sets the logging level based on the environment (debug for development, info for production).
 * - Combines multiple formats: custom error format, timestamp, error stack inclusion, splat, and JSON.
 * - Default metadata includes the service name.
 * - Logs to files: one for errors and one for combined logs.
 * - In non-production environments, logs to the console with colorized output.
 */
const logger = createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: format.combine(
    enumerateErrorFormat(),
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    new transports.File({
      filename: path.join('log', 'error.log'),
      level: 'error',
    }),
    new transports.File({ filename: path.join('log', 'combined.log') }),
  ],
});

// If not in production, log to the console with colorized output
if (config.env !== 'production') {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    })
  );
}

export default logger;
