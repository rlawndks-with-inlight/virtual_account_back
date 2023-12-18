import express from 'express';
import brandRoutes from './brand.route.js';
import authRoutes from './auth.route.js';
import domainRoutes from './domain.route.js';
import uploadRoutes from './upload.route.js';
import logRoutes from './log.route.js';
import userRoutes from './user.route.js';

const router = express.Router(); // eslint-disable-line new-cap

/** GET /health-check - Check service health */

// tables
router.use('/brands', brandRoutes);
router.use('/logs', logRoutes);
router.use('/users', userRoutes);

//auth
router.use('/auth', authRoutes);

//util
router.use('/domain', domainRoutes);
router.use('/upload', uploadRoutes);



export default router;
