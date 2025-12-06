import express from 'express';
import { projectController } from './project.controller.js';
import auth from '../../../middlewares/auth.middleware.js';

const router = express.Router();

// Project CRUD operations
router.post('/', auth, projectController.createProject);
router.get('/', auth, projectController.listProjects);
router.get('/:id', auth, projectController.getProject);
router.put('/:id', auth, projectController.updateProject);
router.put('/:id/canvas', auth, projectController.updateCanvas);
router.delete('/:id', auth, projectController.deleteProject);

export default router;
