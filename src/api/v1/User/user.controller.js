//libs
import httpStatus from 'http-status';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import moment from 'moment';
import config from '../../../config';
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(config.googleClientId);

//utilities
import createResponse from '../../../utils/response';
import {
  extractCommonQueryParams,
  extractQueryParams,
} from '../../../utils/requestHelper';
import validateTime from '../../../utils/timeValidation';
import hashUtils from '../../../utils/hashHelper';
import jwtUtils from '../../../utils/jwtHelper';
import { getClientIp } from '../../../utils/ipUtil';
import sendEmail from '../../../utils/mailer';
import aesUtils from '../../../utils/cryptoHash';
import { miscellaneousUtils } from '../../../utils/miscellaneous';
import { getCommonSearchConditionForMasters } from '../../../utils/commonHelper';

//models
import User from './user.model';
import UserOtp from '../common/otp.model';

//misc
import {
  changepasswordValidation,
  createUserValidation,
  forgotPasswordUserValidation,
  loginUserValidation,
  mobileLoginUserValidation,
  resetpasswordValidation,
  verifyOtpValidation,
} from './user.validator';
import CookieService from '../../../services/cookie.service';

const register = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.email || !payload.mobile) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Email and mobile number is required.',
      });
    }

    let { email, mobile } = payload;

    const user = await User.findOne({
      $or: [{ email }, { mobile }],
    });

    if (user) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'User with this email or mobile number, already exist.',
      });
    }

    // normalize inputs
    if (payload.email) payload.email = String(payload.email).trim().toLowerCase();
    if (payload.mobile) payload.mobile = String(payload.mobile).replace(/\D/g, '').slice(-10);
    if (payload.name) payload.name = String(payload.name).trim();

    await createUserValidation.validate(payload);

    const token = uuidv4();
    const hashedToken = await bcrypt.hash(token, 9);
    const verificationTokenExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();
    const { key, iv } = aesUtils.generateKeyAndIv();

    const hashedEmail = aesUtils.encrypt(payload.email, key, iv);

    payload.isActive = false;
    payload.emailVerified = false;
    payload.activeSessionId = '';
    payload.verificationToken = hashedToken;
    payload.verificationTokenExpires = verificationTokenExpires;
    payload.emailVerified = false;

    payload.password = '';

    const subject = 'Verify Your Email for Rahat Sewa';
    const templateName = 'onboarding';

    // Dynamic values to replace placeholders in the template
    const userName = payload.name;

    const dynamicValues = {
      name: userName,
      verifyUrl: `${config.baseUrl}/verify-email?token=${token}&email=${hashedEmail}&key=${key.toString('hex')}&iv=${iv.toString('hex')}`,
      verifyUrlText: `${config.baseUrl}/verify-email?token=${token}&email=${hashedEmail}&key=${key.toString('hex')}&iv=${iv.toString('hex')}`,
      email: email,
    };

    try {
      await sendEmail(email, userName, subject, templateName, dynamicValues);
    } catch (mailErr) {
      console.warn('Email send failed during register:', mailErr?.message || mailErr);
      // continue without failing registration
    }

    const newUser = new User(payload);

    await newUser.save();

    return createResponse({
      res,
      statusCode: httpStatus.CREATED,
      status: true,
      message:
        'You’ve signed up successfully, please check your registered email for verification',
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        message: error.errors[0] || 'Validation error',
        status: false,
        error: error.errors,
      });
    }
    return createResponse({
      res,
      statusCode: httpStatus.BAD_REQUEST,
      status: false,
      message: 'Failed to register user',
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    let { filters } = extractQueryParams(req);

    const { verificationToken, email, key, iv } = filters;

    if (!verificationToken || !email || !key || !iv) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Invalid data.',
      });
    }

    const keyBuffer = Buffer.from(key, 'hex');
    const ivBuffer = Buffer.from(iv, 'hex');

    const emailDecrypted = aesUtils.decrypt(email, keyBuffer, ivBuffer);

    if (!email) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: "User's email is not provided.",
      });
    }

    const user = await User.findOne({ email: emailDecrypted });

    if (!user || !verificationToken) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: !user
          ? 'User with this email doesnot exist.'
          : !verificationToken
            ? 'Verification token must be provided as query parameters'
            : 'Some error occurred',
      });
    }

    if (user.emailVerified) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message:
          'Your email is already verified, you can proceed to your account',
      });
    }

    const isTokenValid = await hashUtils.compare(
      verificationToken,
      user.verificationToken
    );

    if (!isTokenValid) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Invalid verification token.',
      });
    }

    if (validateTime(user.verificationTokenExpires, 'past')) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message:
          'यह सत्यापन लिंक अब मान्य नहीं है, कृपया राहत कण्ट्रोल रूम 1070 पर संपर्क करें।',
      });
    }

    const token = uuidv4();
    const hashedToken = await bcrypt.hash(token, 9);
    const verificationTokenExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    user.isActive = true;
    user.emailVerified = true;
    user.verificationToken = hashedToken;
    user.verificationTokenExpires = verificationTokenExpires;

    await user.save();

    return createResponse({
      res,
      statusCode: httpStatus.CREATED,
      status: true,
      message: "User's verification is successful. Login to continue.",
      data: {
        verificationToken,
        emailDecrypted,
      },
    });
  } catch (error) {
    console.log(error.message);
    return createResponse({
      res,
      statusCode: httpStatus.BAD_REQUEST,
      status: false,
      message: 'Failed to verify email',
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    await loginUserValidation.validate(
      { email, password },
      { abortEarly: false }
    );

    if (!email || !password) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Email and password are required',
      });
    }
    const user = await User.findOne({ email });

    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        status: false,
        message: 'Invalid credentials',
      });
    }

    if (!user.password || user.password == '') {
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        status: false,
        message: 'Please set the password first',
      });
    }

    if (!user.isActive) {
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        status: false,
        message: 'Your account is not active',
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

    const token = jwtUtils.generateToken({
      id: user._id,
    });

    user.token = token;

    await user.save();

    // if (user.activeSessionId) {
    //   await mongoose.connection.db
    //     .collection('sessions')
    //     .deleteOne({ _id: user.activeSessionId });
    // }

    req.session.userId = user._id.toString();
    const lastLoginDate = moment().format('DD MMM, YYYY HH:mm:ss');
    const clientIp = getClientIp(req);
    await User.updateOne(
      { _id: user._id },
      {
        $set: { activeSessionId: req.sessionID },
        lastLogin: {
          date: lastLoginDate,
          ip: clientIp,
        },
      }
    );

    CookieService.setCookie(res, 'token', token, {
      maxAge: 1000 * 60 * 60 * 12,
    });

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      message: 'Login successful',
      status: true,
      data: {
        token,
        name: user.name,
        id: user._id,
        email: user.email,
        role: user.userRole
      },
    });
  } catch (error) {
    if (error.message === 'Illegal arguments: string, undefined') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        message: `You don't have password, please set your password first`,
        status: false,
        error: error.errors,
      });
    }
    if (error.name === 'ValidationError') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        message: error.errors[0] || 'Validation error',
        status: false,
        error: error.errors,
      });
    }
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: error.message,
      status: false,
      error: error.message,
    });
  }
};

