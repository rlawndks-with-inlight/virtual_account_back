import express from 'express';
import { gitCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/commit')
    .post(gitCtrl.commit);

export default router;