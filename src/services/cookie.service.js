/**
 * CookieService provides static methods to handle cookie operations in an Express.js application.
 * It includes methods for setting, getting, and clearing cookies with default options.
 *
 * @example
 * // Import the service in your Express application
 * import CookieService from './services/cookieService.js';
 *
 * // Setting a cookie
 * app.get('/set-cookie', (req, res) => {
 *   CookieService.setCookie(res, 'userToken', '12345', { maxAge: 1000 * 60 * 60 }); // 1 hour
 *   res.send('Cookie has been set');
 * });
 *
 * // Getting a cookie
 * app.get('/get-cookie', (req, res) => {
 *   const token = CookieService.getCookie(req, 'userToken');
 *   res.send(`Cookie value: ${token}`);
 * });
 *
 * // Clearing a cookie
 * app.get('/clear-cookie', (req, res) => {
 *   CookieService.clearCookie(res, 'userToken');
 *   res.send('Cookie has been cleared');
 * });
 */
export default class CookieService {
  /**
   * Set a cookie in the response.
   *
   * @param {Object} res - The Express.js response object.
   * @param {string} name - The name of the cookie.
   * @param {string} value - The value of the cookie.
   * @param {Object} [options={}] - Optional settings for the cookie (e.g., maxAge, path).
   *
   * @example
   * CookieService.setCookie(res, 'sessionId', 'abc123', { maxAge: 1000 * 60 * 15 }); // 15 minutes
   */
  static setCookie(res, name, value, options = {}) {
    const defaultOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      ...options,
    };
    res.cookie(name, value, defaultOptions);
  }

  /**
   * Get a cookie from the request.
   *
   * @param {Object} req - The Express.js request object.
   * @param {string} name - The name of the cookie to retrieve.
   * @returns {string|undefined} - The value of the cookie, or undefined if the cookie does not exist.
   *
   * @example
   * const sessionId = CookieService.getCookie(req, 'sessionId');
   *
   */
  static getCookie(req, name) {
    return req.cookies[name];
  }

  /**
   * Clear a cookie from the response.
   *
   * @param {Object} res - The Express.js response object.
   * @param {string} name - The name of the cookie to clear.
   * @param {Object} [options={}] - Optional settings for clearing the cookie (e.g., path).
   *
   * @example
   * CookieService.clearCookie(res, 'sessionId');
   */
  static clearCookie(res, name, options = {}) {
    const defaultOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      ...options,
    };
    res.clearCookie(name, defaultOptions);
  }
}
