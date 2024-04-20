import express from 'express';
import { blackListCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(blackListCtrl.list)
    .post(blackListCtrl.create);

router
    .route('/:id')
    .get(blackListCtrl.get)
    .put(blackListCtrl.update)
    .delete(blackListCtrl.remove);


export default router;