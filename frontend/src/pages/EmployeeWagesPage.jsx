import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Wallet, Plus, DollarSign, Calendar, Filter, UserCheck,
    Printer, X, CheckCircle, RefreshCw, Layers, ArrowDownLeft,
    Clock, ShieldAlert, FileText, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { employeesApi } from '../features/hr/hrApi';
import { bankAccountsApi } from '../features/bankAccounts/bankAccountsApi';
import { employeeWageApi } from '../api/employeeWageApi';

export default function EmployeeWagesPage() {
    const queryClient = useQueryClient();

    const [filterEmployeeId, setFilterEmployeeId] = useState('');
    const [filterType, setFilterType] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modals
    const [isWageModalOpen, setIsWageModalOpen] = useState(false);
    const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);

    // Form state for Wage Payment
    const [wageForm, setWageForm] = useState({
        employeeId: '',
        paymentType: 'daily_wage',
        paymentDate: new Date().toISOString().split('T')[0],
        daysWorked: '1',
        ratePerDay: '',
        grossAmount: '',
        advanceDeducted: '0',
        paymentMethod: 'cash',
        bankAccountId: '',
        chequeNumber: '',
        notes: '',
    });

    // Form state for Advance
    const [advanceForm, setAdvanceForm] = useState({
        employeeId: '',
        paymentDate: new Date().toISOString().split('T')[0],
        grossAmount: '',
        paymentMethod: 'cash',
        bankAccountId: '',
        chequeNumber: '',
        notes: '',
    });

    // Fetch Employees & Bank Accounts
    const { data: employeesData } = useQuery({
        queryKey: ['employees', 'active'],
        queryFn: () => employeesApi.list({ status: 'active', limit: 100 }),
    });

    const { data: bankAccountsData } = useQuery({
        queryKey: ['bank-accounts'],
        queryFn: () => bankAccountsApi.list(),
    });

    const employees = employeesData?.data || [];
    const bankAccounts = bankAccountsData?.data || [];

    // Fetch advance balance for selected employee in Wage form
    const { data: wageEmployeeAdvance } = useQuery({
        queryKey: ['employee-advance', wageForm.employeeId],
        queryFn: () => employeeWageApi.getAdvanceBalance(wageForm.employeeId),
        enabled: !!wageForm.employeeId,
    });

    const currentEmployeeAdvance = wageEmployeeAdvance?.data?.outstandingAdvance || 0;

    // Fetch Wage Payments List
    const { data: paymentsData, isLoading } = useQuery({
        queryKey: ['employee-wages', filterEmployeeId, filterType, startDate, endDate],
        queryFn: () =>
            employeeWageApi.list({
                employeeId: filterEmployeeId || undefined,
                paymentType: filterType || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                limit: 50,
            }),
    });

    const payments = paymentsData?.data || [];
    const summary = paymentsData?.summary || {};

    // Auto-calculate gross wage if daysWorked & ratePerDay are entered
    const handleDaysOrRateChange = (days, rate) => {
        const d = Number(days) || 0;
        const r = Number(rate) || 0;
        const autoGross = d > 0 && r > 0 ? (d * r).toString() : wageForm.grossAmount;
        setWageForm((prev) => ({
            ...prev,
            daysWorked: days,
            ratePerDay: rate,
            grossAmount: autoGross,
        }));
    };

    // Calculate Net Wage
    const calculatedNet = useMemo(() => {
        const gross = Number(wageForm.grossAmount) || 0;
        const adv = Number(wageForm.advanceDeducted) || 0;
        return Math.max(0, +(gross - adv).toFixed(2));
    }, [wageForm.grossAmount, wageForm.advanceDeducted]);

    // Record Wage Mutation
    const wageMutation = useMutation({
        mutationFn: (data) => employeeWageApi.recordWagePayment(data),
        onSuccess: (res) => {
            toast.success(res.message || 'Wage payment recorded successfully');
            queryClient.invalidateQueries({ queryKey: ['employee-wages'] });
            queryClient.invalidateQueries({ queryKey: ['employee-advance'] });
            setIsWageModalOpen(false);
            setSelectedPayment(res.data);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to record wage payment');
        },
    });

    // Record Advance Mutation
    const advanceMutation = useMutation({
        mutationFn: (data) =>
            employeeWageApi.recordWagePayment({
                ...data,
                paymentType: 'salary_advance',
                advanceDeducted: 0,
            }),
        onSuccess: (res) => {
            toast.success(res.message || 'Salary advance issued successfully');
            queryClient.invalidateQueries({ queryKey: ['employee-wages'] });
            queryClient.invalidateQueries({ queryKey: ['employee-advance'] });
            setIsAdvanceModalOpen(false);
            setSelectedPayment(res.data);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to record salary advance');
        },
    });

    const handleWageSubmit = (e) => {
        e.preventDefault();
        if (!wageForm.employeeId) {
            toast.error('Please select an employee');
            return;
        }
        if (!wageForm.grossAmount || Number(wageForm.grossAmount) <= 0) {
            toast.error('Please enter a valid wage amount');
            return;
        }
        if (Number(wageForm.advanceDeducted) > currentEmployeeAdvance) {
            toast.error(`Advance deduction cannot exceed current outstanding advance (Rs. ${currentEmployeeAdvance})`);
            return;
        }

        wageMutation.mutate(wageForm);
    };

    const handleAdvanceSubmit = (e) => {
        e.preventDefault();
        if (!advanceForm.employeeId) {
            toast.error('Please select an employee');
            return;
        }
        if (!advanceForm.grossAmount || Number(advanceForm.grossAmount) <= 0) {
            toast.error('Please enter a valid advance amount');
            return;
        }

        advanceMutation.mutate(advanceForm);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Employee Daily/Weekly Wages & Advances</h1>
                        <p className="text-sm text-slate-500">Manage daily wages, weekly wage payouts, salary advances, and advance deductions</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            setAdvanceForm({
                                employeeId: '',
                                paymentDate: new Date().toISOString().split('T')[0],
                                grossAmount: '',
                                paymentMethod: 'cash',
                                bankAccountId: '',
                                chequeNumber: '',
                                notes: '',
                            });
                            setIsAdvanceModalOpen(true);
                        }}
                        className="px-4 py-2.5 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition"
                    >
                        + Issue Salary Advance
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setWageForm({
                                employeeId: '',
                                paymentType: 'daily_wage',
                                paymentDate: new Date().toISOString().split('T')[0],
                                daysWorked: '1',
                                ratePerDay: '',
                                grossAmount: '',
                                advanceDeducted: '0',
                                paymentMethod: 'cash',
                                bankAccountId: '',
                                chequeNumber: '',
                                notes: '',
                            });
                            setIsWageModalOpen(true);
                        }}
                        className="px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        + Pay Wage (Daily / Weekly)
                    </button>
                </div>
            </div>

            {/* Financial Summary Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Wages</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">
                        Rs. {summary.totalGrossWages?.toLocaleString('en-LK', { minimumFractionDigits: 2 }) || '0.00'}
                    </p>
                    <span className="text-[11px] text-slate-400">Total earned wages</span>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Advances Issued</p>
                    <p className="text-xl font-bold text-amber-900 mt-1">
                        Rs. {summary.totalAdvancesGiven?.toLocaleString('en-LK', { minimumFractionDigits: 2 }) || '0.00'}
                    </p>
                    <span className="text-[11px] text-amber-600">Issued advances</span>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Advances Recovered</p>
                    <p className="text-xl font-bold text-rose-900 mt-1">
                        - Rs. {summary.totalAdvancesDeducted?.toLocaleString('en-LK', { minimumFractionDigits: 2 }) || '0.00'}
                    </p>
                    <span className="text-[11px] text-rose-600">Deducted from wages</span>
                </div>

                <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 shadow-sm">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Total Net Cash Disbursed</p>
                    <p className="text-xl font-bold text-blue-900 mt-1">
                        Rs. {summary.totalDisbursed?.toLocaleString('en-LK', { minimumFractionDigits: 2 }) || '0.00'}
                    </p>
                    <span className="text-[11px] text-blue-600">Net wages + Advances</span>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Filter Employee</label>
                    <select
                        value={filterEmployeeId}
                        onChange={(e) => setFilterEmployeeId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                        <option value="">All Employees</option>
                        {employees.map((emp) => (
                            <option key={emp._id} value={emp._id}>
                                {emp.firstName} {emp.lastName} ({emp.employeeCode})
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Payment Type</label>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                        <option value="">All Types</option>
                        <option value="daily_wage">Daily Wage</option>
                        <option value="weekly_wage">Weekly Wage</option>
                        <option value="salary_advance">Salary Advance</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Start Date</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">End Date</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                </div>
            </div>

            {/* Payments Ledger Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="font-bold text-slate-800">Wage & Advance Transactions ({payments.length})</h2>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-400">Loading wage ledger...</div>
                ) : payments.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Wallet className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p className="font-medium text-slate-600">No wage or advance records found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="py-3 px-4">Ref #</th>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">Employee</th>
                                    <th className="py-3 px-4">Type</th>
                                    <th className="py-3 px-3 text-right">Gross Amount</th>
                                    <th className="py-3 px-3 text-right text-rose-600">Advance Deducted</th>
                                    <th className="py-3 px-3 text-right text-blue-700">Net Paid</th>
                                    <th className="py-3 px-4">Method</th>
                                    <th className="py-3 px-4 text-center">Slip</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                                {payments.map((p) => (
                                    <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-4 font-mono font-bold text-xs text-slate-700">
                                            {p.paymentNumber}
                                        </td>
                                        <td className="py-3 px-4 text-xs text-slate-500">
                                            {new Date(p.paymentDate).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="font-semibold text-slate-800">{p.employeeName}</div>
                                            {p.employeeCode && <div className="text-[11px] text-slate-400 font-mono">{p.employeeCode}</div>}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span
                                                className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase ${
                                                    p.paymentType === 'salary_advance'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : p.paymentType === 'weekly_wage'
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-blue-100 text-blue-800'
                                                }`}
                                            >
                                                {p.paymentType.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-right font-semibold text-slate-800 text-xs">
                                            Rs. {p.grossAmount?.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-3 text-right font-semibold text-rose-600 text-xs">
                                            {p.advanceDeducted > 0 ? `- Rs. ${p.advanceDeducted?.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="py-3 px-3 text-right font-bold text-blue-900 text-sm">
                                            Rs. {p.netAmount?.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-4 text-xs capitalize text-slate-600">
                                            {p.paymentMethod.replace('_', ' ')}
                                            {p.chequeNumber && ` (#${p.chequeNumber})`}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedPayment(p)}
                                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                title="View / Print Voucher"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal: Pay Wage */}
            {isWageModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-blue-600" />
                                Pay Daily / Weekly Wage
                            </h3>
                            <button onClick={() => setIsWageModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleWageSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                    Select Employee <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={wageForm.employeeId}
                                    onChange={(e) => setWageForm((prev) => ({ ...prev, employeeId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                                    required
                                >
                                    <option value="">-- Choose Employee --</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id} value={emp._id}>
                                            {emp.firstName} {emp.lastName} ({emp.employeeCode})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {wageForm.employeeId && (
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                                    <span>Outstanding Salary Advance:</span>
                                    <span className="font-bold text-sm text-amber-950">Rs. {currentEmployeeAdvance.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Type</label>
                                    <select
                                        value={wageForm.paymentType}
                                        onChange={(e) => setWageForm((prev) => ({ ...prev, paymentType: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    >
                                        <option value="daily_wage">Daily Wage</option>
                                        <option value="weekly_wage">Weekly Wage</option>
                                        <option value="salary_settlement">Full Settlement</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Payment Date</label>
                                    <input
                                        type="date"
                                        value={wageForm.paymentDate}
                                        onChange={(e) => setWageForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Days Worked</label>
                                    <input
                                        type="number"
                                        min="0.5"
                                        step="0.5"
                                        value={wageForm.daysWorked}
                                        onChange={(e) => handleDaysOrRateChange(e.target.value, wageForm.ratePerDay)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Daily Rate (Rs.)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={wageForm.ratePerDay}
                                        placeholder="Optional rate/day"
                                        onChange={(e) => handleDaysOrRateChange(wageForm.daysWorked, e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                        Gross Wage Amount (Rs.) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={wageForm.grossAmount}
                                        onChange={(e) => setWageForm((prev) => ({ ...prev, grossAmount: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base font-bold text-slate-800"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                        Deduct Advance (Rs.)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max={currentEmployeeAdvance}
                                        step="1"
                                        value={wageForm.advanceDeducted}
                                        onChange={(e) => setWageForm((prev) => ({ ...prev, advanceDeducted: e.target.value }))}
                                        className="w-full px-3 py-2 border border-rose-300 rounded-lg text-base font-bold text-rose-700 bg-rose-50/50"
                                    />
                                </div>
                            </div>

                            {/* Net Payout Banner */}
                            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between text-blue-900 font-bold">
                                <span>Net Wage Payout:</span>
                                <span className="text-lg">Rs. {calculatedNet.toFixed(2)}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Payment Method</label>
                                    <select
                                        value={wageForm.paymentMethod}
                                        onChange={(e) => setWageForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="cheque">Cheque</option>
                                    </select>
                                </div>

                                {wageForm.paymentMethod === 'bank_transfer' ? (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">From Bank Account</label>
                                        <select
                                            value={wageForm.bankAccountId}
                                            onChange={(e) => setWageForm((prev) => ({ ...prev, bankAccountId: e.target.value }))}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        >
                                            <option value="">-- Select Bank --</option>
                                            {bankAccounts.map((b) => (
                                                <option key={b._id} value={b._id}>
                                                    {b.accountName} ({b.bankName})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : wageForm.paymentMethod === 'cheque' ? (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Cheque Number</label>
                                        <input
                                            type="text"
                                            value={wageForm.chequeNumber}
                                            onChange={(e) => setWageForm((prev) => ({ ...prev, chequeNumber: e.target.value }))}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        />
                                    </div>
                                ) : null}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Notes</label>
                                <input
                                    type="text"
                                    value={wageForm.notes}
                                    placeholder="e.g. Daily shift payout"
                                    onChange={(e) => setWageForm((prev) => ({ ...prev, notes: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsWageModalOpen(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={wageMutation.isPending}
                                    className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2"
                                >
                                    {wageMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    Confirm Wage Payment
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Give Salary Advance */}
            {isAdvanceModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-amber-700">
                                <DollarSign className="w-5 h-5" />
                                Issue Salary Advance
                            </h3>
                            <button onClick={() => setIsAdvanceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAdvanceSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                    Select Employee <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={advanceForm.employeeId}
                                    onChange={(e) => setAdvanceForm((prev) => ({ ...prev, employeeId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                                    required
                                >
                                    <option value="">-- Choose Employee --</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id} value={emp._id}>
                                            {emp.firstName} {emp.lastName} ({emp.employeeCode})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                        Advance Amount (Rs.) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={advanceForm.grossAmount}
                                        onChange={(e) => setAdvanceForm((prev) => ({ ...prev, grossAmount: e.target.value }))}
                                        className="w-full px-3 py-2 border border-amber-300 rounded-lg text-base font-bold text-amber-900 bg-amber-50/50"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={advanceForm.paymentDate}
                                        onChange={(e) => setAdvanceForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Payment Method</label>
                                <select
                                    value={advanceForm.paymentMethod}
                                    onChange={(e) => setAdvanceForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                >
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Reason / Notes</label>
                                <input
                                    type="text"
                                    value={advanceForm.notes}
                                    placeholder="e.g. Emergency mid-month advance"
                                    onChange={(e) => setAdvanceForm((prev) => ({ ...prev, notes: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsAdvanceModalOpen(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={advanceMutation.isPending}
                                    className="px-6 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm flex items-center gap-2"
                                >
                                    {advanceMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    Issue Advance
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: View / Print Payment Voucher */}
            {selectedPayment && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="font-bold text-slate-800 text-base">Payment Voucher</h3>
                            <button onClick={() => setSelectedPayment(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Printable Voucher */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono space-y-3">
                            <div className="text-center border-b pb-2">
                                <h2 className="text-sm font-bold uppercase">EMPLOYEE PAYMENT VOUCHER</h2>
                                <p className="text-[11px] text-slate-500">Ref #: {selectedPayment.paymentNumber}</p>
                                <p className="text-[11px] text-slate-500">Date: {new Date(selectedPayment.paymentDate).toLocaleDateString()}</p>
                            </div>

                            <div className="space-y-1 text-[11px]">
                                <p><span className="font-bold">Employee:</span> {selectedPayment.employeeName} ({selectedPayment.employeeCode})</p>
                                <p><span className="font-bold">Payment Type:</span> {selectedPayment.paymentType?.replace('_', ' ').toUpperCase()}</p>
                                {selectedPayment.daysWorked > 0 && selectedPayment.paymentType !== 'salary_advance' && (
                                    <p><span className="font-bold">Days Worked:</span> {selectedPayment.daysWorked}</p>
                                )}
                            </div>

                            <div className="border-t border-b border-slate-300 py-2 space-y-1 text-right text-[11px]">
                                <p>Gross Amount: <span className="font-bold">Rs. {selectedPayment.grossAmount?.toFixed(2)}</span></p>
                                {selectedPayment.advanceDeducted > 0 && (
                                    <p className="text-rose-600">Advance Deducted: - Rs. {selectedPayment.advanceDeducted?.toFixed(2)}</p>
                                )}
                                <p className="font-bold text-sm text-blue-900 border-t border-slate-300 pt-1">
                                    Net Paid: Rs. {selectedPayment.netAmount?.toFixed(2)}
                                </p>
                            </div>

                            <div className="space-y-1 text-[11px]">
                                <p><span className="font-bold">Method:</span> {selectedPayment.paymentMethod} {selectedPayment.chequeNumber ? `(#${selectedPayment.chequeNumber})` : ''}</p>
                                {selectedPayment.notes && <p><span className="font-bold">Notes:</span> {selectedPayment.notes}</p>}
                            </div>

                            <div className="border-t pt-8 flex justify-between text-center text-[10px] text-slate-500">
                                <div>
                                    <div className="border-t border-slate-400 w-24 mb-1"></div>
                                    <span>Employee Signature</span>
                                </div>
                                <div>
                                    <div className="border-t border-slate-400 w-24 mb-1"></div>
                                    <span>Authorized Signature</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedPayment(null)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg flex items-center gap-2"
                            >
                                <Printer className="w-4 h-4" />
                                Print Voucher
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
