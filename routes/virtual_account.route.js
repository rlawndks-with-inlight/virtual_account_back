import express from 'express';
import { virtualAccountCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(virtualAccountCtrl.list)
    .post(virtualAccountCtrl.create);
router
    .route('/exist-check')
    .post(virtualAccountCtrl.exist_check)
router
    .route('/:id')
    .get(virtualAccountCtrl.get)
    .put(virtualAccountCtrl.update)
    .delete(virtualAccountCtrl.remove);
router
    .route('/mcht/:id')
    .delete(virtualAccountCtrl.removeAllByMcht);

router
    .route('/balance/:id')
    .get(virtualAccountCtrl.getBalance)
router
    .route('/status/:id')
    .get(virtualAccountCtrl.getStatus)
router
    .route('/mother')
    .post(virtualAccountCtrl.moveMother)
router
    .route('/change-virtual-user-name')
    .post(virtualAccountCtrl.changeVirtualUserName)
router
    .route('/connect-mcht')
    .post(virtualAccountCtrl.connectMcht)
router
    .route('/request-deposit')
    .post(virtualAccountCtrl.requestDeposit)
router
    .route('/cancel-deposit')
    .post(virtualAccountCtrl.cancelDeposit)

router
    .route('/change-status/:id')
    .put(virtualAccountCtrl.changeStatus)
router
    .route('/daily-auth-request')
    .post(virtualAccountCtrl.dailyAuthRequest)
router
    .route('/daily-auth-check')
    .post(virtualAccountCtrl.dailyAuthCheck)

export default router;