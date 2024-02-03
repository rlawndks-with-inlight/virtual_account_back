import express from 'express';
import { brandPayCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(brandPayCtrl.list)
    .post(brandPayCtrl.create);

router
    .route('/:id')
    .get(brandPayCtrl.get)
    .put(brandPayCtrl.update)
    .delete(brandPayCtrl.remove);


export default router;