import express from 'express';
import { dashboardCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/mcht-deposit')
    .get(dashboardCtrl.mchtDeposit)
router
    .route('/amount')
    .get(dashboardCtrl.amount)
router
    .route('/top-offer-settle')
    .get(dashboardCtrl.topOfferSettle)

export default router;