import express from 'express';
import validate from 'express-validation';
import { authCtrl } from '../controllers/index.js';

const router = express.Router(); // eslint-disable-line new-cap


router
    .route('/')
    .get(authCtrl.checkSign);
router
    .route('/setting')
    .get(authCtrl.setting);
router
    .route('/sign-in')
    .post(authCtrl.signIn);
router
    .route('/sign-in-another-user')
    .post(authCtrl.signInAnotherUser);
router
    .route('/sign-up')
    .post(authCtrl.signUp);
router
    .route('/change-pw')
    .put(authCtrl.changePassword);
router
    .route('/sign-out')
    .post(authCtrl.signOut);
router
    .route('/deposit')
    .get(authCtrl.deposit);
router
    .route('/sign-key')
    .get(authCtrl.getMySignKey);
export default router;