const logout = async (req, res) => {
  try {
    const { user } = req;
    await User.findByIdAndUpdate(user._id, {
      $unset: { token: '' },
      $set: { activeSessionId: '' },
    });
    CookieService.clearCookie(res, 'token');
    req.session.destroy((err) => {
      if (err) {
        return createResponse({
          res,
          statusCode: httpStatus.INTERNAL_SERVER_ERROR,
          status: false,
          message: err.message,
        });
      }
      return createResponse({
        res,
        statusCode: httpStatus.OK,
        status: true,
        message: 'Logout successful',
      });
    });
  } catch (error) {
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { emailOrMobile } = req.body;

    const isEmail = (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const isPhone = (input) => /^[0-9]{10}$/.test(input);

    const input = emailOrMobile.toLowerCase().trim();
    const isEmailInput = isEmail(input);
    const isMobileInput = isPhone(input);

    if (!isEmailInput && !isMobileInput) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Invalid email or phone number format',
      });
    }

    const userQuery = isEmailInput ? { email: input } : { mobile: input };
    const user = await User.findOne(userQuery);

    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        status: false,
        message: 'Invalid credentials',
      });
    }

    // Delete existing OTP
    await UserOtp.findOneAndDelete(userQuery);

    // Use static OTP for all users (for testing or fallback)
    const otp = miscellaneousUtils.generateOTP(6);

    // Save static OTP
    await UserOtp.create({ ...userQuery, otp });

    // Send email only if email is input
    // if (isEmailInput) {
    //   const dynamicValues = {
    //     name: user.name?.english || 'User',
    //     otp,
    //     otpValidity: '5 minutes',
    //     otp1: otp,
    //   };

    //   await sendEmail(
    //     input,
    //     dynamicValues.name,
    //     'Password Reset OTP for Your Rahat Sewa Account',
    //     'otp',
    //     dynamicValues
    //   );
    // } else if (isMobileInput) {
    //   await miscellaneousUtils.sendOtp(user.mobile, otp);
    // }

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
        message: error.errors[0] || 'Validation error',
        status: false,
        error: error.errors,
      });
    }

    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      status: false,
      error: error.message,
    });
  }
};


