import express from 'express';

import { userController } from './user.controller';
import auth from '../../../middlewares/auth.middleware';

const router = express.Router();

router.post('/register', userController.register);
router.post('/login', userController.login);
router.get('/mail-verify', userController.verifyEmail);
router.post('/forget-password', userController.forgotPassword);
router.post('/verify-otp', userController.verifyotp);
router.post('/add-password', userController.addPassword);
router.post('/change-password', userController.changePassword);
router.post('/logout', auth, userController.logout);
router.get('/users', auth, userController.listUser);
router.delete('/user/:id', auth, userController.deleteUser);
router.get('/user/:id', auth, userController.viewUser);
router.put('/user/:id', auth, userController.resendVerificationUser);
router.get('/verifyToken', userController.verifytoken);
router.post('/google-login', userController.googleLogin);
router.post('/mobile-login', userController.mobileLogin);
router.post('/set-verify-mpin/:id', userController.setVerifyMPIN);

export default router;
