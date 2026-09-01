import asyncHandler from 'express-async-handler';
import EmployeeWagePayment from '../models/EmployeeWagePayment.js';
import Employee from '../models/Employee.js';
import Expense from '../models/Expense.js';

/**
 * POST /api/hr/wages
 * Record a daily wage, weekly wage, or salary advance
 */
export const recordWagePayment = asyncHandler(async (req, res) => {
    const {
        employeeId,
        paymentType = 'daily_wage',
        paymentDate = new Date(),
        periodStartDate,
        periodEndDate,
        daysWorked = 1,
        ratePerDay = 0,
        grossAmount,
        advanceDeducted = 0,
        otherDeductions = 0,
        paymentMethod = 'cash',
        bankAccountId,
        chequeNumber,
        transactionReference,
        notes = '',
    } = req.body;

    if (!employeeId) {
        res.status(400);
        throw new Error('Employee is required');
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
        res.status(404);
        throw new Error('Employee not found');
    }

    const gross = Number(grossAmount) || 0;
    if (gross <= 0) {
        res.status(400);
        throw new Error('Gross amount must be greater than 0');
    }

    const wagePayment = new EmployeeWagePayment({
        employeeId,
        employeeName: employee.fullName || `${employee.firstName} ${employee.lastName}`,
        employeeCode: employee.employeeCode,
        paymentType,
        paymentDate,
        periodStartDate,
        periodEndDate,
        daysWorked: Number(daysWorked) || 1,
        ratePerDay: Number(ratePerDay) || 0,
        grossAmount: gross,
        advanceDeducted: Number(advanceDeducted) || 0,
        otherDeductions: Number(otherDeductions) || 0,
        netAmount: paymentType === 'salary_advance' ? gross : Math.max(0, gross - (Number(advanceDeducted) || 0) - (Number(otherDeductions) || 0)),
        paymentMethod,
        bankAccountId: bankAccountId || undefined,
        chequeNumber,
        transactionReference,
        status: 'paid',
        notes,
        createdBy: req.user?._id,
    });

    await wagePayment.save();

    // Also record as an expense entry for cashflow and general reporting
    try {
        const expenseCategory = paymentType === 'salary_advance' ? 'Salary Advance' : 'Labor & Wages';
        await Expense.create({
            title: `${paymentType === 'salary_advance' ? 'Salary Advance' : 'Wage Payout'}: ${wagePayment.employeeName}`,
            category: expenseCategory,
            amount: wagePayment.netAmount,
            date: paymentDate,
            paymentMethod,
            bankAccountId: bankAccountId || undefined,
            status: 'paid',
            referenceNumber: wagePayment.paymentNumber,
            notes: `Auto-recorded from Wage/Advance module: ${wagePayment.paymentNumber}`,
            createdBy: req.user?._id,
        });
    } catch (expErr) {
        console.warn('Auto-create expense for wage payout:', expErr.message);
    }

    const populated = await EmployeeWagePayment.findById(wagePayment._id)
        .populate('employeeId', 'firstName lastName employeeCode departmentId designationId phone')
        .populate('bankAccountId', 'accountName accountNumber bankName')
        .populate('createdBy', 'name email');

    res.status(201).json({
        success: true,
        message: `${paymentType === 'salary_advance' ? 'Salary advance' : 'Wage payment'} recorded successfully`,
        data: populated,
    });
});

/**
 * GET /api/hr/wages/advance-balance/:employeeId
 * Get current pending/outstanding salary advance balance for an employee
 */
export const getEmployeeAdvanceBalance = asyncHandler(async (req, res) => {
    const { employeeId } = req.params;

    const payments = await EmployeeWagePayment.find({
        employeeId,
        status: 'paid',
    });

    let totalAdvancesGiven = 0;
    let totalAdvancesRecovered = 0;

    payments.forEach((p) => {
        if (p.paymentType === 'salary_advance') {
            totalAdvancesGiven += p.grossAmount || 0;
        }
        if (p.advanceDeducted > 0) {
            totalAdvancesRecovered += p.advanceDeducted;
        }
    });

    const outstandingAdvance = Math.max(0, +(totalAdvancesGiven - totalAdvancesRecovered).toFixed(2));

    res.json({
        success: true,
        data: {
            employeeId,
            totalAdvancesGiven: +totalAdvancesGiven.toFixed(2),
            totalAdvancesRecovered: +totalAdvancesRecovered.toFixed(2),
            outstandingAdvance,
        },
    });
});

/**
 * GET /api/hr/wages
 * List wage & advance payments with filters
 */
export const getWagePayments = asyncHandler(async (req, res) => {
    const {
        employeeId,
        paymentType,
        paymentMethod,
        startDate,
        endDate,
        page = 1,
        limit = 50,
    } = req.query;

    const filter = { status: 'paid' };
    if (employeeId) filter.employeeId = employeeId;
    if (paymentType) filter.paymentType = paymentType;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    if (startDate || endDate) {
        filter.paymentDate = {};
        if (startDate) filter.paymentDate.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.paymentDate.$lte = end;
        }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [payments, total, allForSummary] = await Promise.all([
        EmployeeWagePayment.find(filter)
            .populate('employeeId', 'firstName lastName employeeCode phone')
            .populate('bankAccountId', 'accountName bankName')
            .populate('createdBy', 'name')
            .sort({ paymentDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        EmployeeWagePayment.countDocuments(filter),
        EmployeeWagePayment.find(filter),
    ]);

    // Calculate totals
    let totalGross = 0;
    let totalAdvancesDeducted = 0;
    let totalNetPaid = 0;
    let totalAdvancesGiven = 0;

    allForSummary.forEach((p) => {
        if (p.paymentType === 'salary_advance') {
            totalAdvancesGiven += p.grossAmount || 0;
        } else {
            totalGross += p.grossAmount || 0;
            totalAdvancesDeducted += p.advanceDeducted || 0;
            totalNetPaid += p.netAmount || 0;
        }
    });

    res.json({
        success: true,
        count: payments.length,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        summary: {
            totalGrossWages: +totalGross.toFixed(2),
            totalAdvancesDeducted: +totalAdvancesDeducted.toFixed(2),
            totalNetWagesPaid: +totalNetPaid.toFixed(2),
            totalAdvancesGiven: +totalAdvancesGiven.toFixed(2),
            totalDisbursed: +(totalNetPaid + totalAdvancesGiven).toFixed(2),
        },
        data: payments,
    });
});

/**
 * GET /api/hr/wages/:id
 * Get single wage payment by ID
 */
export const getWagePaymentById = asyncHandler(async (req, res) => {
    const payment = await EmployeeWagePayment.findById(req.params.id)
        .populate('employeeId', 'firstName lastName fullName employeeCode designationId departmentId nationalIdNumber phone bankDetails')
        .populate('bankAccountId', 'accountName accountNumber bankName')
        .populate('createdBy', 'name email');

    if (!payment) {
        res.status(404);
        throw new Error('Wage payment record not found');
    }

    res.json({
        success: true,
        data: payment,
    });
});
