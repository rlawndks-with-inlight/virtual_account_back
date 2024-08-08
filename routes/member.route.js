import express from 'express';
import { memberCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/')
    .get(memberCtrl.list)
    .post(memberCtrl.create);

router
    .route('/:id')
    .get(memberCtrl.get)
    .put(memberCtrl.update)
    .delete(memberCtrl.remove);
router
    .route('/balance/:id')
    .get(memberCtrl.getBalance)
router
    .route('/status/:id')
    .get(memberCtrl.getStatus)
router
    .route('/mother')
    .post(memberCtrl.moveMother)

export default router;