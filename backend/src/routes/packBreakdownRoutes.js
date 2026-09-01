import express from 'express';
import {
    unpackPacks,
    getBreakdownHistory,
} from '../controllers/packBreakdownController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router
    .route('/')
    .post(authorize('admin', 'manager', 'inventory_admin', 'warehouse_staff', 'staff'), unpackPacks);

router
    .route('/history')
    .get(getBreakdownHistory);

export default router;
