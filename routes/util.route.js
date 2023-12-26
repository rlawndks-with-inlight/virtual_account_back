import express from 'express';
import { utilCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(utilCtrl.setting)

export default router;