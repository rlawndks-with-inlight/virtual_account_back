import express from 'express';
import { virtualAccountCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(virtualAccountCtrl.list)
    .post(virtualAccountCtrl.create);

router
    .route('/:id')
    .get(virtualAccountCtrl.get)
    .put(virtualAccountCtrl.update)
    .delete(virtualAccountCtrl.remove);


export default router;