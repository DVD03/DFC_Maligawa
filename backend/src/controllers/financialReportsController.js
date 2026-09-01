import asyncHandler from 'express-async-handler';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import EmployeeWagePayment from '../models/EmployeeWagePayment.js';
import CustomerReturn from '../models/CustomerReturn.js';
import DamageRecord from '../models/DamageRecord.js';
import BakeryDailyEntry from '../models/BakeryDailyEntry.js';

export const getProfitAndLoss = asyncHandler(async (req, res) => {
    const { startDate, endDate, categoryId, warehouseId } = req.query;

    const dateFilter = {};
    if (startDate && startDate !== 'undefined') dateFilter.$gte = new Date(startDate);
    if (endDate && endDate !== 'undefined') {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
    }

    // 1. Fetch Invoices
    const invoiceFilter = {
        status: { $nin: ['draft', 'void', 'cancelled'] },
        deletedAt: null,
    };
    if (Object.keys(dateFilter).length > 0) {
        invoiceFilter.invoiceDate = { ...dateFilter };
    }
    if (warehouseId) {
        invoiceFilter.sourceWarehouseId = warehouseId;
    }

    const invoices = await Invoice.find(invoiceFilter)
        .populate({
            path: 'items.productId',
            select: 'name productCode categoryId purchasePrice basePrice',
            populate: { path: 'categoryId', select: 'name code' },
        });

    let grossSales = 0;
    let totalDiscounts = 0;
    let totalTax = 0;
    let cogs = 0;

    const categoryMap = new Map();
    const dailyMap = new Map();

    invoices.forEach((inv) => {
        const invDateStr = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : 'Unknown';

        inv.items.forEach((item) => {
            const product = item.productId;
            const itemCatId = product?.categoryId?._id?.toString() || product?.categoryId?.toString() || 'uncategorized';
            const itemCatName = product?.categoryId?.name || 'Uncategorized';

            // If category filter is applied, skip items not belonging to this category
            if (categoryId && categoryId !== 'all' && itemCatId !== categoryId) {
                return;
            }

            const qty = item.quantity || 0;
            const unitPrice = item.unitPrice || 0;
            const lineSubtotal = item.lineSubtotal || (qty * unitPrice);
            const lineDiscount = item.lineDiscount || 0;
            const lineTotal = item.lineTotal || (lineSubtotal - lineDiscount);

            const costPerUnit = product?.purchasePrice || (unitPrice * 0.7) || 0;
            const lineCogs = qty * costPerUnit;

            grossSales += lineSubtotal;
            totalDiscounts += lineDiscount;
            cogs += lineCogs;

            // Category breakdown
            if (!categoryMap.has(itemCatId)) {
                categoryMap.set(itemCatId, {
                    categoryId: itemCatId,
                    categoryName: itemCatName,
                    revenue: 0,
                    cogs: 0,
                    grossProfit: 0,
                    itemsSold: 0,
                });
            }
            const catStat = categoryMap.get(itemCatId);
            catStat.revenue += lineTotal;
            catStat.cogs += lineCogs;
            catStat.grossProfit += (lineTotal - lineCogs);
            catStat.itemsSold += qty;

            // Daily trend
            if (!dailyMap.has(invDateStr)) {
                dailyMap.set(invDateStr, {
                    date: invDateStr,
                    revenue: 0,
                    cogs: 0,
                    expenses: 0,
                    wages: 0,
                    grossProfit: 0,
                    netProfit: 0,
                });
            }
            const dayStat = dailyMap.get(invDateStr);
            dayStat.revenue += lineTotal;
            dayStat.cogs += lineCogs;
            dayStat.grossProfit += (lineTotal - lineCogs);
        });
    });

    const totalRevenue = +(grossSales - totalDiscounts).toFixed(2);
    const grossProfit = +(totalRevenue - cogs).toFixed(2);
    const grossMarginPercent = totalRevenue > 0 ? +((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

    // 2. Fetch Labor & Wages
    const wageFilter = { status: 'paid' };
    if (Object.keys(dateFilter).length > 0) {
        wageFilter.paymentDate = { ...dateFilter };
    }
    const wagePayments = await EmployeeWagePayment.find(wageFilter);

    let totalWages = 0;
    wagePayments.forEach((w) => {
        // Exclude advances (advances are assets recovered later)
        if (w.paymentType !== 'salary_advance') {
            const wAmt = w.netAmount || w.grossAmount || 0;
            totalWages += wAmt;
            const wDateStr = w.paymentDate ? new Date(w.paymentDate).toISOString().split('T')[0] : 'Unknown';
            if (dailyMap.has(wDateStr)) {
                dailyMap.get(wDateStr).wages += wAmt;
            }
        }
    });

    // 3. Fetch Operational Expenses
    const expenseFilter = {
        status: { $ne: 'cancelled' },
        deletedAt: null,
        category: { $nin: ['Labor & Wages', 'Salary Advance', 'Wage Payout'] }, // prevent double counting with wages
    };
    if (Object.keys(dateFilter).length > 0) {
        expenseFilter.date = { ...dateFilter };
    }

    const expensesAgg = await Expense.aggregate([
        { $match: expenseFilter },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
    ]);

    let totalOperationalExpenses = 0;
    const expenseBreakdown = expensesAgg.map((e) => {
        totalOperationalExpenses += e.total;
        return { category: e._id || 'General Expense', amount: +e.total.toFixed(2) };
    });

    // 4. Fetch Returns / Wastage Loss
    const returnFilter = { status: 'completed' };
    if (Object.keys(dateFilter).length > 0) {
        returnFilter.createdAt = { ...dateFilter };
    }
    const returnsAgg = await CustomerReturn.aggregate([
        { $match: returnFilter },
        { $group: { _id: null, total: { $sum: '$totalRefundAmount' } } },
    ]);
    const customerReturnsLoss = returnsAgg[0]?.total || 0;

    // 5. Fetch Bakery & Short Eats Receiving stats
    const bakeryFilter = { status: 'confirmed', deletedAt: null };
    if (Object.keys(dateFilter).length > 0) {
        bakeryFilter.entryDate = { ...dateFilter };
    }
    if (warehouseId) {
        bakeryFilter.warehouseId = warehouseId;
    }

    const bakeryEntries = await BakeryDailyEntry.find(bakeryFilter)
        .populate('supplierId', 'displayName supplierCode');

    let totalBakeryGrossSupply = 0;
    let totalBakeryReturns = 0;
    let totalBakeryNetSupply = 0;
    let totalBakeryPaid = 0;
    let totalBakeryExpectedProfit = 0;

    bakeryEntries.forEach((be) => {
        totalBakeryGrossSupply += be.financials?.grossSupplyAmount || 0;
        totalBakeryReturns += be.financials?.totalReturnAmount || 0;
        totalBakeryNetSupply += be.financials?.netSupplyAmount || 0;
        totalBakeryPaid += be.financials?.paidAmount || 0;

        (be.items || []).forEach((item) => {
            totalBakeryExpectedProfit += item.lineExpectedProfit || 0;
        });
    });

    // Net Profit Calculation
    const totalExpensesAndCosts = +(totalOperationalExpenses + totalWages + customerReturnsLoss).toFixed(2);
    const netProfit = +(grossProfit - totalExpensesAndCosts).toFixed(2);
    const netMarginPercent = totalRevenue > 0 ? +((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    // Format Category Breakdown
    const categoriesArray = Array.from(categoryMap.values()).map((c) => ({
        ...c,
        revenue: +c.revenue.toFixed(2),
        cogs: +c.cogs.toFixed(2),
        grossProfit: +c.grossProfit.toFixed(2),
        marginPercent: c.revenue > 0 ? +((c.grossProfit / c.revenue) * 100).toFixed(1) : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    // Format Daily Trend
    const dailyTrend = Array.from(dailyMap.values()).map((d) => {
        const dayNet = +(d.grossProfit - d.expenses - d.wages).toFixed(2);
        return {
            ...d,
            revenue: +d.revenue.toFixed(2),
            cogs: +d.cogs.toFixed(2),
            grossProfit: +d.grossProfit.toFixed(2),
            wages: +d.wages.toFixed(2),
            expenses: +d.expenses.toFixed(2),
            netProfit: dayNet,
        };
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
        success: true,
        data: {
            summary: {
                grossSales: +grossSales.toFixed(2),
                totalDiscounts: +totalDiscounts.toFixed(2),
                totalRevenue,
                cogs: +cogs.toFixed(2),
                grossProfit,
                grossMarginPercent,
                totalWages: +totalWages.toFixed(2),
                totalOperationalExpenses: +totalOperationalExpenses.toFixed(2),
                customerReturnsLoss: +customerReturnsLoss.toFixed(2),
                totalExpensesAndCosts,
                netProfit,
                netMarginPercent,
            },
            bakerySummary: {
                totalGrossSupply: +totalBakeryGrossSupply.toFixed(2),
                totalReturns: +totalBakeryReturns.toFixed(2),
                totalNetSupply: +totalBakeryNetSupply.toFixed(2),
                totalPaid: +totalBakeryPaid.toFixed(2),
                totalExpectedProfit: +totalBakeryExpectedProfit.toFixed(2),
                entriesCount: bakeryEntries.length,
            },
            categories: categoriesArray,
            expenseBreakdown,
            dailyTrend,
        },
    });
});
