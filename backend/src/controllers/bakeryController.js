import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import BakeryTemplate from '../models/BakeryTemplate.js';
import BakeryDailyEntry from '../models/BakeryDailyEntry.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Supplier from '../models/Supplier.js';
import Warehouse from '../models/Warehouse.js';
import StockItem from '../models/StockItem.js';
import Payment from '../models/Payment.js';
import { increaseStock, decreaseStock } from '../services/stockService.js';

/**
 * GET /api/bakery/templates
 * List all saved supplier templates
 */
export const getAllTemplates = asyncHandler(async (req, res) => {
    const templates = await BakeryTemplate.find({})
        .populate('supplierId', 'displayName supplierCode companyName phone')
        .populate('items.productId', 'name productCode unitOfMeasure basePrice purchasePrice')
        .sort({ updatedAt: -1 });

    res.json({
        success: true,
        count: templates.length,
        data: templates,
    });
});

/**
 * GET /api/bakery/templates/:supplierId
 * Get template for a supplier
 */
export const getSupplierTemplate = asyncHandler(async (req, res) => {
    const { supplierId } = req.params;

    let template = await BakeryTemplate.findOne({ supplierId })
        .populate('supplierId', 'displayName supplierCode companyName phone')
        .populate('items.productId', 'name productCode unitOfMeasure basePrice purchasePrice barcode');

    if (!template) {
        // Return blank structure if not created yet
        return res.json({
            success: true,
            data: {
                supplierId,
                templateName: 'Daily Bakery & Short Eats Structure',
                items: [],
            },
        });
    }

    res.json({
        success: true,
        data: template,
    });
});

/**
 * POST /api/bakery/templates/:supplierId
 * Save or update template for a supplier
 */
