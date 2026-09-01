import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import GoodsReceiptNote from '../models/GoodsReceiptNote.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Bill from '../models/Bill.js';
import Payment from '../models/Payment.js';
import Supplier from '../models/Supplier.js';
import { increaseStock, decreaseStock } from '../services/stockService.js';

/**
 * Create a GRN — receives goods, creates Bill, handles optional payment, and increases stock atomically.
 */
export const createGrn = asyncHandler(async (req, res) => {
    const { purchaseOrderId, supplierId, warehouseId, items, ...rest } = req.body;

    let po = null;
    if (purchaseOrderId) {
        po = await PurchaseOrder.findById(purchaseOrderId);
        if (!po) { res.status(404); throw new Error('Purchase order not found'); }
        if (!['approved', 'sent', 'partially_received'].includes(po.status)) {
            res.status(400);
            throw new Error(`Cannot receive against PO with status '${po.status}'`);
        }
    }

    if (!po && !supplierId) {
        res.status(400);
        throw new Error('Supplier ID is required for GRN without Purchase Order');
    }

    const effectiveSupplierId = po?.supplierId || supplierId;
    const supplierDoc = await Supplier.findById(effectiveSupplierId);

    // Validate items against PO if available
    const poItemsMap = po ? new Map(po.items.map((i) => [i._id.toString(), i])) : null;

    const session = await mongoose.startSession();
    let grn;
    let createdBill = null;

    try {
        await session.withTransaction(async () => {
            // Build GRN line items
            const grnItems = items.map((item) => {
                const poLine = (po && item.poLineItemId) ? poItemsMap.get(item.poLineItemId) : null;
                const accepted = item.acceptedQuantity ?? item.receivedQuantity;

                return {
                    poLineItemId: item.poLineItemId,
                    productId: item.productId,
                    productCode: item.productCode || poLine?.productCode || '',
                    productName: item.productName || poLine?.productName || '',
                    orderedQuantity: poLine?.orderedQuantity || 0,
                    receivedQuantity: item.receivedQuantity,
                    acceptedQuantity: accepted,
                    rejectedQuantity: item.rejectedQuantity || 0,
                    damagedQuantity: item.damagedQuantity || 0,
                    discountPercent: item.discountPercent || 0,
                    discountAmount: item.discountAmount || 0,
                    freeQuantity: item.freeQuantity || 0,
                    unitOfMeasure: item.unitOfMeasure || poLine?.unitOfMeasure || '',
                    unitPrice: item.unitPrice || poLine?.unitPrice || 0,
                    batchNumber: item.batchNumber || null,
                    manufactureDate: item.manufactureDate || null,
                    expiryDate: item.expiryDate || null,
                    rejectionReason: item.rejectionReason,
                    notes: item.notes,
                    qcStatus: item.rejectionReason || item.rejectedQuantity > 0 ? 'failed' : 'not_required',
                };
            });

            grn = new GoodsReceiptNote({
                purchaseOrderId: po?._id,
                poNumber: po?.poNumber,
                supplierId: effectiveSupplierId,
                supplierName: po?.supplierSnapshot?.name || supplierDoc?.displayName || rest.supplierName,
                warehouseId,
                items: grnItems,
                status: 'received',
                receivedBy: req.user._id,
                createdBy: req.user._id,
                ...rest,
            });

            await grn.save({ session });

            // Calculate total raw accepted value first (to distribute fixed discount)
            const rawAcceptedValue = grn.items.reduce((s, i) => {
                const qty = i.acceptedQuantity || i.receivedQuantity || 0;
                const lineTotal = qty * i.unitPrice;
                const lineDisc = i.discountAmount || (lineTotal * (i.discountPercent || 0) / 100);
                return s + Math.max(0, lineTotal - lineDisc);
            }, 0);

            // Increase stock for each accepted item
            for (const grnItem of grn.items) {
                const qtyToStock = grnItem.acceptedQuantity + (grnItem.freeQuantity || 0);
                if (qtyToStock <= 0) continue;

                const lineTotal = grnItem.acceptedQuantity * grnItem.unitPrice;
                const lineDiscount = grnItem.discountAmount || (lineTotal * (grnItem.discountPercent || 0) / 100);
                const rawLineCost = Math.max(0, lineTotal - lineDiscount);

                let finalLineCost = rawLineCost;
                if (grn.billDiscountPercent > 0) {
                    finalLineCost = rawLineCost - (rawLineCost * grn.billDiscountPercent / 100);
                }
                if (grn.billDiscountAmount > 0 && rawAcceptedValue > 0) {
                    const proportionalDiscount = grn.billDiscountAmount * (rawLineCost / rawAcceptedValue);
                    finalLineCost = rawLineCost - proportionalDiscount;
                }
                finalLineCost = Math.max(0, finalLineCost);

                const effectiveCostPerUnit = finalLineCost / qtyToStock;

                const result = await increaseStock({
                    productId: grnItem.productId,
                    warehouseId,
                    quantity: qtyToStock,
                    costPerUnit: effectiveCostPerUnit,
                    movementType: 'purchase_receipt',
                    batchNumber: grnItem.batchNumber || null,
                    sourceDocument: {
                        type: 'purchase_receipt',
                        id: grn._id,
                        number: grn.grnNumber,
                    },
                    reason: po ? `GRN against PO ${po.poNumber}` : 'GRN (direct)',
                    userId: req.user._id,
                    session,
                });

                // Link the movement
                grnItem.stockMovementId = result.movement._id;
            }

            await grn.save({ session });

            // Update PO: increment received quantities on lines
            if (po) {
                for (const grnItem of grn.items) {
                    if (!grnItem.poLineItemId) continue;
                    const poLine = po.items.id(grnItem.poLineItemId);
                    if (poLine) {
                        poLine.receivedQuantity = (poLine.receivedQuantity || 0) + grnItem.acceptedQuantity;
                    }
                }
                po.grns = [...(po.grns || []), grn._id];
                await po.save({ session });
            }

            // ── Auto-create Purchase Bill ──
            const billItems = grn.items
                .filter(item => (item.acceptedQuantity || item.receivedQuantity) > 0)
                .map((item, idx) => {
                    const qty = item.acceptedQuantity || item.receivedQuantity || 0;
                    const price = item.unitPrice || 0;
                    const lineGross = qty * price;
                    const discount = item.discountAmount || (lineGross * (item.discountPercent || 0) / 100);
                    const lineNet = Math.max(0, lineGross - discount);

                    return {
                        lineNumber: idx + 1,
                        productId: item.productId,
                        productCode: item.productCode,
                        productName: item.productName,
                        quantity: qty,
                        unitOfMeasure: item.unitOfMeasure || 'pcs',
                        unitPrice: price,
                        discountPercent: item.discountPercent || 0,
                        discountAmount: discount,
                        lineSubtotal: lineGross,
                        lineDiscount: discount,
                        lineTotal: lineNet,
                        grnLineItemId: item._id,
                    };
                });

            const billGrandTotal = grn.totalReceivedValue || grn.totalAcceptedValue || 0;
            const paidAmount = Math.min(billGrandTotal, Number(rest.paidAmount) || 0);
            const balanceDue = Math.max(0, billGrandTotal - paidAmount);

            let paymentStatus = 'unpaid';
            if (paidAmount >= billGrandTotal && billGrandTotal > 0) {
                paymentStatus = 'paid';
            } else if (paidAmount > 0) {
                paymentStatus = 'partially_paid';
            }

            createdBill = new Bill({
                supplierId: effectiveSupplierId,
                supplierSnapshot: {
                    name: supplierDoc?.displayName || rest.supplierName || 'Supplier',
                    code: supplierDoc?.supplierCode || '',
                    taxRegistrationNumber: supplierDoc?.taxRegistrationNumber || '',
                },
                supplierInvoiceNumber: rest.supplierInvoiceNumber || rest.supplierDN || '',
                purchaseOrderIds: po ? [po._id] : [],
                purchaseOrderNumbers: po ? [po.poNumber] : [],
                grnIds: [grn._id],
                grnNumbers: [grn.grnNumber],
                billDate: grn.receiptDate || new Date(),
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                receivedDate: grn.receiptDate || new Date(),
                items: billItems,
                globalDiscountPercent: grn.billDiscountPercent || 0,
                globalDiscountAmount: grn.billDiscountAmount || 0,
                grandTotal: billGrandTotal,
                amountPaid: paidAmount,
                balanceDue,
                paymentStatus,
                status: 'approved',
                notes: rest.notes || `Auto-created bill from GRN ${grn.grnNumber}`,
                approvedBy: req.user._id,
                approvedAt: new Date(),
                createdBy: req.user._id,
            });

            await createdBill.save({ session });

            // Record Payment if paidAmount > 0
            if (paidAmount > 0) {
                const method = rest.paymentMethod === 'bank_transfer' ? 'bank_transfer'
                    : rest.paymentMethod === 'cheque' ? 'cheque'
                    : rest.paymentMethod === 'card' ? 'card' : 'cash';

                const allocations = [];
                let remainingToAllocate = paidAmount;

                // 1. Allocate to the current new bill
                const allocCurrent = Math.min(remainingToAllocate, billGrandTotal);
                if (allocCurrent > 0) {
                    allocations.push({
                        documentType: 'bill',
                        documentId: createdBill._id,
                        documentNumber: createdBill.billNumber,
                        amount: allocCurrent,
                    });
                    remainingToAllocate -= allocCurrent;
                }

                // 2. If excess payment exists, allocate to previous unpaid bills (oldest first)
                if (remainingToAllocate > 0) {
                    const previousUnpaidBills = await Bill.find({
                        supplierId: effectiveSupplierId,
                        _id: { $ne: createdBill._id },
                        status: { $ne: 'cancelled' },
                        paymentStatus: { $in: ['unpaid', 'partially_paid', 'overdue'] },
                    }).sort({ billDate: 1 }).session(session);

                    for (const prevBill of previousUnpaidBills) {
                        if (remainingToAllocate <= 0) break;
                        const due = prevBill.balanceDue || (prevBill.grandTotal - (prevBill.amountPaid || 0));
                        if (due <= 0) continue;

                        const allocPrev = Math.min(remainingToAllocate, due);
                        allocations.push({
                            documentType: 'bill',
                            documentId: prevBill._id,
                            documentNumber: prevBill.billNumber,
                            amount: allocPrev,
                        });

                        prevBill.amountPaid = (prevBill.amountPaid || 0) + allocPrev;
                        prevBill.balanceDue = Math.max(0, due - allocPrev);
                        prevBill.paymentStatus = prevBill.balanceDue === 0 ? 'paid' : 'partially_paid';
                        if (prevBill.balanceDue === 0) prevBill.fullyPaidAt = new Date();
                        await prevBill.save({ session });

                        remainingToAllocate -= allocPrev;
                    }
                }

                const payment = new Payment({
                    direction: 'paid',
                    supplierId: effectiveSupplierId,
                    partyName: supplierDoc?.displayName || rest.supplierName || 'Supplier',
                    amount: paidAmount,
                    method,
                    bankAccountId: rest.bankAccountId || undefined,
                    chequeNumber: rest.chequeNumber || undefined,
                    transactionReference: rest.paymentReference || undefined,
                    paymentDate: grn.receiptDate || new Date(),
                    status: 'confirmed',
                    notes: `Payment on GRN ${grn.grnNumber} (Bill ${createdBill.billNumber})`,
                    allocations,
                    createdBy: req.user._id,
                });

                await payment.save({ session });
            }
        });

        const populated = await GoodsReceiptNote.findById(grn._id)
            .populate('purchaseOrderId', 'poNumber')
            .populate('supplierId', 'displayName supplierCode')
            .populate('warehouseId', 'name warehouseCode')
            .populate('items.productId', 'name productCode');

        res.status(201).json({
            success: true,
            message: 'Goods received, Bill generated, and stock updated successfully',
            data: populated,
            bill: createdBill,
        });
    } catch (err) {
        res.status(400);
        throw new Error(err.message || 'Failed to create GRN');
    } finally {
        session.endSession();
    }
});

