import mongoose from 'mongoose';
import { getNextSequence } from './Counter.js';

const employeeWagePaymentSchema = new mongoose.Schema(
    {
        paymentNumber: {
            type: String,
            unique: true,
            trim: true,
            uppercase: true,
        },
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        employeeName: { type: String, trim: true },
        employeeCode: { type: String, trim: true },

        paymentType: {
            type: String,
            enum: ['daily_wage', 'weekly_wage', 'salary_advance', 'allowance', 'bonus', 'salary_settlement'],
            required: true,
            default: 'daily_wage',
        },

        paymentDate: {
            type: Date,
            required: true,
            default: Date.now,
        },

        // Wage period / breakdown
        periodStartDate: Date,
        periodEndDate: Date,
        daysWorked: { type: Number, default: 1 },
        ratePerDay: { type: Number, default: 0 },

        // Amounts
        grossAmount: { type: Number, required: true, min: 0 },
        advanceDeducted: { type: Number, default: 0, min: 0 },
        otherDeductions: { type: Number, default: 0, min: 0 },
        netAmount: { type: Number, default: 0, min: 0 },

        // Method
        paymentMethod: {
            type: String,
            enum: ['cash', 'bank_transfer', 'cheque'],
            default: 'cash',
        },
        bankAccountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BankAccount',
        },
        chequeNumber: { type: String, trim: true },
        transactionReference: { type: String, trim: true },

        status: {
            type: String,
            enum: ['paid', 'cancelled'],
            default: 'paid',
        },

        notes: { type: String, trim: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

employeeWagePaymentSchema.index({ employeeId: 1, paymentDate: -1 });
employeeWagePaymentSchema.index({ paymentDate: -1 });
employeeWagePaymentSchema.index({ paymentType: 1 });

employeeWagePaymentSchema.pre('save', async function () {
    if (this.isNew && !this.paymentNumber) {
        const seq = await getNextSequence('employee_wage');
        const prefix = this.paymentType === 'salary_advance' ? 'ADV' : 'WAG';
        this.paymentNumber = `${prefix}-${seq}`;
    }

    if (this.paymentType === 'salary_advance') {
        this.netAmount = this.grossAmount;
        this.advanceDeducted = 0;
    } else {
        this.netAmount = Math.max(0, +(this.grossAmount - (this.advanceDeducted || 0) - (this.otherDeductions || 0)).toFixed(2));
    }
});

const EmployeeWagePayment = mongoose.model('EmployeeWagePayment', employeeWagePaymentSchema);
export default EmployeeWagePayment;
