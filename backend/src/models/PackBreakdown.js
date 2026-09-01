import mongoose from 'mongoose';
import { getNextSequence } from './Counter.js';

const packBreakdownSchema = new mongoose.Schema(
    {
        breakdownNumber: {
            type: String,
            unique: true,
            trim: true,
            uppercase: true,
        },
        breakdownDate: {
            type: Date,
            default: Date.now,
        },
        warehouseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Warehouse',
            required: true,
        },

        // Source Pack Item (Stock Decreased)
        sourceProductId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        sourceProductCode: { type: String, trim: true },
        sourceProductName: { type: String, trim: true },
        packsQuantity: {
            type: Number,
            required: true,
            min: 0.01,
        },
        sourceCostPerPack: {
            type: Number,
            default: 0,
        },

        // Target Retail Unit Item (Stock Increased)
        targetProductId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        targetProductCode: { type: String, trim: true },
        targetProductName: { type: String, trim: true },
        unitsPerPack: {
            type: Number,
            required: true,
            min: 1,
        },
        totalUnitsProduced: {
            type: Number,
            required: true,
            min: 1,
        },
        targetCostPerUnit: {
            type: Number,
            default: 0,
        },

        notes: { type: String, trim: true },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

packBreakdownSchema.index({ breakdownDate: -1 });
packBreakdownSchema.index({ warehouseId: 1 });
packBreakdownSchema.index({ sourceProductId: 1 });
packBreakdownSchema.index({ targetProductId: 1 });

packBreakdownSchema.pre('save', async function () {
    if (this.isNew && !this.breakdownNumber) {
        const seq = await getNextSequence('pack_breakdown');
        this.breakdownNumber = `BRK-${seq}`;
    }
});

const PackBreakdown = mongoose.model('PackBreakdown', packBreakdownSchema);
export default PackBreakdown;
