import express from 'express';
import { utilCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(utilCtrl.setting)
router
    .route('/:table/:column_name')
    .post(utilCtrl.changeStatus);
export default router;