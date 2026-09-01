import asyncHandler from 'express-async-handler';
import PackBreakdown from '../models/PackBreakdown.js';
import Product from '../models/Product.js';
import StockItem from '../models/StockItem.js';
import Warehouse from '../models/Warehouse.js';
import { increaseStock, decreaseStock } from '../services/stockService.js';

/**
 * POST /api/stock/pack-breakdowns
 * Unpack packs into retail unit pieces
 */
export const unpackPacks = asyncHandler(async (req, res) => {
    const {
        sourceProductId,
        targetProductId,
        warehouseId,
        packsQuantity,
        unitsPerPack,
        notes = '',
    } = req.body;

    const numPacks = Number(packsQuantity);
    const numUnitsPerPack = Number(unitsPerPack);

    if (!sourceProductId || !targetProductId) {
        res.status(400);
        throw new Error('Both Source Pack Product and Target Unit Product are required');
    }

    if (!warehouseId) {
        res.status(400);
        throw new Error('Warehouse is required');
    }

    if (!numPacks || numPacks <= 0) {
        res.status(400);
        throw new Error('Number of packs must be greater than 0');
    }

    if (!numUnitsPerPack || numUnitsPerPack <= 0) {
        res.status(400);
        throw new Error('Units per pack must be at least 1');
    }

    const sourceProduct = await Product.findById(sourceProductId);
    if (!sourceProduct) {
        res.status(404);
        throw new Error('Source Pack Product not found');
    }

    const targetProduct = await Product.findById(targetProductId);
    if (!targetProduct) {
        res.status(404);
        throw new Error('Target Unit Product not found');
    }

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) {
        res.status(404);
        throw new Error('Warehouse not found');
    }

    // Check source stock
    const sourceStock = await StockItem.findOne({
        productId: sourceProductId,
        warehouseId,
        batchNumber: null,
    });

    const onHand = sourceStock ? sourceStock.quantities.onHand : 0;
    if (onHand < numPacks) {
        res.status(400);
        throw new Error(
            `Insufficient pack stock in warehouse. Current on hand: ${onHand} ${sourceProduct.unitOfMeasure || 'packs'}, requested to unpack: ${numPacks}`
        );
    }

    const sourceCostPerPack = sourceStock?.costPerUnit || sourceProduct.purchasePrice || (sourceProduct.basePrice * 0.8) || 0;
    const totalUnitsProduced = +(numPacks * numUnitsPerPack).toFixed(2);
    const targetCostPerUnit = +(sourceCostPerPack / numUnitsPerPack).toFixed(4);

    const breakdown = new PackBreakdown({
        warehouseId,
        sourceProductId,
        sourceProductCode: sourceProduct.productCode,
        sourceProductName: sourceProduct.name,
        packsQuantity: numPacks,
        sourceCostPerPack,

        targetProductId,
        targetProductCode: targetProduct.productCode,
        targetProductName: targetProduct.name,
        unitsPerPack: numUnitsPerPack,
        totalUnitsProduced,
        targetCostPerUnit,

        notes,
        performedBy: req.user?._id,
    });

    await breakdown.save();

    // 1. Deduct packs from stock
    await decreaseStock({
        productId: sourceProductId,
        warehouseId,
        quantity: numPacks,
        movementType: 'pack_breakdown_out',
        sourceDocument: {
            type: 'pack_breakdown',
            id: breakdown._id,
            number: breakdown.breakdownNumber,
        },
        reason: `Unpacked ${numPacks} packs into ${totalUnitsProduced} ${targetProduct.name}`,
        userId: req.user?._id,
    });

    // 2. Add individual units to stock
    await increaseStock({
        productId: targetProductId,
        warehouseId,
        quantity: totalUnitsProduced,
        costPerUnit: targetCostPerUnit,
        movementType: 'pack_breakdown_in',
        sourceDocument: {
            type: 'pack_breakdown',
            id: breakdown._id,
            number: breakdown.breakdownNumber,
        },
        reason: `Generated from unpacking ${numPacks} x ${sourceProduct.name}`,
        userId: req.user?._id,
    });

    // Make sure target product is active and sellable on POS
    await Product.findByIdAndUpdate(targetProductId, {
        canBeSold: true,
        status: 'active',
    });

    const populated = await PackBreakdown.findById(breakdown._id)
        .populate('warehouseId', 'name warehouseCode')
        .populate('sourceProductId', 'name productCode unitOfMeasure')
        .populate('targetProductId', 'name productCode unitOfMeasure basePrice')
        .populate('performedBy', 'name email');

    res.status(201).json({
        success: true,
        message: `Successfully unpacked ${numPacks} packs into ${totalUnitsProduced} units`,
        data: populated,
    });
});

/**
 * GET /api/stock/pack-breakdowns/history
 * List unpack/breakdown history
 */
export const getBreakdownHistory = asyncHandler(async (req, res) => {
    const {
        warehouseId,
        sourceProductId,
        targetProductId,
        startDate,
        endDate,
        page = 1,
        limit = 30,
    } = req.query;

    const filter = {};
    if (warehouseId) filter.warehouseId = warehouseId;
    if (sourceProductId) filter.sourceProductId = sourceProductId;
    if (targetProductId) filter.targetProductId = targetProductId;

    if (startDate || endDate) {
        filter.breakdownDate = {};
        if (startDate) filter.breakdownDate.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.breakdownDate.$lte = end;
        }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
        PackBreakdown.find(filter)
            .populate('warehouseId', 'name warehouseCode')
            .populate('sourceProductId', 'name productCode unitOfMeasure')
            .populate('targetProductId', 'name productCode unitOfMeasure')
            .populate('performedBy', 'name')
            .sort({ breakdownDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        PackBreakdown.countDocuments(filter),
    ]);

    res.json({
        success: true,
        count: items.length,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        data: items,
    });
});
