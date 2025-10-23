import httpStatus from 'http-status';
import createResponse from '../utils/response';
import User from '../services/user/user.model';
import Candidate from '../services/hrms/Candidate/Candidate.model';

// eslint-disable-next-line consistent-return
const sessionValidation = async (req, res, next) => {
  const platform =
    req.headers['device-platform'] || req.headers['Device-Platform'];

  req.platform = platform;
  if (platform === 'Android' || platform === 'iOS') {
    return next(); // Skip middleware for Android or iOS platforms
  }
  if (!req.session.userId) {
    return createResponse({
      res,
      statusCode: httpStatus.UNAUTHORIZED,
      status: false,
      message: 'Session has been expired, please login again',
    });
  }

  try {
    let user = await User.findById(req.session.userId);
    if (!user) {
      user = await Candidate.findById(req.session.userId);
    }
    if (!user) {
      if (!user) {
        req.session.destroy((err) => {
          if (err) return next(err);
          return createResponse({
            res,
            statusCode: httpStatus.UNAUTHORIZED,
            status: false,
            message: 'Session has been expired, please login again',
          });
        });
      }
    } else if (user.activeSessionId !== req.sessionID) {
      req.session.destroy((err) => {
        if (err) return next(err);
        return createResponse({
          res,
          statusCode: httpStatus.FORBIDDEN,
          status: false,
          message: 'Session has been expired, please login again',
        });
      });
    } else {
      next();
    }
  } catch (error) {
    return res.status(500).send('Session has been expired, please login again');
  }
};

export default sessionValidation;
