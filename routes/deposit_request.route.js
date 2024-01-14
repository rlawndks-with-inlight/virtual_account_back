import express from 'express';
import { depositRequestCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(depositRequestCtrl.list)
    .post(depositRequestCtrl.create);

router
    .route('/:id')
    .get(depositRequestCtrl.get)
    .put(depositRequestCtrl.update)
    .delete(depositRequestCtrl.remove);


export default router;