import express from 'express';
import brandRoutes from './brand.route.js';
import authRoutes from './auth.route.js';
import domainRoutes from './domain.route.js';
import uploadRoutes from './upload.route.js';
import logRoutes from './log.route.js';
import userRoutes from './user.route.js';
import depositRoutes from './deposit.route.js';
import withdrawRoutes from './withdraw.route.js';
import virtualAccountRoutes from './virtual_account.route.js';
import utilRoutes from './util.route.js';
import settleRoutes from './settle.route.js';
import dashboardRoutes from './dashboard.route.js';
import corpUtilRoutes from './corp_util.route.js';
import depositRequestRoutes from './deposit_request.route.js';
import corpAccountRoutes from './corp_account.route.js';
import bellContentRoutes from './bell_content.route.js';
import brandPayRoutes from './brand_pay.route.js';
import reserveRoutes from './reserve.route.js';
import bulkUploadRoutes from './bulk_upload.route.js';
import gitRoutes from './git.route.js';
import blackListRoutes from './black_list.route.js';
import phoneAuthHistoryRoutes from './phone_auth_history.route.js';
import depositAccountRoutes from './deposit_account.route.js';
import memberRoutes from './member.route.js';

const router = express.Router(); // eslint-disable-line new-cap

/** GET /health-check - Check service health */

// tables
router.use('/brands', brandRoutes);
router.use('/logs', logRoutes);
router.use('/users', userRoutes);
router.use('/deposits', depositRoutes);
router.use('/withdraws', withdrawRoutes);
router.use('/settles', settleRoutes);
router.use('/virtual-accounts', virtualAccountRoutes);
router.use('/deposit-requests', depositRequestRoutes);
router.use('/corp-accounts', corpAccountRoutes);
router.use('/deposit-accounts', depositAccountRoutes);
router.use('/bell-contents', bellContentRoutes);
router.use('/brand-pays', brandPayRoutes);
router.use('/reserves', reserveRoutes);
router.use('/black-lists', blackListRoutes);
router.use('/phone-auth-histories', phoneAuthHistoryRoutes);
router.use('/members', memberRoutes);


//auth
router.use('/auth', authRoutes);

//util
router.use('/domain', domainRoutes);
router.use('/upload', uploadRoutes);
router.use('/util', utilRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/corp', corpUtilRoutes);
router.use('/bulk-upload', bulkUploadRoutes);
router.use('/git', gitRoutes);

export default router;
