import express from 'express';
import { depositCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(depositCtrl.list)
    .post(depositCtrl.create);

router
    .route('/:id')
    .get(depositCtrl.get)
    .put(depositCtrl.update)
    .delete(depositCtrl.remove);
router
    .route('/change-note')
    .post(depositCtrl.changeNote);
router
    .route('/add-noti')
    .post(depositCtrl.addNotiDeposit);
router
    .route('/cancel')
    .post(depositCtrl.cancel);
router
    .route('/check-deposit/:id')
    .put(depositCtrl.checkDeposit);

export default router;