export const getGrns = asyncHandler(async (req, res) => {
    const {
        search, purchaseOrderId, supplierId, warehouseId, status,
        page = 1, limit = 20,
    } = req.query;

    const filter = {};
    if (search) filter.grnNumber = { $regex: search, $options: 'i' };
    if (purchaseOrderId) filter.purchaseOrderId = purchaseOrderId;
    if (supplierId) filter.supplierId = supplierId;
    if (warehouseId) filter.warehouseId = warehouseId;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [grns, total] = await Promise.all([
        GoodsReceiptNote.find(filter)
            .populate('purchaseOrderId', 'poNumber')
            .populate('supplierId', 'displayName supplierCode')
            .populate('warehouseId', 'name warehouseCode')
            .sort({ receiptDate: -1 })
            .skip(skip).limit(Number(limit)),
        GoodsReceiptNote.countDocuments(filter),
    ]);

    res.json({
        success: true,
        count: grns.length, total,
        page: Number(page), totalPages: Math.ceil(total / Number(limit)),
        data: grns,
    });
});

export const getGrnById = asyncHandler(async (req, res) => {
    const grn = await GoodsReceiptNote.findById(req.params.id)
        .populate('purchaseOrderId', 'poNumber poDate')
        .populate('supplierId', 'displayName supplierCode')
        .populate('warehouseId', 'name warehouseCode')
        .populate('items.productId', 'name productCode')
        .populate('items.stockMovementId', 'movementNumber')
        .populate('receivedBy', 'firstName lastName')
        .populate('createdBy', 'firstName lastName');
    if (!grn) { res.status(404); throw new Error('GRN not found'); }
    res.json({ success: true, data: grn });
});

