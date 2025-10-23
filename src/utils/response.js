/**
 * Utility function to create a standardized response structure and send it.
 *
 * @param {Object} params - Parameters for the response.
 * @param {Response} params.res - The Express response object.
 * @param {number} params.statusCode - HTTP status code.
 * @param {string} params.message - Message to include in the response.
 * @param {Object} [params.data] - Data to include in the response (for successful responses).
 * @param {Object} [params.error] - Error details to include in the response (for error responses).
 * @param {Object} [params.meta] - Meta information to include in the response (pagination, etc.).
 *
 *
 * @example
 * import httpStatus from "utils/httpStatus";
 * import createResponse from "../utils/response.js";
 *
 * // Create a successful response
 * createResponse({
 *   res,
 *   statusCode: httpStatus.OK,
 *   status: true,
 *   message: "User created successfully",
 *   data: user,
 * });
 *
 * // Create an error response
 * createResponse({
 *   res,
 *   statusCode: httpStatus.INTERNAL_SERVER_ERROR,
 *   status: false,
 *   message: "Internal server error",
 *   error: error,
 * });
 *
 */
const createResponse = ({
  res,
  statusCode,
  status = false,
  message,
  data = null,
  error = null,
  meta = null,
}) => {
  const response = {
    code: statusCode,
    status,
    message,
  };

  if (data) {
    response.data = data;
  }

  if (error) {
    response.error = error;
  }

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

export default createResponse;
