import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Supplier from '../models/Supplier.js';
import Bill from '../models/Bill.js';
import Payment from '../models/Payment.js';
import BakeryDailyEntry from '../models/BakeryDailyEntry.js';

export const getSupplierBalance = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
        res.status(400);
        throw new Error('Valid supplier ID required');
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
        res.status(404);
        throw new Error('Supplier not found');
    }

    // 1. Unpaid / partially paid bills
    const unpaidBills = await Bill.find({
        supplierId: id,
        status: { $ne: 'cancelled' },
        paymentStatus: { $in: ['unpaid', 'partially_paid', 'overdue'] },
    }).sort({ billDate: 1 }).lean();

    const totalBillsBalance = unpaidBills.reduce((s, b) => s + (b.balanceDue || 0), 0);

    // 2. Bakery balance if bakery supplier
    let bakeryBalance = 0;
    const lastBakeryEntry = await BakeryDailyEntry.findOne({ supplierId: id, status: { $ne: 'cancelled' } })
        .sort({ entryDate: -1, createdAt: -1 })
        .lean();
    if (lastBakeryEntry && lastBakeryEntry.financials?.closingBalance != null) {
        bakeryBalance = lastBakeryEntry.financials.closingBalance;
    }

    // Total outstanding balance (all unpaid bills + bakery entries)
    const effectiveOutstanding = Math.max(totalBillsBalance, bakeryBalance);

    res.json({
        success: true,
        data: {
            supplierId: id,
            supplierName: supplier.displayName,
            outstandingBalance: +effectiveOutstanding.toFixed(2),
            unpaidBillsCount: unpaidBills.length,
            totalBillsBalance: +totalBillsBalance.toFixed(2),
            bakeryBalance: +bakeryBalance.toFixed(2),
            unpaidBills,
        },
    });
});

export const createSupplier = asyncHandler(async (req, res) => {
    const payload = { ...req.body, createdBy: req.user._id };
    const supplier = await Supplier.create(payload);
    res.status(201).json({ success: true, data: supplier });
});

export const getSuppliers = asyncHandler(async (req, res) => {
    const {
        search, category, status,
        page = 1, limit = 20,
        sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const filter = {};

    if (search) {
        filter.$or = [
            { displayName: { $regex: search, $options: 'i' } },
            { companyName: { $regex: search, $options: 'i' } },
            { supplierCode: { $regex: search, $options: 'i' } },
            { 'primaryContact.phone': { $regex: search, $options: 'i' } },
        ];
    }
    if (category) {
        if (category === 'general') {
            filter.category = { $ne: 'bakery_short_eats' };
        } else {
            filter.category = category;
        }
    }
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [suppliers, total] = await Promise.all([
        Supplier.find(filter).sort(sortObj).skip(skip).limit(Number(limit)),
        Supplier.countDocuments(filter),
    ]);

    res.json({
        success: true,
        count: suppliers.length,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        data: suppliers,
    });
});

export const getSupplierById = asyncHandler(async (req, res) => {
    if (!req.params.id || req.params.id === 'undefined' || !mongoose.isValidObjectId(req.params.id)) {
        res.status(404);
        throw new Error('Valid supplier ID required');
    }

    const supplier = await Supplier.findById(req.params.id)
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName');
    if (!supplier) { res.status(404); throw new Error('Supplier not found'); }
    res.json({ success: true, data: supplier });
});

export const updateSupplier = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedBy: req.user._id },
        { new: true, runValidators: true }
    );
    if (!supplier) { res.status(404); throw new Error('Supplier not found'); }
    res.json({ success: true, data: supplier });
});

export const deleteSupplier = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) { res.status(404); throw new Error('Supplier not found'); }
    supplier.deletedAt = new Date();
    supplier.status = 'inactive';
    await supplier.save();
    res.json({ success: true, message: 'Supplier deleted' });
});