const verifyotp = async (req, res) => {
  try {
    const { emailOrMobile, otp } = req.body;

    await verifyOtpValidation.validate({ emailOrMobile, otp }, { abortEarly: false });

    const isEmail = (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const isPhone = (input) => /^[0-9]{10}$/.test(input);

    const input = emailOrMobile.toLowerCase().trim();
    const isEmailInput = isEmail(input);
    const isMobileInput = isPhone(input);

    if (!isEmailInput && !isMobileInput) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Invalid email or phone number format',
      });
    }

    const userQuery = isEmailInput ? { email: input } : { mobile: input };

    let isStaticOtp = otp === false;
    let userOtp = null;

    if (!isStaticOtp) {
      userOtp = await UserOtp.findOne({
        ...userQuery,
        otp,
      }).sort({ createdAt: -1 });

      if (!userOtp) {
        return createResponse({
          res,
          statusCode: httpStatus.BAD_REQUEST,
          status: false,
          message: 'Invalid OTP',
        });
      }

      const otpGeneratedTime = new Date(userOtp.createdAt);
      const isValidTime = validateTime(otpGeneratedTime, '5m');

      if (!isValidTime) {
        return createResponse({
          res,
          statusCode: httpStatus.EXPECTATION_FAILED,
          status: false,
          message: 'OTP is expired',
        });
      }

      await UserOtp.deleteOne({ _id: userOtp._id });
    }

    const user = await User.findOne(userQuery).select('name email mobile _id');

    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.NOT_FOUND,
        status: false,
        message: 'User not found',
      });
    }

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'OTP has been verified',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
      },
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        message: error.errors[0] || 'Validation error',
        status: false,
        error: error.errors,
      });
    }
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      status: false,
      error: error.message,
    });
  }
};


const addPassword = async (req, res) => {
  try {
    const { email, password, token } = req.body;

    await changepasswordValidation.validate(
      { email, password, token },
      { abortEarly: false }
    );

    let user = await User.findOne({ email });

    const expiryTime = new Date(user.verificationTokenExpires);

    user.verificationTokenExpires = null;
    user.verificationToken = '';

    if (validateTime(expiryTime, 'past')) {
      await user.save();
      return createResponse({
        res,
        statusCode: httpStatus.EXPECTATION_FAILED,
        status: false,
        message: 'Verification token is expired, please retry.',
      });
    }

    const hashedPassword = await hashUtils.hash(password);
    user.password = hashedPassword;
    await user.save();

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Password has been updated',
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        message: error.errors[0] || 'Validation error',
        status: false,
        error: error.errors,
      });
    }
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      status: false,
      error: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { emailOrMobile, oldPassword, newPassword, otp } = req.body;

    const isEmail = (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const isPhone = (input) => /^[0-9]{10}$/.test(input);

    const input = emailOrMobile.toLowerCase().trim();
    const isEmailInput = isEmail(input);
    const isMobileInput = isPhone(input);

    if (!isEmailInput && !isMobileInput) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Invalid email or phone number format',
      });
    }

    const userQuery = isEmailInput ? { email: input } : { mobile: input };

    const user = await User.findOne(userQuery);
    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        status: false,
        message: 'Invalid credentials',
      });
    }

    const userOtp = await UserOtp.findOne({
      ...userQuery,
      otp: otp,
    }).sort({ createdAt: -1 });

    if (!userOtp) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Invalid OTP',
      });
    }

    // Optional: Delete OTP if it's not static
    if (userOtp) {
      await UserOtp.deleteOne({ _id: userOtp._id });
    }

    // Optional: Check old password
    if (oldPassword) {
      const isMatch = await hashUtils.compare(oldPassword, user.password);
      if (!isMatch) {
        return createResponse({
          res,
          statusCode: httpStatus.UNAUTHORIZED,
          status: false,
          message: 'Old password is incorrect',
        });
      }
    }

    user.password = await hashUtils.hash(newPassword);
    await user.save();

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
        message: error.errors[0],
        status: false,
      });
    }
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      status: false,
    });
  }
};


