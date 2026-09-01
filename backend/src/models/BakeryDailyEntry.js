import mongoose from 'mongoose';
import { getNextSequence } from './Counter.js';

const bakeryDailyItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        productCode: { type: String, trim: true },
        productName: { type: String, trim: true, required: true },
        buyPrice: { type: Number, required: true, min: 0 },
        sellPrice: { type: Number, required: true, min: 0 },
        unitProfit: { type: Number, default: 0 },
        isDailyReturnable: { type: Boolean, default: true },
        shelfLifeDays: { type: Number, default: 1 },
        receivedQty: { type: Number, required: true, min: 0, default: 0 },
        returnedQty: { type: Number, default: 0, min: 0 },
        netQty: { type: Number, default: 0 },
        lineSupplyTotal: { type: Number, default: 0 },
        lineReturnTotal: { type: Number, default: 0 },
        lineExpectedProfit: { type: Number, default: 0 },
    },
    { _id: true }
);

const bakeryDailyEntrySchema = new mongoose.Schema(
    {
        entryNumber: {
            type: String,
            unique: true,
            trim: true,
            uppercase: true,
        },
        entryDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        supplierId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Supplier',
            required: true,
        },
        warehouseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Warehouse',
            required: true,
        },
        items: [bakeryDailyItemSchema],

        financials: {
            previousBalance: { type: Number, default: 0 },
            grossSupplyAmount: { type: Number, default: 0 },
            totalReturnAmount: { type: Number, default: 0 },
            netSupplyAmount: { type: Number, default: 0 },
            totalPayable: { type: Number, default: 0 },
            paidAmount: { type: Number, default: 0 },
            paymentMethod: {
                type: String,
                enum: ['cash', 'bank_transfer', 'cheque', 'none'],
                default: 'cash',
            },
            paymentReference: { type: String, trim: true },
            bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
            chequeNumber: { type: String, trim: true },
            closingBalance: { type: Number, default: 0 },
        },

        status: {
            type: String,
            enum: ['confirmed', 'draft', 'cancelled'],
            default: 'confirmed',
        },

        notes: { type: String, trim: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

bakeryDailyEntrySchema.index({ supplierId: 1, entryDate: -1 });
bakeryDailyEntrySchema.index({ entryDate: -1 });
bakeryDailyEntrySchema.index({ warehouseId: 1 });

bakeryDailyEntrySchema.pre('save', async function () {
    if (this.isNew && !this.entryNumber) {
        const seq = await getNextSequence('bakery_entry');
        this.entryNumber = `BK-${seq}`;
    }

    // Recalculate line totals and financials
    let gross = 0;
    let returns = 0;

    if (this.items && this.items.length > 0) {
        this.items.forEach((item) => {
            item.unitProfit = +(item.sellPrice - item.buyPrice).toFixed(2);
            item.netQty = +(item.receivedQty - item.returnedQty).toFixed(2);
            item.lineSupplyTotal = +(item.receivedQty * item.buyPrice).toFixed(2);
            item.lineReturnTotal = +(item.returnedQty * item.buyPrice).toFixed(2);
            item.lineExpectedProfit = +(item.netQty * item.unitProfit).toFixed(2);

            gross += item.lineSupplyTotal;
            returns += item.lineReturnTotal;
        });
    }

    const prevBal = this.financials?.previousBalance || 0;
    const paid = this.financials?.paidAmount || 0;
    const netSupply = +(gross - returns).toFixed(2);
    const totalPayable = +(prevBal + netSupply).toFixed(2);
    const closing = +(totalPayable - paid).toFixed(2);

    this.financials = {
        ...this.financials,
        grossSupplyAmount: +gross.toFixed(2),
        totalReturnAmount: +returns.toFixed(2),
        netSupplyAmount: netSupply,
        totalPayable: totalPayable,
        closingBalance: closing,
    };
});

bakeryDailyEntrySchema.pre(/^find/, function (next) {
    if (!this.getOptions || !this.getOptions().includeDeleted) {
        this.where({ deletedAt: null });
    }
    if (typeof next === 'function') next();
});

const BakeryDailyEntry = mongoose.model('BakeryDailyEntry', bakeryDailyEntrySchema);
export default BakeryDailyEntry;
