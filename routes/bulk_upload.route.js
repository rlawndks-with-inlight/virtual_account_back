import express from 'express';
import { bulkUploadCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/merchandise')
    .post(bulkUploadCtrl.merchandise);

export default router;