import express from 'express';
import { phoneAuthHistoryCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(phoneAuthHistoryCtrl.list)
    .post(phoneAuthHistoryCtrl.create);

router
    .route('/:id')
    .get(phoneAuthHistoryCtrl.get)
    .put(phoneAuthHistoryCtrl.update)
    .delete(phoneAuthHistoryCtrl.remove);


export default router;