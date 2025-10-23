
import httpStatus from "../utils/httpStatus";
import createResponse from "../utils/response";

export const customHeaderAuth = (req, res, next) => {
    try {
        const apiKey = req.header('header-api-key');

        if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
            return createResponse({
                res,
                statusCode: httpStatus.FORBIDDEN,
                status: false,
                message: 'Forbidden: Invalid or missing API key',
            });
        }

        next();
    } catch (error) {
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            status: false,
            message: 'Middleware error',
            error: error.message,
        });
    }
};