const listUser = async (req, res) => {
  try {
    const { limit, skip, search } = extractCommonQueryParams(req);
    let query = {};
    const projection = {
      name: 1,
      email: 1,
      mobile: 1,
      lastLogin: 1,
      userRole: 1,
      gender: 1,
      picture: 1,
      googleId: 1,
      emailVerified: 1,
    };

    if (search) {
      query.$or = getCommonSearchConditionForMasters(search);
    }

    const [list, totalCount] = await Promise.all([
      User.find(query, projection)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Users retrieved',
      data: {
        users: list,
        count: totalCount,
      },
    });
  } catch (error) {
    return createResponse({
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      status: false,
      error: error.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'ID is not associated with request',
      });
    }

    const user = await User.findByIdAndUpdate(id, {
      deleted: true,
    });

    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'User not found with given ID',
      });
    }

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'User deleted',
    });
  } catch (error) {
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      status: false,
      error: error.message,
    });
  }
};

const viewUser = async (req, res) => {
  try {
    const id = req.params.id;

    if (!id) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'ID is not associated with request',
      });
    }

    const user = await User.findById(
      id
      //   , {
      //   deleted: true,
      // }
    );
    if (!user || user.deleted === true) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'User not found with given ID',
      });
    }

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'User retrieved',
      data: {
        user: user,
      },
    });
  } catch (error) {
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      status: false,
      error: error.message,
    });
  }
};

const resendVerificationUser = async (req, res) => {
  try {
    const id = req.params.id;

    if (!id) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'ID is not associated with request',
      });
    }

    const user = await User.findById(
      id
      //   , {
      //   deleted: true,
      // }
    );

    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'User not found with given ID',
      });
    }

    if (user.emailVerified) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: "User's email is already verified",
      });
    }

    const subject = 'Verify Your Email for Rahat Sewa';
    const templateName = 'onboarding';
    const userName = user.name;
    const token = uuidv4();
    const hashedToken = await bcrypt.hash(token, 9);
    const verificationTokenExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    const { key, iv } = aesUtils.generateKeyAndIv();
    const hashedEmail = aesUtils.encrypt(user.email, key, iv);
    const dynamicValues = {
      name: userName,
      verifyUrl: `${config.baseUrl}/verify-email?token=${token}&email=${hashedEmail}&key=${key.toString('hex')}&iv=${iv.toString('hex')}`,
      verifyUrlText: `${config.baseUrl}/verify-email?token=${token}&email=${hashedEmail}&key=${key.toString('hex')}&iv=${iv.toString('hex')}`,
      email: user.email,
    };

    try {
      await sendEmail(user.email, userName, subject, templateName, dynamicValues);
    } catch (mailErr) {
      console.warn('Email send failed during resend verification:', mailErr?.message || mailErr);
    }

    user.verificationToken = hashedToken;
    user.verificationTokenExpires = verificationTokenExpires;

    await user.save();

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Mail resent',
    });
  } catch (error) {
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      status: false,
      error: error.message,
    });
  }
};

const verifytoken = async (req, res) => {
  try {
    // Check Authorization header first, then cookie
    let token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      token = CookieService.getCookie(req, 'token');
    }

    if (!token) {
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        status: false,
        message: 'Unauthorized',
      });
    }

    const decoded = jwtUtils.verifyToken(token);

    if (!decoded) {
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        message: 'Invalid or expired token',
        status: false,
        error: { field: 'token', message: 'Invalid or expired token' },
      });
    }

    let user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        message: 'User not found',
        status: false,
        error: { field: 'token', message: 'User not found' },
      });
    }

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Token is valid',
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.userRole,
        mobile: user.mobile
      },
    });
  } catch (error) {
    console.log('error', error);
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: error.message,
      error: error.message,
    });
  }
};

//====== this controller used for mobile login 

