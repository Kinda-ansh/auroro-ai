import morgan from 'morgan';
import config from '../config';
import logger from './logger';

/**
 * Morgan token to extract error message from response locals
 */
morgan.token('message', (req, res) => res.locals.errorMessage || '');

/**
 * Function to get the IP format based on the environment
 * In production, it logs the remote address
 */
const getIpFormat = () =>
  config.env === 'production' ? ':remote-addr - ' : '';

/**
 * Format for logging successful responses
 * Includes IP (if in production), HTTP method, URL, status code, and response time
 */
const successResponseFormat = `${getIpFormat()}:method :url :status - :response-time ms`;

/**
 * Format for logging error responses
 * Includes IP (if in production), HTTP method, URL, status code, response time, and error message
 */
const errorResponseFormat = `${getIpFormat()}:method :url :status - :response-time ms - message: :message`;

/**
 * Morgan middleware for logging successful responses
 * Skips logging if the response status code is 400 or greater
 * Uses the info log level of the custom logger
 */
const successHandler = morgan(successResponseFormat, {
  skip: (req, res) => res.statusCode >= 400,
  stream: { write: (message) => logger.info(message.trim()) },
});

/**
 * Morgan middleware for logging error responses
 * Skips logging if the response status code is less than 400
 * Uses the error log level of the custom logger
 */
const errorHandler = morgan(errorResponseFormat, {
  skip: (req, res) => res.statusCode < 400,
  stream: { write: (message) => logger.error(message.trim()) },
});

/**
 * Exporting the success and error handlers
 */
export default { successHandler, errorHandler };
