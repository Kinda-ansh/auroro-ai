import mongoose from 'mongoose';
import * as yup from 'yup';

export const signupValidation = yup.object().shape({
  name: yup.string().trim().min(2, 'Name must have at least 2 characters').optional(),
  email: yup
    .string()
    .trim()
    .matches(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/, {
      message: 'Please enter a valid email address in lowercase',
      excludeEmptyString: true,
    })
    .optional(),
  mobile: yup
    .string()
    .trim()
    .matches(/^(\+91|91)?(0?[0-9])?\d{9}$/, {
      message: 'Please enter a valid mobile number',
      excludeEmptyString: true,
    })
    .optional(),
})
  .test('email-or-mobile', 'Either email or mobile is required', (value) => !!(value?.email || value?.mobile));

export const loginPlayerValidation = yup.object().shape({
  emailOrMobile: yup
    .string()
    .required('Email or mobile is required')
    .test(
      'is-valid-email-or-phone',
      'Must be a valid email or 10-digit mobile number',
      (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '') || /^[0-9]{10}$/.test(value || '')
    ),
  password: yup.string().required('Password is required'),
});

// not used in new player flow

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
  emailOrMobile: yup
    .string()
    .required('Email or mobile is required')
    .test(
      'is-valid-email-or-phone',
      'Must be a valid email or 10-digit mobile number',
      value =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^[0-9]{10}$/.test(value)
    ),
  token: yup.string().required('Token is required'),
  password: yup.string().required('Password is required'),
});

export const forgotPasswordValidation = yup.object().shape({
  emailOrMobile: yup
    .string()
    .required('Email or mobile is required')
    .test(
      'is-valid-email-or-phone',
      'Must be a valid email or 10-digit mobile number',
      value =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^[0-9]{10}$/.test(value)
    ),
});

export const changePasswordWithOtpValidation = yup.object().shape({
  emailOrMobile: yup
    .string()
    .required('Email or mobile is required')
    .test(
      'is-valid-email-or-phone',
      'Must be a valid email or 10-digit mobile number',
      value =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^[0-9]{10}$/.test(value)
    ),
  otp: yup.string().matches(/^\d{6}$/, 'OTP must be a 6-digit number').required('OTP is required'),
  newPassword: yup.string().required('New password is required'),
});