const googleLogin = async (req, res) => {
  const { token, email: rawInput, name, picture, signInMethod } = req.body;
  let newUser = false;

  try {
    let user;
    let profileImage = '';
    const isEmail = (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const isPhone = (input) => /^[0-9]{10}$/.test(input);

    let emailOrPhone = rawInput?.toLowerCase().trim();
    let otp = miscellaneousUtils.generateOTP(6);

    if (token) {
      let email = '';
      let userName = name || 'Rahat Sewa User';
      let externalId = '';
      let pictureUrl = '';

      if (signInMethod === 'google') {
        // === GOOGLE LOGIN FLOW ===
        const ticket = await client.verifyIdToken({
          idToken: token,
          audience: config.googleClientId,
        });

        const payload = ticket.getPayload();
        email = payload.email?.toLowerCase().trim();
        userName = payload.name || userName;
        pictureUrl = payload.picture || '';
        externalId = payload.sub;

        user = await User.findOne({ email });

        if (!user) {
          newUser = true;
          user = await User.create({
            name: userName,
            email,
            googleId: externalId,
          });
        }
      } else {
        return createResponse({
          res,
          statusCode: httpStatus.BAD_REQUEST,
          status: false,
          message: 'Unsupported sign-in method',
        });
      }

      profileImage = user.picture || pictureUrl || picture || '';
    } else if (emailOrPhone) {
      // === EMAIL OR PHONE LOGIN FLOW ===
      if (isEmail(emailOrPhone)) {
        user = await User.findOne({ email: emailOrPhone });
      } else if (isPhone(emailOrPhone)) {
        user = await User.findOne({ mobile: emailOrPhone });
      } else {
        return createResponse({
          res,
          statusCode: httpStatus.BAD_REQUEST,
          status: false,
          message: 'Invalid email or phone number format',
        });
      }

      if (!user) {
        if (signInMethod === 'email') {
          return createResponse({
            res,
            statusCode: httpStatus.UNAUTHORIZED,
            status: false,
            message: 'User not found. Please sign up first.',
          });
        }

        newUser = true;
        user = await User.create({
          name: name || emailOrPhone.split('@')[0] || 'Rahat Sewa User',
          ...(isEmail(emailOrPhone)
            ? { email: emailOrPhone }
            : { mobile: emailOrPhone }),
        });
      }

      profileImage = user.picture || picture || '';

      // if (isEmail(emailOrPhone)) {
      //   await sendEmail(
      //     emailOrPhone,
      //     user.name?.english || 'User',
      //     'Your OTP Code',
      //     'otp',
      //     {
      //       otp,
      //       user: user.name?.english || 'User',
      //     }
      //   );
      // } else {
      //   await miscellaneousUtils.sendOtp(user.mobile, otp); 
      // }
    } else {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Token or email/phone must be provided',
      });
    }

    // === UPDATE USER PICTURE IN USER MODEL
    if (profileImage && profileImage !== user.picture) {
      user.picture = profileImage;
      await user.save();
    }

    const isMpinSet = !!(user.password && user.password !== '');

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: newUser
        ? 'User has been created'
        : !isMpinSet
          ? 'MPIN is not set yet'
          : 'Enter MPIN to verify',
      data: {
        id: user._id,
        isMpinSet,
        email: user.email,
        mobile: user.mobile,
        name: user.name || '',
        otp, // dev only
      },
    });
  } catch (error) {
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: 'Something went wrong. Please try again later.',
    });
  }
};

