import express from 'express';
import { bellContentCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(bellContentCtrl.list)
    .post(bellContentCtrl.create);

router
    .route('/:id')
    .get(bellContentCtrl.get)
    .put(bellContentCtrl.update)
    .delete(bellContentCtrl.remove);


export default router;