import express from 'express';
import {
    createSupplier, getSuppliers, getSupplierById,
    updateSupplier, deleteSupplier, getSupplierBalance,
} from '../controllers/supplierController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createSupplierSchema, updateSupplierSchema } from '../validators/supplierValidator.js';

const router = express.Router();
router.use(protect);

router
    .route('/')
    .get(getSuppliers)
    .post(authorize('admin', 'manager', 'accountant', 'inventory_admin'), validate(createSupplierSchema), createSupplier);

router
    .route('/:id/balance')
    .get(getSupplierBalance);

router
    .route('/:id')
    .get(getSupplierById)
    .put(authorize('admin', 'manager', 'accountant', 'inventory_admin'), validate(updateSupplierSchema), updateSupplier)
    .delete(authorize('admin', 'manager'), deleteSupplier);

export default router;