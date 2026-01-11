import express from 'express';
import { aiController } from './ai.controller';
import { aiModelController } from './ai-model.controller';
import auth from '../../../middlewares/auth.middleware';

const router = express.Router();

// AI response operations
router.post('/generate', auth, aiController.generateAIResponse);
router.get('/', auth, aiController.listAIResponses);
router.get('/stats', auth, aiController.getAIStats);
router.get('/:id', auth, aiController.getAIResponse);
router.put('/:id/model', auth, aiController.updateModelResponse);
router.delete('/:id', auth, aiController.deleteAIResponse);

// Retry operations
router.post('/:id/retry', auth, aiController.retryFailedResponses);
router.post('/:id/select', auth, aiController.selectPreferredResponse);

// Individual model operations
router.post('/:responseId/model/:model/generate', auth, aiModelController.generateSingleModelResponse);
router.put('/:responseId/model/:model', auth, aiModelController.updateSingleModelResponse);
router.delete('/:responseId/model/:model', auth, aiModelController.deleteSingleModelResponse);
router.post('/:responseId/model/:model/retry', auth, aiModelController.retrySingleModelResponse);

export default router;
