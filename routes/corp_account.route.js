import express from 'express';
import { corpAccountCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(corpAccountCtrl.list)
    .post(corpAccountCtrl.create);

router
    .route('/:id')
    .get(corpAccountCtrl.get)
    .put(corpAccountCtrl.update)
    .delete(corpAccountCtrl.remove);


export default router;