import rateLimit from 'express-rate-limit';

/**
 * Rate limiter middleware configuration.
 *
 * This middleware limits the number of requests that can be made to the server
 * from a single IP address within a specified time window.
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100000, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.', // Custom message to send when rate limit is exceeded
  headers: true, // Include rate limit info in the response headers
  skipSuccessfulRequests: false, // Count successful requests toward the rate limit
});

const formatWindowMs = (windowMs) => {
  const minutes = Math.floor(windowMs / 60000);
  const seconds = Math.floor((windowMs % 60000) / 1000);

  return minutes > 0
    ? `${minutes} minute${minutes > 1 ? 's' : ''}`
    : `${seconds} second${seconds > 1 ? 's' : ''}`;
};

export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 100,
  headers = true,
  skipSuccessfulRequests = false,
} = {}) => {
  // Use the helper function to format the time window
  const timeWindow = formatWindowMs(windowMs);

  // Create the dynamic message
  const message = `Too many requests from this IP, please try again after ${timeWindow}.`;

  return rateLimit({
    windowMs, // Time window in milliseconds
    max, // Maximum number of requests per windowMs
    message, // Dynamic message based on the time window
    headers, // Include rate limit info in response headers
    skipSuccessfulRequests, // Count successful requests toward the rate limit
  });
};

/**
 * Export the configured rate limiter middleware.
 */
export default rateLimiter;
