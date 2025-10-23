import mongoose from 'mongoose';
import * as yup from 'yup';

export const createUserValidation = yup.object().shape({
  name: yup
    .string()
    .trim()
    .required('Name is required')
    .min(3, 'Name must have more than 2 characters'),
  email: yup
    .string()
    .trim()
    .required('Email is required')
    .matches(
      /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/,
      {
        message: 'Please enter a valid email address in lowercase',
        excludeEmptyString: true
      }),
  mobile: yup
    .string()
    .trim()
    .required('Mobile number is required')
    .matches(
      /^(\+91|91)?(0?[0-9])?\d{9}$/,
      {
        message: 'Please enter a valid mobile number',
        excludeEmptyString: true
      }
    ),
  isActive: yup.boolean().default(true),
  gender: yup.string().trim(),
  token: yup.string().trim(),
  district: yup.string().trim().optional(),
  // district: yup.mixed().test('is-object-id', 'Type must be a valid ObjectId', (value) => {
  //   return mongoose.Types.ObjectId.isValid(value);
  // }).optional(),
  verificationToken: yup.string().trim(),
  verificationTokenExpires: yup.string().trim(),
  emailVerified: yup.boolean().default(false),
  activeSessionId: yup.string().default(''),
});

export const loginUserValidation = yup.object().shape({
  email: yup.string()
    .email('Invalid email format')
    .required('Email is required'),
  password: yup.string().required('Password is required'),
});

export const mobileLoginUserValidation = yup.object().shape({
  mpin: yup.string().required('MPIN is required').length(6, 'Must be exactly 6 characters'),
  id: yup.string().required('Id is required')
});

export const forgotPasswordUserValidation = yup.object().shape({
  email: yup.string()
    .email('Invalid email format')
    .required('Email is required'),
});

export const verifyOtpValidation = yup.object().shape({
  emailOrMobile: yup
    .string()
    .required('Email or mobile is required')
    .test(
      'is-valid-email-or-phone',
      'Must be a valid email or 10-digit mobile number',
      value =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^[0-9]{10}$/.test(value)
    ),
  otp: yup
    .string()
    .matches(/^\d{6}$/, 'OTP must be a 6-digit number')
    .required('OTP is required'),
});
export const resetpasswordValidation = yup.object().shape({
  email: yup.string().required('Email is required'),
  newPassword: yup.string().required('New Password is required'),
  oldPassword: yup.string().required('Old Password is required'),
});

export const changepasswordValidation = yup.object().shape({
  email: yup.string().required('Email is required'),
  token: yup.string().required('Token is required'),
  password: yup.string().required('Password is required'),
});