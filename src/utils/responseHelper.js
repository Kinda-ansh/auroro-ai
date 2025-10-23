const sendResponse = (res, status, data) => {
  return res.status(status).json(data);
};

export const sendSuccessResponse = (
  res,
  data,
  totalCount,
  message,
  status = true,
  statusCode = 200
) => {
  const responseData = {
    status: status,
    ...(totalCount && { pagination: { totalCount } }),
    data,
    message: message || 'OK',
  };
  return sendResponse(res, statusCode, responseData);
};

export const sendSuccessMobileResponse = (res, message, data) => {
  const responseData = {
    status: true,
    message: message || 'OK',
    data,
  };
  return sendResponse(res, 200, responseData);
};
export const sendErrorResponse = (res, message, statusCode = 500) => {
  return sendResponse(res, statusCode, { message });
};

export const sendErrorMobileResponse = (
  res,
  data,
  message,
  statusCode = 500
) => {
  const responseData = {
    status: false,
    message: message || 'Something went wrong!!',
    data,
  };
  return sendResponse(res, statusCode, responseData);
};
