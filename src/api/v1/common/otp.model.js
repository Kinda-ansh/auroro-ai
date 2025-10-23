import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      trim: true,
    },
    otp: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expires: '5m' }, // Optional: OTP expires after 5 minutes
    },
  },
  {
    timestamps: true,
    toJSON: {
      getters: true,
    },
  }
);

const UserOtp = mongoose.model('Otps', otpSchema);

export default UserOtp;
