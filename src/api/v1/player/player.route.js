import express from 'express';

import { playerController } from './player.controller';

const router = express.Router();

router.post('/signup', playerController.signup);
router.post('/verify-otp', playerController.verifyOtp);
router.post('/set-password', playerController.setPassword);
router.post('/login', playerController.login);
router.post('/forgot-password', playerController.forgotPassword);
router.post('/change-password', playerController.changePassword);

export default router;
