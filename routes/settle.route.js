import express from 'express';
import { settleCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(settleCtrl.list)

export default router;