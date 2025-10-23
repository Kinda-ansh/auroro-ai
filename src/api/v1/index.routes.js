import express from 'express';
const router = express.Router();
import createResponse from '../../utils/response';
import httpStatus from '../../utils/httpStatus';

// import userRoutes from './User/user.route';
import userRoutes from './User/user.route';
import palyerRoutes from './player/player.route'
import projectRoutes from './project/project.route';
import aiRoutes from './ai/ai.route';
const { FileUploadController } = require('./common/fileupload.controller');
const { upload, uploadFile, uploadMultipleFiles } = FileUploadController;
const { SearchController } = require('./common/search.controller');

// all v1 routes
router.use('/auth', userRoutes);
router.use('/player', palyerRoutes);
router.use('/project', projectRoutes);  // Changed from /projects to /project
router.use('/ai', aiRoutes);

// router.use('/cluster', ClusterRoutes);


router.post('/upload', upload.single('file'), uploadFile);
router.post('/multi-upload', upload.single('file'), uploadMultipleFiles);
router.get('/search/:collectionName', SearchController.search);


/**
 * Middleware to handle 404 Not Found.
 */
router.use((req, res) => {
  createResponse({
    res,
    statusCode: httpStatus.NOT_FOUND,
    message: 'API endpoint not found',
  });
});

export default router;
