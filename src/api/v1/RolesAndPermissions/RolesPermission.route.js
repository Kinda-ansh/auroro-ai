import express from 'express';
import auth from '../../../middlewares/auth.middleware.js';
import { RoleController } from './RolesPermission.controller';

const router = express.Router();

router.get('/roles', auth, RoleController.getRoles);
router.post('/roles', auth, RoleController.createRole);
router.get('/roles/:id', auth, RoleController.getRole);
router.patch('/roles/:id', auth, RoleController.updateRole);
router.get('/permissions/:id', auth, RoleController.getPermissions);

export default router;
