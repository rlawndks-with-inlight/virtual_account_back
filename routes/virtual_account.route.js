import express from 'express';
import { virtualAccountCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(virtualAccountCtrl.list)
    .post(virtualAccountCtrl.create);

router
    .route('/:id')
    .get(virtualAccountCtrl.get)
    .put(virtualAccountCtrl.update)
    .delete(virtualAccountCtrl.remove);
router
    .route('/balance/:id')
    .get(virtualAccountCtrl.getBalance)
router
    .route('/mother')
    .post(virtualAccountCtrl.moveMother)
router
    .route('/change-virtual-user-name')
    .post(virtualAccountCtrl.changeVirtualUserName)
router
    .route('/connect-mcht')
    .post(virtualAccountCtrl.connectMcht)

export default router;