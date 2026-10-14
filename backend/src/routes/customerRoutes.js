import express from 'express';
import {
    createCustomer, getCustomers, getCustomerById,
    updateCustomer, deleteCustomer, toggleCreditHold,
} from '../controllers/customerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
    createCustomerSchema, updateCustomerSchema,
} from '../validators/customerValidator.js';

const router = express.Router();
router.use(protect);

router
    .route('/')
    .get(getCustomers)
    .post(
        authorize('admin', 'manager', 'sales_manager', 'sales_rep', 'cashier'),
        validate(createCustomerSchema),
        createCustomer
    );

router
    .route('/:id')
    .get(getCustomerById)
    .put(
        authorize('admin', 'manager', 'sales_manager', 'sales_rep', 'cashier'),
        validate(updateCustomerSchema),
        updateCustomer
    )
    .delete(authorize('admin', 'manager'), deleteCustomer);

router.patch(
    '/:id/credit-hold',
    authorize('admin', 'manager', 'accountant'),
    toggleCreditHold
);

export default router;