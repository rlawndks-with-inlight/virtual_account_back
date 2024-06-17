import express from 'express';
import { depositAccountCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(depositAccountCtrl.list)
    .post(depositAccountCtrl.create);

router
    .route('/:id')
    .get(depositAccountCtrl.get)
    .put(depositAccountCtrl.update)
    .delete(depositAccountCtrl.remove);


export default router;