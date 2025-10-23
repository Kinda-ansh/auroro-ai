import httpStatus from 'http-status';
import config from '../config';
import logger from '../core/logger';
import createResponse from '../utils/response';

/**
 * Custom error class for API errors.
 * Extends the built-in Error class.
 *
 * @class
 * @param {number} statusCode - The HTTP status code for the error.
 * @param {string} message - The error message.
 * @param {boolean} isOperational - Indicates if the error is operational (user-facing) or not.
 * @param {string} stack - Optional stack trace for the error.
 */
class ApiError extends Error {
  constructor(
    statusCode = httpStatus.INTERNAL_SERVER_ERROR,
    message = httpStatus[statusCode],
    isOperational = true,
    stack = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) this.stack = stack;
    else Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware to convert errors to ApiError if they are not already.
 *
 * @function
 * @param {Error} err - The error to convert.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The next middleware function.
 */
const errorConverter = (err, req, res, next) => {
  const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
  const message = err.message || httpStatus[statusCode];
  const error = !(err instanceof ApiError)
    ? new ApiError(statusCode, message, false, err.stack)
    : err;
  next(error);
};

/**
 * Middleware to handle errors.
 *
 * @function
 * @param {ApiError} err - The error to handle.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The next middleware function.
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = 'Internal Server Error';
  }

  res.locals.errorMessage = message;

  if (config.env === 'development') logger.error(err);

  createResponse({
    res,
    statusCode,
    status: false,
    message,
  });
};

export { ApiError, errorConverter, errorHandler };
