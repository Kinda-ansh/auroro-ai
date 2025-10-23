import httpStatus from 'http-status';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

import createResponse from '../../../utils/response';
import validateTime from '../../../utils/timeValidation';
import hashUtils from '../../../utils/hashHelper';
import jwtUtils from '../../../utils/jwtHelper';
import { getClientIp } from '../../../utils/ipUtil';
import sendEmail from '../../../utils/mailer';
import { miscellaneousUtils } from '../../../utils/miscellaneous';

import User from '../User/user.model';
import Player from './player.model';
import UserOtp from '../common/otp.model';
import CookieService from '../../../services/cookie.service';

import {
  signupValidation,
  loginPlayerValidation,
  verifyOtpValidation,
  changepasswordValidation,
  forgotPasswordValidation,
  changePasswordWithOtpValidation,
} from './player.validator';

const normalizeContact = (payload) => {
  const normalized = { ...payload };
  if (normalized.email) normalized.email = String(normalized.email).trim().toLowerCase();
  if (normalized.mobile) normalized.mobile = String(normalized.mobile).replace(/\D/g, '').slice(-10);
  if (normalized.name) normalized.name = String(normalized.name).trim();
  return normalized;
};

const signup = async (req, res) => {
  try {
    let payload = normalizeContact(req.body);
    await signupValidation.validate(payload, { abortEarly: false });

    const { email, mobile, name } = payload;

    const existing = await User.findOne({
      $or: [email ? { email } : null, mobile ? { mobile } : null].filter(Boolean),
    });
    if (existing) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'User with this email or mobile already exists',
      });
    }

    const userDoc = {
      name: name || '',
      email: email,

    };
    if (email) userDoc.email = email;
    if (mobile) userDoc.mobile = mobile;

    const user = await User.create(userDoc);

    await Player.create({ userId: user._id });

    await UserOtp.deleteMany({ $or: [email ? { email } : null, mobile ? { mobile } : null].filter(Boolean) });
    const otp = miscellaneousUtils.generateOTP(6);
    await UserOtp.create({ ...(email ? { email } : { mobile }), otp });

    if (email) {
      try {
        await sendEmail(email, name || 'Player', 'Your OTP Code', 'otp', {
          name: name || 'Player',
          otp,
          otpValidity: '5 minutes',
          otp1: otp,
        });
      } catch { }
    }

    return createResponse({
      res,
      statusCode: httpStatus.CREATED,
      status: true,
      message: 'Signup initiated. OTP sent to your contact.',
      data: { id: user._id, email: user.email, mobile: user.mobile },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: error.errors?.[0] || 'Validation error',
      });
    }
    if (error && error.code === 11000) {
      const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'field';
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already in use`,
      });
    }
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: error.message || 'Failed to signup',
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { emailOrMobile, otp } = req.body;
    await verifyOtpValidation.validate({ emailOrMobile, otp }, { abortEarly: false });

    const input = String(emailOrMobile).trim().toLowerCase();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const userQuery = isEmail ? { email: input } : { mobile: input };

    const otpDoc = await UserOtp.findOne({ ...userQuery, otp }).sort({ createdAt: -1 });
    if (!otpDoc) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Invalid OTP',
      });
    }

    const isValidTime = validateTime(new Date(otpDoc.createdAt), '5m');
    if (!isValidTime) {
      await UserOtp.deleteOne({ _id: otpDoc._id });
      return createResponse({
        res,
        statusCode: httpStatus.EXPECTATION_FAILED,
        status: false,
        message: 'OTP is expired',
      });
    }

    const user = await User.findOne(userQuery);
    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.NOT_FOUND,
        status: false,
        message: 'User not found',
      });
    }

    const token = uuidv4();
    const hashedToken = await hashUtils.hash(token);
    const verificationTokenExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    user.verificationToken = hashedToken;
    user.verificationTokenExpires = verificationTokenExpires;
    await user.save();

    await UserOtp.deleteOne({ _id: otpDoc._id });

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'OTP verified. You can now set your password.',
      data: { token, email: user.email, mobile: user.mobile },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: error.errors?.[0] || 'Validation error',
      });
    }
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: 'Failed to verify OTP',
    });
  }
};

const setPassword = async (req, res) => {
  try {
    const { emailOrMobile, token, password } = req.body;
    await changepasswordValidation.validate({ emailOrMobile, token, password }, { abortEarly: false });

    const input = String(emailOrMobile).trim().toLowerCase();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const userQuery = isEmail ? { email: input } : { mobile: input };

    const user = await User.findOne(userQuery);
    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.NOT_FOUND,
        status: false,
        message: 'User not found',
      });
    }

    if (!user.verificationToken || !user.verificationTokenExpires) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Verification not initiated',
      });
    }

    if (validateTime(user.verificationTokenExpires, 'past')) {
      user.verificationToken = '';
      user.verificationTokenExpires = '';
      await user.save();
      return createResponse({
        res,
        statusCode: httpStatus.EXPECTATION_FAILED,
        status: false,
        message: 'Verification token has expired, please retry',
      });
    }

    const isTokenValid = await hashUtils.compare(token, user.verificationToken);
    if (!isTokenValid) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Invalid verification token',
      });
    }

    const hashedPassword = await hashUtils.hash(password);
    user.password = hashedPassword;
    user.isActive = true;
    user.isMpinSet = true;
    user.emailVerified = user.email ? true : user.emailVerified;
    user.verificationToken = '';
    user.verificationTokenExpires = '';
    await user.save();

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Password set successfully. You can now login.',
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: error.errors?.[0] || 'Validation error',
      });
    }
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: 'Failed to set password',
    });
  }
};

const login = async (req, res) => {
  try {
    const { emailOrMobile, password } = req.body;
    await loginPlayerValidation.validate({ emailOrMobile, password }, { abortEarly: false });

    const input = String(emailOrMobile).trim().toLowerCase();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const userQuery = isEmail ? { email: input } : { mobile: input };

    const user = await User.findOne(userQuery);
    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        status: false,
        message: 'Invalid credentials',
      });
    }

    if (!user.password) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Please set your password first',
      });
    }

    const isPasswordMatch = await hashUtils.compare(password, user.password);
    if (!isPasswordMatch) {
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        status: false,
        message: 'Invalid credentials',
      });
    }

    const token = jwtUtils.generateToken({ id: user._id });
    user.token = token;

    req.session.userId = user._id.toString();
    const lastLoginDate = moment().format('DD MMM, YYYY HH:mm:ss');
    const clientIp = getClientIp(req);
    user.activeSessionId = req.sessionID;
    user.lastLogin = { date: lastLoginDate, ip: clientIp };
    await user.save();

    CookieService.setCookie(res, 'token', token, { maxAge: 1000 * 60 * 60 * 12 });

    const player = await Player.findOne({ userId: user._id });

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          picture: user.picture || '',
        },
        player,
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: error.errors?.[0] || 'Validation error',
      });
    }
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: 'Login failed',
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { emailOrMobile } = req.body;
    await forgotPasswordValidation.validate({ emailOrMobile }, { abortEarly: false });

    const input = String(emailOrMobile).trim().toLowerCase();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const userQuery = isEmail ? { email: input } : { mobile: input };

    const user = await User.findOne(userQuery);
    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.NOT_FOUND,
        status: false,
        message: 'User not found',
      });
    }

    await UserOtp.deleteMany(userQuery);
    const otp = miscellaneousUtils.generateOTP(6);
    await UserOtp.create({ ...userQuery, otp });

    if (isEmail) {
      try {
        await sendEmail(user.email, user.name || 'Player', 'Password Reset OTP', 'otp', {
          name: user.name || 'Player',
          otp,
          otpValidity: '5 minutes',
          otp1: otp,
        });
      } catch { }
    } else if (user.mobile) {
      try {
        await miscellaneousUtils.sendOtp(user.mobile, otp);
      } catch { }
    }

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'OTP sent successfully',
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: error.errors?.[0] || 'Validation error',
      });
    }
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: 'Failed to send OTP',
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { emailOrMobile, otp, newPassword } = req.body;
    await changePasswordWithOtpValidation.validate({ emailOrMobile, otp, newPassword }, { abortEarly: false });

    const input = String(emailOrMobile).trim().toLowerCase();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const userQuery = isEmail ? { email: input } : { mobile: input };

    const otpDoc = await UserOtp.findOne({ ...userQuery, otp }).sort({ createdAt: -1 });
    if (!otpDoc) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Invalid OTP',
      });
    }

    const isValidTime = validateTime(new Date(otpDoc.createdAt), '5m');
    if (!isValidTime) {
      await UserOtp.deleteOne({ _id: otpDoc._id });
      return createResponse({
        res,
        statusCode: httpStatus.EXPECTATION_FAILED,
        status: false,
        message: 'OTP is expired',
      });
    }

    const user = await User.findOne(userQuery);
    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.NOT_FOUND,
        status: false,
        message: 'User not found',
      });
    }

    const hashed = await hashUtils.hash(newPassword);
    user.password = hashed;
    user.isActive = true;
    user.isMpinSet = true;
    await user.save();

    await UserOtp.deleteOne({ _id: otpDoc._id });

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: error.errors?.[0] || 'Validation error',
      });
    }
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: 'Failed to change password',
    });
  }
};

export const playerController = {
  signup,
  verifyOtp,
  setPassword,
  login,
  forgotPassword,
  changePassword,
};