const mobileLogin = async (req, res) => {
  try {
    const { emailOrMobile, name } = req.body;
    const isEmail = (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const isPhone = (input) => /^[0-9]{10}$/.test(input);

    if (!emailOrMobile || (!isEmail(emailOrMobile) && !isPhone(emailOrMobile))) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Invalid email or phone number format',
      });
    }

    const input = emailOrMobile.toLowerCase().trim();
    const isEmailInput = isEmail(input);
    const isMobileInput = isPhone(input);

    let user;
    if (isEmailInput) {
      user = await User.findOne({ email: input });
    } else {
      user = await User.findOne({ mobile: input });
    }

    if (!user) {
      const message = isEmailInput
        ? 'यह ईमेल पंजीकृत नहीं है। कृपया राहत कण्ट्रोल रूम 1070 पर संपर्क करें।'
        : 'यह मोबाइल नंबर पंजीकृत नहीं है। कृपया राहत कण्ट्रोल रूम 1070 पर संपर्क करें।';
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        status: false,
        message,
      });
    }

    const userName = user.name || input.split('@')[0] || 'UP SDMA User';

    if (!user.isMpinSet) {

      await UserOtp.deleteMany({ $or: [{ email: user.email }, { mobile: user.mobile }] });


      const otp = miscellaneousUtils.generateOTP(6);
      await UserOtp.create({
        ...(isEmailInput ? { email: user.email } : { mobile: user.mobile }),
        otp,
      });


      // if (isEmailInput) {
      //   try {
      //     await sendEmail(
      //       user.email,
      //       userName,
      //       'Your OTP Code',
      //       'otp',
      //       {
      //         otp,
      //         user: userName,
      //       }
      //     );
      //   } catch (emailErr) {
      //     console.warn('Failed to send email OTP, but continuing:', emailErr.message);
      //   }
      // } else if (isMobileInput) {
      //   const reps = await miscellaneousUtils.sendOtp(user.mobile, otp);
      // }
    }

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: user.isMpinSet
        ? 'MPIN is already set. Please verify your MPIN.'
        : 'Login successfully, Set your MPIN to continue.',
      data: {
        id: user._id,
        email: user.email || '',
        mobile: user.mobile || '',
        isMpinSet: user.isMpinSet,
        name: user.name || '',
        otp: user.otp//(optional) only for dev/testing
      },
    });

  } catch (error) {
    console.error('Mobile login error:', error);
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: 'Something went wrong. Please try again later.',
    });
  }
};



const setVerifyMPIN = async (req, res) => {
  try {
    const { mpin } = req.body;
    const { id } = req.params;

    await mobileLoginUserValidation.validate({ mpin, id }, { abortEarly: false });

    const user = await User.findById(id);

    if (!user) {
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        status: false,
        message: 'User does not exist',
      });
    }

    if (!user.isActive) {
      return createResponse({
        res,
        statusCode: httpStatus.UNAUTHORIZED,
        status: false,
        message: 'Your account is not active',
      });
    }

    if (!user.password || user.password === '') {
      const hashedNew = await hashUtils.hash(mpin);

      const reused = user.passwordHistory?.length
        ? await Promise.all(user.passwordHistory.map(old => hashUtils.compare(mpin, old)))
        : [];

      if (reused.includes(true)) {
        return createResponse({
          res,
          statusCode: httpStatus.BAD_REQUEST,
          status: false,
          message: 'You cannot reuse a previously set MPIN.',
        });
      }

      user.password = hashedNew;
      user.passwordHistory = [hashedNew, ...(user.passwordHistory || [])].slice(0, 5);
      user.isMpinSet = true;
    } else {
      const isPasswordMatch = await hashUtils.compare(mpin, user.password);
      if (!isPasswordMatch) {
        return createResponse({
          res,
          statusCode: httpStatus.UNAUTHORIZED,
          status: false,
          message: 'Invalid MPIN',
        });
      }
    }

    const token = jwtUtils.generateToken({ id: user._id });
    user.token = token;
    req.session.userId = user._id.toString();

    const lastLoginDate = moment().format('DD MMM, YYYY HH:mm:ss');
    const clientIp = getClientIp(req);
    user.activeSessionId = req.sessionID;
    user.lastLogin = { date: lastLoginDate, ip: clientIp };

    await user.save();

    CookieService.setCookie(res, 'token', token, {
      maxAge: 1000 * 60 * 60 * 12,
    });

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      message: 'MPIN set, Login successful',
      status: true,
      data: {
        token,
        name: user.name,
        id: user._id,
        userRole: user.userRole,
        email: user.email,
        mobile: user.mobile,
        picture: user.picture || '',
      },
    });
  } catch (error) {
    if (error.message === 'Illegal arguments: string, undefined') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        message: `You don't have an MPIN, please set your MPIN first`,
        status: false,
      });
    }

    if (error.name === 'ValidationError') {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        message: error.errors?.[0] || 'Validation error',
        status: false,
        error: error.errors,
      });
    }

    console.error('MPIN login error:', error);
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong. Please try again later.',
      status: false,
    });
  }
};



export const userController = {
  register,
  login,
  verifyEmail,
  forgotPassword,
  verifyotp,
  addPassword,
  changePassword,
  logout,
  listUser,
  deleteUser,
  viewUser,
  resendVerificationUser,
  verifytoken,
  googleLogin,
  setVerifyMPIN,
  mobileLogin,
};
