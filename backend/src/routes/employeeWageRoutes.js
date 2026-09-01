import express from 'express';
import {
    recordWagePayment,
    getEmployeeAdvanceBalance,
    getWagePayments,
    getWagePaymentById,
} from '../controllers/employeeWageController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router
    .route('/')
    .get(getWagePayments)
    .post(authorize('admin', 'manager', 'accountant'), recordWagePayment);

router
    .route('/advance-balance/:employeeId')
    .get(getEmployeeAdvanceBalance);

router
    .route('/:id')
    .get(getWagePaymentById);

export default router;
