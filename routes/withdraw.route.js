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
    .route('/:id')
    .get(withdrawCtrl.get)
    .put(withdrawCtrl.update)
    .delete(withdrawCtrl.remove);


export default router;