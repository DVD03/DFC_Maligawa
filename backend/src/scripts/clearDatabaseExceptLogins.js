import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import GoodsReceiptNote from '../models/GoodsReceiptNote.js';
import Bill from '../models/Bill.js';
import Payment from '../models/Payment.js';
import BakeryDailyEntry from '../models/BakeryDailyEntry.js';
import BakeryTemplate from '../models/BakeryTemplate.js';
import Invoice from '../models/Invoice.js';
import SalesOrder from '../models/SalesOrder.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Product from '../models/Product.js';
import StockItem from '../models/StockItem.js';
import StockMovement from '../models/StockMovement.js';
import StockReservation from '../models/StockReservation.js';
import Supplier from '../models/Supplier.js';
import Customer from '../models/Customer.js';
import DamageRecord from '../models/DamageRecord.js';
import CustomerReturn from '../models/CustomerReturn.js';
import SupplierReturn from '../models/SupplierReturn.js';
import Expense from '../models/Expense.js';
import PosSession from '../models/PosSession.js';
import Cheque from '../models/Cheque.js';
import BankAccount from '../models/BankAccount.js';
import CreditNote from '../models/CreditNote.js';
import PackBreakdown from '../models/PackBreakdown.js';
import ProductionOrder from '../models/ProductionOrder.js';
import BillOfMaterials from '../models/BillOfMaterials.js';
import Attendance from '../models/Attendance.js';
import Payroll from '../models/Payroll.js';
import EmployeeWagePayment from '../models/EmployeeWagePayment.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Employee from '../models/Employee.js';
import Counter from '../models/Counter.js';
import Warehouse from '../models/Warehouse.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import CustomerGroup from '../models/CustomerGroup.js';
import UnitOfMeasure from '../models/UnitOfMeasure.js';
import { seedDefaults } from '../utils/seedDefaults.js';

async function clearDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected');

        const usersCount = await User.countDocuments();
        console.log('Found ' + usersCount + ' users. Preserving all user accounts!');

        // 1. Delete all transactional & operational collections
        const collectionsToClear = [
            { name: 'GoodsReceiptNote', model: GoodsReceiptNote },
            { name: 'Bill', model: Bill },
            { name: 'Payment', model: Payment },
            { name: 'BakeryDailyEntry', model: BakeryDailyEntry },
            { name: 'BakeryTemplate', model: BakeryTemplate },
            { name: 'Invoice', model: Invoice },
            { name: 'SalesOrder', model: SalesOrder },
            { name: 'PurchaseOrder', model: PurchaseOrder },
            { name: 'Product', model: Product },
            { name: 'StockItem', model: StockItem },
            { name: 'StockMovement', model: StockMovement },
            { name: 'StockReservation', model: StockReservation },
            { name: 'Supplier', model: Supplier },
            { name: 'Customer', model: Customer },
            { name: 'DamageRecord', model: DamageRecord },
            { name: 'CustomerReturn', model: CustomerReturn },
            { name: 'SupplierReturn', model: SupplierReturn },
            { name: 'Expense', model: Expense },
            { name: 'PosSession', model: PosSession },
            { name: 'Cheque', model: Cheque },
            { name: 'BankAccount', model: BankAccount },
            { name: 'CreditNote', model: CreditNote },
            { name: 'PackBreakdown', model: PackBreakdown },
            { name: 'ProductionOrder', model: ProductionOrder },
            { name: 'BillOfMaterials', model: BillOfMaterials },
            { name: 'Attendance', model: Attendance },
            { name: 'Payroll', model: Payroll },
            { name: 'EmployeeWagePayment', model: EmployeeWagePayment },
            { name: 'LeaveRequest', model: LeaveRequest },
            { name: 'Employee', model: Employee },
            { name: 'Brand', model: Brand },
            { name: 'Category', model: Category },
            { name: 'CustomerGroup', model: CustomerGroup },
            { name: 'UnitOfMeasure', model: UnitOfMeasure },
            { name: 'Warehouse', model: Warehouse },
            { name: 'Counter', model: Counter },
        ];

        for (const item of collectionsToClear) {
            const count = await item.model.countDocuments();
            await item.model.deleteMany({});
            console.log('✓ Cleared ' + item.name + ' (' + count + ' documents removed)');
        }

        // 2. Re-seed essential defaults
        console.log('\n--- Re-seeding essential defaults ---');
        await seedDefaults();

        const finalUsers = await User.find({}, 'email role');
        console.log('\n✓ Database cleanup complete! Preserved users:');
        console.log(finalUsers);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error during cleanup:', err);
        process.exit(1);
    }
}

clearDatabase();