export const saveSupplierTemplate = asyncHandler(async (req, res) => {
    const { supplierId } = req.params;
    const { templateName, items = [], notes } = req.body;

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
        res.status(404);
        throw new Error('Supplier not found');
    }

    // Process items: if item has no productId but has productName, find or create the Product
    const processedItems = [];
    let defaultCategory = null;

    for (const rawItem of items) {
        const itemName = (rawItem.productName || rawItem.name || '').trim();
        if (!itemName && !rawItem.productId) continue;

        let productId = rawItem.productId;
        let finalProductName = itemName;
        let productCode = rawItem.productCode || '';

        if (productId) {
            const existingProduct = await Product.findById(productId);
            if (existingProduct) {
                let updated = false;
                if (!existingProduct.isBakeryItem) {
                    existingProduct.isBakeryItem = true;
                    updated = true;
                }
                if (itemName && existingProduct.name !== itemName) {
                    existingProduct.name = itemName;
                    updated = true;
                }
                const buyPrice = Number(rawItem.defaultBuyPrice) || 0;
                const sellPrice = Number(rawItem.defaultSellPrice) || 0;
                if (buyPrice > 0 && existingProduct.purchasePrice !== buyPrice) {
                    existingProduct.purchasePrice = buyPrice;
                    updated = true;
                }
                if (sellPrice > 0 && existingProduct.basePrice !== sellPrice) {
                    existingProduct.basePrice = sellPrice;
                    updated = true;
                }
                if (updated) await existingProduct.save();

                finalProductName = existingProduct.name;
                productCode = existingProduct.productCode;
            }
        } else if (itemName) {
            let existingProd = await Product.findOne({
                name: { $regex: new RegExp(`^${itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            });

            if (!existingProd) {
                if (!defaultCategory) {
                    defaultCategory = await Category.findOne({ name: { $regex: /bakery|food/i } });
                    if (!defaultCategory) {
                        defaultCategory = await Category.findOne({ isActive: true });
                    }
                    if (!defaultCategory) {
                        defaultCategory = await Category.create({
                            name: 'Bakery & Short Eats',
                            code: 'CAT-BAKERY',
                            type: 'product',
                            createdBy: req.user?._id,
                        });
                    }
                }

                existingProd = await Product.create({
                    name: itemName,
                    categoryId: defaultCategory._id,
                    purchasePrice: Number(rawItem.defaultBuyPrice) || 0,
                    basePrice: Number(rawItem.defaultSellPrice) || 0,
                    unitOfMeasure: rawItem.unitOfMeasure || 'pcs',
                    productType: 'finished_good',
                    isBakeryItem: true,
                    canBePurchased: true,
                    canBeSold: true,
                    createdBy: req.user?._id,
                });
            } else {
                // Update selling and purchase price on existing product if provided
                let updated = false;
                if (!existingProd.isBakeryItem) {
                    existingProd.isBakeryItem = true;
                    updated = true;
                }
                if (rawItem.defaultSellPrice !== undefined && Number(rawItem.defaultSellPrice) > 0) {
                    existingProd.basePrice = Number(rawItem.defaultSellPrice);
                    updated = true;
                }
                if (rawItem.defaultBuyPrice !== undefined && Number(rawItem.defaultBuyPrice) > 0) {
                    existingProd.purchasePrice = Number(rawItem.defaultBuyPrice);
                    updated = true;
                }
                if (updated) await existingProd.save();
            }

            productId = existingProd._id;
            finalProductName = existingProd.name;
            productCode = existingProd.productCode;
        }

        if (productId) {
            processedItems.push({
                productId,
                productName: finalProductName,
                productCode,
                defaultBuyPrice: Number(rawItem.defaultBuyPrice) || 0,
                defaultSellPrice: Number(rawItem.defaultSellPrice) || 0,
                unitOfMeasure: rawItem.unitOfMeasure || 'pcs',
            });
        }
    }

    let template = await BakeryTemplate.findOne({ supplierId });

    if (!template) {
        template = new BakeryTemplate({
            supplierId,
            templateName: templateName || `${supplier.displayName} Item Structure`,
            items: processedItems,
            notes,
            updatedBy: req.user?._id,
        });
    } else {
        template.templateName = templateName || template.templateName;
        template.items = processedItems;
        template.notes = notes;
        template.updatedBy = req.user?._id;
    }

    await template.save();

    const populated = await BakeryTemplate.findById(template._id)
        .populate('supplierId', 'displayName supplierCode companyName')
        .populate('items.productId', 'name productCode unitOfMeasure basePrice purchasePrice barcode');

    res.json({
        success: true,
        message: 'Supplier bakery template saved successfully',
        data: populated,
    });
});

/**
 * GET /api/bakery/balance/:supplierId
 * Get current carried forward balance for a supplier
 */
export const getSupplierBalance = asyncHandler(async (req, res) => {
    const { supplierId } = req.params;

    // Find the latest confirmed daily entry for this supplier
    const lastEntry = await BakeryDailyEntry.findOne({
        supplierId,
        status: 'confirmed',
    }).sort({ entryDate: -1, createdAt: -1 });

    const balance = lastEntry ? (lastEntry.financials?.closingBalance || 0) : 0;

    res.json({
        success: true,
        data: {
            supplierId,
            outstandingBalance: balance,
            lastEntryDate: lastEntry ? lastEntry.entryDate : null,
            lastEntryNumber: lastEntry ? lastEntry.entryNumber : null,
        },
    });
});

/**
 * POST /api/bakery/entries
 * Create and confirm a daily stock receiving and settlement entry
 */
export const createDailyEntry = asyncHandler(async (req, res) => {
    const {
        supplierId,
        warehouseId,
        entryDate = new Date(),
        items = [],
        financials = {},
        notes = '',
    } = req.body;

    if (!supplierId) {
        res.status(400);
        throw new Error('Supplier is required');
    }
    if (!warehouseId) {
        res.status(400);
        throw new Error('Warehouse is required');
    }
    if (!items || items.length === 0) {
        res.status(400);
        throw new Error('At least one item is required in the daily entry');
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
        res.status(404);
        throw new Error('Supplier not found');
    }

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) {
        res.status(404);
        throw new Error('Warehouse not found');
    }

    // Format items and compute line totals
    const processedItems = [];
    for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;

        const buyPrice = Number(item.buyPrice) || 0;
        const sellPrice = Number(item.sellPrice) || 0;
        const unitProfit = +(sellPrice - buyPrice).toFixed(2);
        const receivedQty = Number(item.receivedQty) || 0;
        const returnedQty = Number(item.returnedQty) || 0;
        const netQty = +(receivedQty - returnedQty).toFixed(2);
        const lineSupplyTotal = +(receivedQty * buyPrice).toFixed(2);
        const lineReturnTotal = +(returnedQty * buyPrice).toFixed(2);
        const lineExpectedProfit = +(netQty * unitProfit).toFixed(2);

        const itemName = (item.productName || product.name || '').trim();

        processedItems.push({
            productId: product._id,
            productCode: product.productCode,
            productName: itemName,
            buyPrice,
            sellPrice,
            unitProfit,
            receivedQty,
            returnedQty,
            netQty,
            lineSupplyTotal,
            lineReturnTotal,
            lineExpectedProfit,
        });
    }

    const entry = new BakeryDailyEntry({
        supplierId,
        warehouseId,
        entryDate,
        items: processedItems,
        financials: {
            previousBalance: Number(financials.previousBalance) || 0,
            paidAmount: Number(financials.paidAmount) || 0,
            paymentMethod: financials.paymentMethod || 'cash',
            paymentReference: financials.paymentReference || '',
        },
        status: 'confirmed',
        notes,
        createdBy: req.user?._id,
    });

    await entry.save();

    // Now update inventory and POS prices for each item
    for (const item of processedItems) {
        // Update product selling, purchase prices and name so POS and slips show latest details
        await Product.findByIdAndUpdate(item.productId, {
            name: item.productName,
            basePrice: item.sellPrice,
            purchasePrice: item.buyPrice,
            isBakeryItem: true,
            canBeSold: true,
            status: 'active',
        });

        // 1. Set Stock to Fresh Received Quantity for today
        if (item.receivedQty > 0) {
            let stockItem = await StockItem.findOne({ productId: item.productId, warehouseId });
            if (!stockItem) {
                stockItem = new StockItem({
                    productId: item.productId,
                    productCode: item.productCode,
                    productName: item.productName,
                    warehouseId,
                    costPerUnit: item.buyPrice,
                    quantities: { onHand: item.receivedQty, reserved: 0, available: item.receivedQty }
                });
            } else {
                stockItem.quantities.onHand = item.receivedQty;
                stockItem.costPerUnit = item.buyPrice;
                stockItem.quantities.available = Math.max(0, item.receivedQty - (stockItem.quantities.reserved || 0));
                stockItem.lastMovementDate = new Date();
            }
            await stockItem.save();
        }
    }

    // Record formal Payment record for supplier payment tracking
    if (Number(financials.paidAmount) > 0) {
        try {
            const Payment = (await import('../models/Payment.js')).default;
            await Payment.create({
                direction: 'paid',
                supplierId,
                partyName: supplier.displayName,
                amount: Number(financials.paidAmount),
                paymentDate: entryDate || new Date(),
                method: financials.paymentMethod === 'bank_transfer' ? 'bank_transfer' : financials.paymentMethod === 'cheque' ? 'cheque' : 'cash',
                bankAccountId: financials.bankAccountId || undefined,
                chequeNumber: financials.chequeNumber || undefined,
                transactionReference: financials.paymentReference || undefined,
                status: 'confirmed',
                notes: `Bakery daily delivery settlement payment for ${entry.entryNumber}`,
                createdBy: req.user?._id,
            });
        } catch (payErr) {
            console.warn('Auto-create payment record for bakery settlement:', payErr.message);
        }
    }

    const populatedEntry = await BakeryDailyEntry.findById(entry._id)
        .populate('supplierId', 'displayName supplierCode companyName phone')
        .populate('warehouseId', 'name warehouseCode')
        .populate('financials.bankAccountId', 'accountName bankName')
        .populate('createdBy', 'name email');

    res.status(201).json({
        success: true,
        message: 'Daily bakery entry recorded and stock updated successfully',
        data: populatedEntry,
    });
});

/**
 * GET /api/bakery/entries
 * List all daily entries with filters
 */
export const getDailyEntries = asyncHandler(async (req, res) => {
    const {
        supplierId,
        warehouseId,
        startDate,
        endDate,
        page = 1,
        limit = 30,
    } = req.query;

    const filter = {};
    if (supplierId) filter.supplierId = supplierId;
    if (warehouseId) filter.warehouseId = warehouseId;
    if (startDate || endDate) {
        filter.entryDate = {};
        if (startDate) filter.entryDate.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.entryDate.$lte = end;
        }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [entries, total] = await Promise.all([
        BakeryDailyEntry.find(filter)
            .populate('supplierId', 'displayName supplierCode phone')
            .populate('warehouseId', 'name warehouseCode')
            .populate('createdBy', 'name')
            .sort({ entryDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        BakeryDailyEntry.countDocuments(filter),
    ]);

    res.json({
        success: true,
        count: entries.length,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        data: entries,
    });
});

/**
 * GET /api/bakery/entries/:id
 * Get single entry by ID
 */
export const getDailyEntryById = asyncHandler(async (req, res) => {
    const entry = await BakeryDailyEntry.findById(req.params.id)
        .populate('supplierId', 'displayName supplierCode companyName phone address')
        .populate('warehouseId', 'name warehouseCode')
        .populate('items.productId', 'name productCode barcode unitOfMeasure')
        .populate('createdBy', 'name email');

    if (!entry) {
        res.status(404);
        throw new Error('Daily entry not found');
    }

    res.json({
        success: true,
        data: entry,
    });
});

/**
 * GET /api/bakery/statement/:supplierId
 * Get comprehensive supplier ledger statement
 */
export const getSupplierStatement = asyncHandler(async (req, res) => {
    const { supplierId } = req.params;
    const { startDate, endDate } = req.query;

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
        res.status(404);
        throw new Error('Supplier not found');
    }

    const filter = { supplierId, status: 'confirmed' };
    if (startDate || endDate) {
        filter.entryDate = {};
        if (startDate) filter.entryDate.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.entryDate.$lte = end;
        }
    }

    const entries = await BakeryDailyEntry.find(filter)
        .sort({ entryDate: 1, createdAt: 1 })
        .populate('warehouseId', 'name');

    // Summary calculations
    let totalGrossSupply = 0;
    let totalReturns = 0;
    let totalNetSupply = 0;
    let totalPaid = 0;

    entries.forEach((e) => {
        totalGrossSupply += e.financials?.grossSupplyAmount || 0;
        totalReturns += e.financials?.totalReturnAmount || 0;
        totalNetSupply += e.financials?.netSupplyAmount || 0;
        totalPaid += e.financials?.paidAmount || 0;
    });

    const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    const currentOutstanding = latestEntry ? (latestEntry.financials?.closingBalance || 0) : 0;

    res.json({
        success: true,
        data: {
            supplier: {
                _id: supplier._id,
                name: supplier.displayName,
                code: supplier.supplierCode,
                phone: supplier.primaryContact?.phone || supplier.primaryContact?.mobile,
            },
            summary: {
                totalGrossSupply: +totalGrossSupply.toFixed(2),
                totalReturns: +totalReturns.toFixed(2),
                totalNetSupply: +totalNetSupply.toFixed(2),
                totalPaid: +totalPaid.toFixed(2),
                currentOutstanding: +currentOutstanding.toFixed(2),
                entriesCount: entries.length,
            },
            statement: entries,
        },
    });
});

/**
 * POST /api/bakery/payments
 * Record a partial or full payment against a supplier balance / delivery entry
 */
export const recordSupplierPayment = asyncHandler(async (req, res) => {
    const {
        supplierId,
        entryId,
        amount,
        returnAmount = 0, // Returns handed over during settlement payment
        returnItems = [], // Item-wise returns [{ productId, productName, returnQty, buyPrice }]
        paymentDate = new Date(),
        paymentMethod = 'cash',
        bankAccountId,
        chequeNumber,
        paymentReference,
        notes = '',
    } = req.body;

    const payAmount = Number(amount) || 0;

    // Calculate total return deduction from returnItems if provided, else from returnAmount
    let itemwiseReturnTotal = 0;
    const validReturnItems = Array.isArray(returnItems)
        ? returnItems.filter((i) => Number(i.returnQty) > 0)
        : [];

    if (validReturnItems.length > 0) {
        itemwiseReturnTotal = validReturnItems.reduce(
            (sum, it) => sum + (Number(it.returnQty) * (Number(it.buyPrice) || 0)),
            0
        );
    }

    const retAmount = itemwiseReturnTotal > 0 ? +itemwiseReturnTotal.toFixed(2) : (Number(returnAmount) || 0);

    if (payAmount <= 0 && retAmount <= 0) {
        res.status(400);
        throw new Error('Please enter a valid payment amount or return deduction amount greater than 0');
    }

    let supplier = null;
    let entry = null;

    if (entryId) {
        entry = await BakeryDailyEntry.findById(entryId).populate('supplierId');
        if (!entry) {
            res.status(404);
            throw new Error('Delivery entry not found');
        }
        supplier = entry.supplierId;
    } else if (supplierId) {
        supplier = await Supplier.findById(supplierId);
        if (!supplier) {
            res.status(404);
            throw new Error('Supplier not found');
        }
    } else {
        res.status(400);
        throw new Error('Either entryId or supplierId is required');
    }

    // Update the specific daily entry if linked
    if (entry) {
        // If item-wise returns provided, update individual item returnedQty and stock
        if (validReturnItems.length > 0) {
            for (const retItem of validReturnItems) {
                const rQty = Number(retItem.returnQty) || 0;
                if (rQty <= 0) continue;

                const existingItem = entry.items.find(
                    (it) => (it.productId?.toString() === retItem.productId?.toString()) || (it.productName === retItem.productName)
                );

                if (existingItem) {
                    existingItem.returnedQty = (Number(existingItem.returnedQty) || 0) + rQty;
                    existingItem.netQty = +(existingItem.receivedQty - existingItem.returnedQty).toFixed(2);
                    existingItem.lineReturnTotal = +(existingItem.returnedQty * existingItem.buyPrice).toFixed(2);
                } else {
                    entry.items.push({
                        productId: retItem.productId,
                        productName: retItem.productName,
                        buyPrice: Number(retItem.buyPrice) || 0,
                        sellPrice: Number(retItem.sellPrice) || Number(retItem.buyPrice) || 0,
                        receivedQty: 0,
                        returnedQty: rQty,
                        netQty: -rQty,
                        lineSupplyTotal: 0,
                        lineReturnTotal: +(rQty * (Number(retItem.buyPrice) || 0)).toFixed(2),
                    });
                }

                // Deduct returned items from StockItem
                try {
                    const stockItem = await StockItem.findOne({ productId: retItem.productId, warehouseId: entry.warehouseId });
                    if (stockItem) {
                        stockItem.quantities.onHand = Math.max(0, stockItem.quantities.onHand - rQty);
                        stockItem.quantities.available = Math.max(0, stockItem.quantities.onHand - (stockItem.quantities.reserved || 0));
                        await stockItem.save();
                    }
                } catch (stockErr) {
                    console.warn('Deduct return stock on payment:', stockErr.message);
                }
            }
        }

        // Recalculate total returns & financials
        if (retAmount > 0) {
            const currentReturns = Number(entry.financials?.totalReturnAmount) || 0;
            const newReturns = +(currentReturns + retAmount).toFixed(2);
            const gross = Number(entry.financials?.grossSupplyAmount) || 0;
            const prevBal = Number(entry.financials?.previousBalance) || 0;
            const newNetSupply = Math.max(0, +(gross - newReturns).toFixed(2));
            const newTotalPayable = Math.max(0, +(prevBal + newNetSupply).toFixed(2));

            entry.financials.totalReturnAmount = newReturns;
            entry.financials.netSupplyAmount = newNetSupply;
            entry.financials.totalPayable = newTotalPayable;
        }

        const currentPaid = Number(entry.financials?.paidAmount) || 0;
        const newPaid = +(currentPaid + payAmount).toFixed(2);
        const totalPayable = Number(entry.financials?.totalPayable) || 0;
        const newClosing = Math.max(0, +(totalPayable - newPaid).toFixed(2));

        entry.financials.paidAmount = newPaid;
        entry.financials.closingBalance = newClosing;
        if (paymentMethod) entry.financials.paymentMethod = paymentMethod;
        if (bankAccountId) entry.financials.bankAccountId = bankAccountId;
        if (chequeNumber) entry.financials.chequeNumber = chequeNumber;
        if (paymentReference) entry.financials.paymentReference = paymentReference;

        await entry.save();
    }

    // Create formal Payment record in financial ledger
    let paymentDoc = null;
    if (payAmount > 0) {
        try {
            paymentDoc = await Payment.create({
                direction: 'paid',
                supplierId: supplier._id,
                partyName: supplier.displayName,
                amount: payAmount,
                paymentDate,
                method: paymentMethod === 'bank_transfer' ? 'bank_transfer' : paymentMethod === 'cheque' ? 'cheque' : 'cash',
                bankAccountId: bankAccountId || undefined,
                chequeNumber: chequeNumber || undefined,
                transactionReference: paymentReference || (entry ? entry.entryNumber : `BAK-PAY-${Date.now()}`),
                notes: notes || (entry ? `Settlement payment for delivery ${entry.entryNumber}${retAmount > 0 ? ` (Deducted Rs. ${retAmount} returns)` : ''}` : `Bakery settlement payment to ${supplier.displayName}`),
                status: 'confirmed',
                createdBy: req.user?._id,
            });
        } catch (err) {
            console.warn('Financial payment record logging:', err.message);
        }
    }

    res.status(201).json({
        success: true,
        message: payAmount > 0 
            ? `Payment of Rs. ${payAmount.toFixed(2)}${retAmount > 0 ? ` (with Rs. ${retAmount.toFixed(2)} return deduction)` : ''} recorded successfully for ${supplier.displayName}`
            : `Return deduction of Rs. ${retAmount.toFixed(2)} recorded successfully for ${supplier.displayName}`,
        data: {
            entry,
            payment: paymentDoc,
        },
    });
});

/**
 * GET /api/bakery/stock
 * Get dedicated live stock levels for all Bakery & Short Eats products
 */
export const getBakeryStockLevels = asyncHandler(async (req, res) => {
    const { warehouseId, supplierId, search, itemType } = req.query;

    // 1. Find all bakery products
    const productQuery = { isBakeryItem: true, isActive: true };
    if (search) {
        productQuery.$or = [
            { name: { $regex: search, $options: 'i' } },
            { productCode: { $regex: search, $options: 'i' } },
            { barcode: { $regex: search, $options: 'i' } },
        ];
    }
    if (supplierId) {
        productQuery.primarySupplierId = supplierId;
    }

    const bakeryProducts = await Product.find(productQuery)
        .populate('primarySupplierId', 'displayName supplierCode companyName phone')
        .populate('categoryId', 'name')
        .lean();

    const productIds = bakeryProducts.map((p) => p._id);

    // 2. Fetch stock items
    const stockQuery = { productId: { $in: productIds } };
    if (warehouseId) {
        stockQuery.warehouseId = warehouseId;
    }

    const stockDocs = await StockItem.find(stockQuery)
        .populate('warehouseId', 'name warehouseCode isDefault')
        .lean();

    // Map stocks by productId
    const stockByProduct = new Map();
    for (const s of stockDocs) {
        const pId = s.productId.toString();
        if (!stockByProduct.has(pId)) {
            stockByProduct.set(pId, []);
        }
        stockByProduct.get(pId).push(s);
    }

    // 3. Fetch template item configs (for shelf life and returnable flags)
    const templates = await BakeryTemplate.find({}).lean();
    const templateItemMap = new Map();
    for (const t of templates) {
        for (const item of (t.items || [])) {
            if (item.productId) {
                templateItemMap.set(item.productId.toString(), {
                    isDailyReturnable: item.isDailyReturnable !== false,
                    shelfLifeDays: item.shelfLifeDays || 1,
                    supplierId: t.supplierId,
                });
            }
        }
    }

    // 4. Combine into final bakery stock list
    let stockList = bakeryProducts.map((prod) => {
        const stocks = stockByProduct.get(prod._id.toString()) || [];
        const totalOnHand = stocks.reduce((acc, s) => acc + (s.quantities?.onHand || 0), 0);
        const totalAvailable = stocks.reduce((acc, s) => acc + (s.quantities?.available ?? s.quantities?.onHand ?? 0), 0);
        const totalReserved = stocks.reduce((acc, s) => acc + (s.quantities?.reserved || 0), 0);

        const tmplConfig = templateItemMap.get(prod._id.toString());
        const isDailyReturnable = tmplConfig ? tmplConfig.isDailyReturnable : true;
        const shelfLifeDays = tmplConfig ? tmplConfig.shelfLifeDays : 1;

        const buyPrice = prod.purchasePrice || 0;
        const sellPrice = prod.basePrice || 0;
        const unitProfit = Math.max(0, +(sellPrice - buyPrice).toFixed(2));
        const totalRetailValue = +(totalOnHand * sellPrice).toFixed(2);
        const totalCostValue = +(totalOnHand * buyPrice).toFixed(2);

        let status = 'in_stock';
        if (totalOnHand <= 0) {
            status = 'out_of_stock';
        } else if (totalOnHand <= 5) {
            status = 'low_stock';
        }

        return {
            _id: prod._id,
            productId: prod._id,
            productCode: prod.productCode || '',
            productName: prod.name,
            barcode: prod.barcode || '',
            unitOfMeasure: prod.unitOfMeasure || 'pcs',
            categoryName: prod.categoryId?.name || 'Bakery & Short Eats',
            supplier: prod.primarySupplierId ? {
                _id: prod.primarySupplierId._id,
                name: prod.primarySupplierId.displayName,
                code: prod.primarySupplierId.supplierCode,
            } : null,
            isDailyReturnable,
            shelfLifeDays,
            buyPrice,
            sellPrice,
            unitProfit,
            onHand: totalOnHand,
            available: totalAvailable,
            reserved: totalReserved,
            totalRetailValue,
            totalCostValue,
            status,
            warehouses: stocks.map((st) => ({
                warehouseId: st.warehouseId?._id,
                warehouseName: st.warehouseId?.name,
                onHand: st.quantities?.onHand || 0,
            })),
        };
    });

    if (itemType === 'shelf') {
        stockList = stockList.filter((item) => !item.isDailyReturnable);
    } else if (itemType === 'daily') {
        stockList = stockList.filter((item) => item.isDailyReturnable);
    }

    // Summary calculations
    const totalUnitsOnHand = stockList.reduce((sum, i) => sum + i.onHand, 0);
    const totalRetailValue = stockList.reduce((sum, i) => sum + i.totalRetailValue, 0);
    const totalCostValue = stockList.reduce((sum, i) => sum + i.totalCostValue, 0);
    const lowStockCount = stockList.filter((i) => i.status === 'low_stock').length;
    const outOfStockCount = stockList.filter((i) => i.status === 'out_of_stock').length;
    const dailyFreshCount = stockList.filter((i) => i.isDailyReturnable).length;
    const multiDayShelfCount = stockList.filter((i) => !i.isDailyReturnable).length;

    res.json({
        success: true,
        count: stockList.length,
        data: stockList,
        summary: {
            totalItems: stockList.length,
            totalUnitsOnHand,
            totalRetailValue: +totalRetailValue.toFixed(2),
            totalCostValue: +totalCostValue.toFixed(2),
            expectedGrossProfit: +(totalRetailValue - totalCostValue).toFixed(2),
            lowStockCount,
            outOfStockCount,
            dailyFreshCount,
            multiDayShelfCount,
        },
    });
});
