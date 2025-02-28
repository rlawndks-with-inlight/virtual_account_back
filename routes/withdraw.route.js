import express from 'express';
import { withdrawCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(withdrawCtrl.list)
    .post(withdrawCtrl.create);
router
    .route('/mother')
    .get(withdrawCtrl.motherDeposit)
    .post(withdrawCtrl.motherDepositRequest);
router
    .route('/confirm')
    .post(withdrawCtrl.confirm)
router
    .route('/success')
    .post(withdrawCtrl.success)
router
    .route('/refuse')
    .post(withdrawCtrl.refuse)
router
    .route('/fail')
    .post(withdrawCtrl.fail)
router
    .route('/request')
    .post(withdrawCtrl.request)
router
    .route('/check')
    .post(withdrawCtrl.check)
router
    .route('/check-withdraw')
    .post(withdrawCtrl.check_withdraw)
router
    .route('/trx-id/:id')
    .put(withdrawCtrl.updateTrxId);

router
    .route('/:id')
    .get(withdrawCtrl.get)
    .put(withdrawCtrl.update)
    .delete(withdrawCtrl.remove);


export default router;