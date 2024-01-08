import express from 'express';
import { corpUtilCtrl } from '../controllers/index.js';
const router = express.Router(); // eslint-disable-line new-cap

router
    .route('/user/info')
    .post(corpUtilCtrl.user.info);
router
    .route('/user/create')
    .post(corpUtilCtrl.user.create);
router
    .route('/user/remove')
    .post(corpUtilCtrl.user.remove);
router
    .route('/user/account')
    .post(corpUtilCtrl.user.account);
router
    .route('/user/account_verify')
    .post(corpUtilCtrl.user.account_verify);
router
    .route('/user/account_delete')
    .post(corpUtilCtrl.user.account_delete);
router
    .route('/user/account/info')
    .post(corpUtilCtrl.user.account.info);
router
    .route('/transfer/pass')
    .post(corpUtilCtrl.transfer.pass);
router
    .route('/balance/info')
    .post(corpUtilCtrl.balance.info);
router
    .route('/bank/list')
    .post(corpUtilCtrl.bank.list);
router
    .route('/vaccount')
    .post(corpUtilCtrl.vaccount);
router
    .route('/vaccount_delete')
    .post(corpUtilCtrl.vaccount_delete);
router
    .route('/push/create')
    .post(corpUtilCtrl.push.create);
router
    .route('/push/update')
    .post(corpUtilCtrl.push.update);
router
    .route('/mother/to')
    .post(corpUtilCtrl.mother.to);
router
    .route('/withdraw/request')
    .post(corpUtilCtrl.withdraw.request);
router
    .route('/withdraw/request_check')
    .post(corpUtilCtrl.withdraw.request_check);

export default router;