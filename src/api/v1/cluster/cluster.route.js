import express from 'express';
import auth from '../../../middlewares/auth.middleware.js';
import { ClusterController } from './cluster.controller.js';
import checkScope from '../../../middlewares/checkScope.middleware.js';

const router = express.Router();

router.get('/', auth, checkScope('cluster'), ClusterController.getClusters);
router.post('/', auth, ClusterController.createCluster);
router.get('/:id', auth, ClusterController.getCluster);
router.patch('/:id', auth, ClusterController.updateVillage);
router.delete('/:id', auth, ClusterController.deleteCluster);
// router.get('/block/:blockId', auth, VillageController.getVillageByBlock);
// router.get('/tehsil/:tehsilId', auth, VillageController.getVillageByTehsil);

export default router;
