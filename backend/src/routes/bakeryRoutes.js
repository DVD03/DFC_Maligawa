import express from 'express';
import {
    getAllTemplates,
    getSupplierTemplate,
    saveSupplierTemplate,
    getSupplierBalance,
    createDailyEntry,
    getDailyEntries,
    getDailyEntryById,
    getSupplierStatement,
    recordSupplierPayment,
    getBakeryStockLevels,
} from '../controllers/bakeryController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router
    .route('/stock')
    .get(getBakeryStockLevels);

router
    .route('/templates')
    .get(getAllTemplates);

router
    .route('/templates/:supplierId')
    .get(getSupplierTemplate)
    .post(authorize('admin', 'manager', 'inventory_admin'), saveSupplierTemplate);

router
    .route('/balance/:supplierId')
    .get(getSupplierBalance);

router
    .route('/statement/:supplierId')
    .get(getSupplierStatement);

router
    .route('/payments')
    .post(authorize('admin', 'manager', 'accountant', 'inventory_admin', 'warehouse_staff', 'cashier', 'staff'), recordSupplierPayment);

router
    .route('/entries')
    .get(getDailyEntries)
    .post(authorize('admin', 'manager', 'inventory_admin', 'warehouse_staff', 'staff'), createDailyEntry);

router
    .route('/entries/:id')
    .get(getDailyEntryById);

router
    .route('/entries/:id/payment')
    .post(authorize('admin', 'manager', 'accountant', 'inventory_admin', 'warehouse_staff', 'cashier', 'staff'), recordSupplierPayment);

export default router;