/**
 * Cancel a GRN — reverses stock increase and updates linked PO.
 */
export const cancelGrn = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const grn = await GoodsReceiptNote.findById(req.params.id).session(session);
            if (!grn) throw new Error('GRN not found');
            if (grn.status === 'cancelled') throw new Error('GRN already cancelled');

            // 1. Decrease stock for each accepted item in the GRN
            for (const grnItem of grn.items) {
                const qtyToStock = grnItem.acceptedQuantity + (grnItem.freeQuantity || 0);
                if (qtyToStock <= 0) continue;

                await decreaseStock({
                    productId: grnItem.productId,
                    warehouseId: grn.warehouseId,
                    quantity: qtyToStock,
                    movementType: 'adjustment_out', // Or 'grn_cancellation'
                    batchNumber: grnItem.batchNumber || null,
                    sourceDocument: {
                        type: 'grn_cancellation',
                        id: grn._id,
                        number: grn.grnNumber,
                    },
                    reason: `Cancellation of GRN ${grn.grnNumber}`,
                    userId: req.user._id,
                    session,
                });
            }

            // 2. Revert PO received quantities if linked
            if (grn.purchaseOrderId) {
                const po = await PurchaseOrder.findById(grn.purchaseOrderId).session(session);
                if (po) {
                    for (const grnItem of grn.items) {
                        if (!grnItem.poLineItemId) continue;
                        const poLine = po.items.id(grnItem.poLineItemId);
                        if (poLine) {
                            poLine.receivedQuantity = Math.max(0, (poLine.receivedQuantity || 0) - grnItem.acceptedQuantity);
                        }
                    }
                    // Remove this GRN from PO's list? Or keep it with cancelled status?
                    // Usually we keep the link.
                    await po.save({ session });
                }
            }

            // 3. Cancel linked Bill
            await Bill.updateMany(
                { grnIds: grn._id },
                { status: 'cancelled', paymentStatus: 'cancelled' }
            ).session(session);

            grn.status = 'cancelled';
            grn.cancelledAt = new Date();
            grn.cancelledBy = req.user._id;
            await grn.save({ session });
        });

        res.json({ success: true, message: 'GRN cancelled and stock reversed' });
    } catch (err) {
        res.status(400);
        throw new Error(err.message || 'Failed to cancel GRN');
    } finally {
        session.endSession();
    }
});