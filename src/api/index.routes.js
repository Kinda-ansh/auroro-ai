import express from 'express';
import createResponse from '../utils/response';
const router = express.Router();
import v1Routes from './v1/index.routes';
import httpStatus from '../utils/httpStatus';

/**
 * Root route that provides basic information about the application.
 */
router.get('/', (req, res) => {
  return createResponse({
    res,
    statusCode: httpStatus.OK,
    message: 'API is up and running',
    data: {
      name: 'Rahat Sewa API',
      version: '1.0.0',
    },
  });
});

/**
 * Router configuration.
 *
 * This router handles all routes for version 1 of the API.
 * Additional versions can be added similarly in the future.
 */

// Use the v1 routes for all endpoints starting with /v1
router.use('/v1', v1Routes);

/**
 * Middleware to handle 404 Not Found.
 */
router.use((req, res) => {
  createResponse({
    res,
    statusCode: httpStatus.NOT_FOUND,
    message: 'API endpoint not found',
  });
});

export default router;
