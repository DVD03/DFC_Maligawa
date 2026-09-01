import mongoose from 'mongoose';

const bakeryTemplateItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        productCode: { type: String, trim: true },
        productName: { type: String, trim: true, required: true },
        defaultBuyPrice: { type: Number, required: true, min: 0 },
        defaultSellPrice: { type: Number, required: true, min: 0 },
        defaultProfit: { type: Number, default: 0 },
        isDailyReturnable: { type: Boolean, default: true },
        shelfLifeDays: { type: Number, default: 1 },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { _id: true }
);

const bakeryTemplateSchema = new mongoose.Schema(
    {
        supplierId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Supplier',
            required: true,
            unique: true,
        },
        templateName: {
            type: String,
            trim: true,
            default: 'Daily Bakery & Short Eats Structure',
        },
        items: [bakeryTemplateItemSchema],
        notes: { type: String, trim: true },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

bakeryTemplateSchema.pre('save', function () {
    if (this.items && this.items.length > 0) {
        this.items.forEach((item) => {
            item.defaultProfit = +(item.defaultSellPrice - item.defaultBuyPrice).toFixed(2);
        });
    }
});

const BakeryTemplate = mongoose.model('BakeryTemplate', bakeryTemplateSchema);
export default BakeryTemplate;
