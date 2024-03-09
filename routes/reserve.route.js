import express from 'express';
import { reserveCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(reserveCtrl.list)
    .post(reserveCtrl.create);

router
    .route('/:id')
    .get(reserveCtrl.get)
    .put(reserveCtrl.update)
    .delete(reserveCtrl.remove);


export default router;