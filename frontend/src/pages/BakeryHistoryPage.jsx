import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    History, Calendar, Filter, Eye, Printer, ArrowLeft,
    ShoppingBag, DollarSign, Search, CheckCircle, ChevronRight, X,
    CreditCard, Landmark, FileText, RefreshCw, Wallet, ArrowUpRight,
    ShieldCheck, Sparkles, Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { suppliersApi } from '../features/suppliers/suppliersApi';
import { bankAccountsApi } from '../features/bankAccounts/bankAccountsApi';
import { bakeryApi } from '../api/bakeryApi';

export default function BakeryHistoryPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedEntry, setSelectedEntry] = useState(null);

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        supplierId: '',
        supplierName: '',
        entryId: '',
        entryNumber: '',
        currentBalance: 0,
        returnItems: [], // [{ productId, productName, buyPrice, returnQty }]
        returnAmount: '',
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'cash',
        bankAccountId: '',
        chequeNumber: '',
        paymentReference: '',
        notes: '',
    });

    const { data: suppliersData } = useQuery({
        queryKey: ['suppliers', 'active', 'bakery_short_eats'],
        queryFn: () => suppliersApi.list({ category: 'bakery_short_eats', status: 'active', limit: 100 }),
    });

    const { data: bankAccountsData } = useQuery({
        queryKey: ['bank-accounts'],
        queryFn: () => bankAccountsApi.list(),
    });

    const suppliers = suppliersData?.data || [];
    const bankAccounts = bankAccountsData?.data || [];

    const { data: entriesData, isLoading } = useQuery({
        queryKey: ['bakery-entries', selectedSupplierId, startDate, endDate],
        queryFn: () =>
            bakeryApi.getDailyEntries({
                supplierId: selectedSupplierId || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                limit: 100,
            }),
    });

    const entries = entriesData?.data || [];

    // Fetch supplier statement if a supplier is selected
    const { data: statementData } = useQuery({
        queryKey: ['bakery-statement', selectedSupplierId, startDate, endDate],
        queryFn: () =>
            bakeryApi.getSupplierStatement(selectedSupplierId, {
                startDate: startDate || undefined,
                endDate: endDate || undefined,
            }),
        enabled: !!selectedSupplierId,
    });

    const summary = statementData?.data?.summary;

    // Payment Mutation
    const paymentMutation = useMutation({
        mutationFn: async (payload) => {
            if (payload.entryId) {
                return await bakeryApi.recordEntryPayment(payload.entryId, payload);
            } else {
                return await bakeryApi.recordPayment(payload);
            }
        },
        onSuccess: (res) => {
            toast.success(res?.message || 'Payment recorded successfully!');
            queryClient.invalidateQueries({ queryKey: ['bakery-entries'] });
            queryClient.invalidateQueries({ queryKey: ['bakery-statement'] });
            queryClient.invalidateQueries({ queryKey: ['bakery-balance'] });
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            setIsPaymentModalOpen(false);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to record payment');
        },
    });

    const handleOpenPaymentForEntry = (entry) => {
        const sup = entry.supplierId;
        const closingBal = entry.financials?.closingBalance || 0;

        const initialReturnItems = (entry.items || []).map((it) => ({
            productId: it.productId?._id || it.productId || '',
            productName: it.productName || it.productId?.name || '',
            buyPrice: Number(it.buyPrice) || 0,
            returnQty: '',
        }));

        setPaymentForm({
            supplierId: sup?._id || '',
            supplierName: sup?.displayName || 'Unknown Supplier',
            entryId: entry._id,
            entryNumber: entry.entryNumber,
            currentBalance: closingBal,
            returnItems: initialReturnItems,
            returnAmount: '',
            amount: closingBal > 0 ? closingBal.toString() : '',
            paymentDate: new Date().toISOString().split('T')[0],
            paymentMethod: 'cash',
            bankAccountId: '',
            chequeNumber: '',
            paymentReference: '',
            notes: `Settlement payment for delivery ${entry.entryNumber}`,
        });
        setIsPaymentModalOpen(true);
    };

    const handleOpenGeneralPayment = async () => {
        const sup = suppliers.find((s) => s._id === selectedSupplierId) || suppliers[0];
        const outstanding = summary?.currentOutstanding || 0;

        let supplierReturnItems = [];
        if (sup) {
            try {
                const tRes = await bakeryApi.getTemplate(sup._id);
                if (tRes?.data?.items) {
                    supplierReturnItems = tRes.data.items.map((it) => ({
                        productId: it.productId?._id || it.productId || '',
                        productName: it.productName || it.productId?.name || '',
                        buyPrice: Number(it.defaultBuyPrice) || Number(it.productId?.purchasePrice) || 0,
                        returnQty: '',
                    }));
                }
            } catch (err) {
                console.warn('Load template for return items:', err.message);
            }
        }

        setPaymentForm({
            supplierId: sup?._id || '',
            supplierName: sup?.displayName || 'Select Supplier',
            entryId: '',
            entryNumber: '',
            currentBalance: outstanding,
            returnItems: supplierReturnItems,
            returnAmount: '',
            amount: outstanding > 0 ? outstanding.toString() : '',
            paymentDate: new Date().toISOString().split('T')[0],
            paymentMethod: 'cash',
            bankAccountId: '',
            chequeNumber: '',
            paymentReference: '',
            notes: sup ? `Settlement payment to ${sup.displayName}` : '',
        });
        setIsPaymentModalOpen(true);
    };

    const handlePaymentSubmit = (e) => {
        e.preventDefault();
        const amt = Number(paymentForm.amount) || 0;
        const validReturns = (paymentForm.returnItems || []).filter((i) => Number(i.returnQty) > 0);
        const itemReturnTotal = validReturns.reduce(
            (sum, it) => sum + (Number(it.returnQty) * (Number(it.buyPrice) || 0)),
            0
        );
        const manualReturn = Number(paymentForm.returnAmount) || 0;
        const totalReturnDeduction = itemReturnTotal > 0 ? itemReturnTotal : manualReturn;

        if (amt <= 0 && totalReturnDeduction <= 0) {
            toast.error('Please enter either a payment amount or return item quantities');
            return;
        }
        if (!paymentForm.supplierId && !paymentForm.entryId) {
            toast.error('Please select a supplier');
            return;
        }

        paymentMutation.mutate({
            supplierId: paymentForm.supplierId,
            entryId: paymentForm.entryId || undefined,
            amount: amt,
            returnAmount: totalReturnDeduction,
            returnItems: validReturns,
            paymentDate: paymentForm.paymentDate,
            paymentMethod: paymentForm.paymentMethod,
            bankAccountId: paymentForm.bankAccountId || undefined,
            chequeNumber: paymentForm.chequeNumber || undefined,
            paymentReference: paymentForm.paymentReference || undefined,
            notes: paymentForm.notes || undefined,
        });
    };

    const handlePrint = () => {
        window.print();
    };

    // Calculate live returns and balance in modal
    const itemwiseReturnTotal = (paymentForm.returnItems || []).reduce(
        (sum, it) => sum + ((Number(it.returnQty) || 0) * (Number(it.buyPrice) || 0)),
        0
    );
    const manualReturnVal = Number(paymentForm.returnAmount) || 0;
    const effectiveReturnTotal = itemwiseReturnTotal > 0 ? itemwiseReturnTotal : manualReturnVal;

    const payAmt = Number(paymentForm.amount) || 0;
    const netPayable = Math.max(0, +(paymentForm.currentBalance - effectiveReturnTotal).toFixed(2));
    const remainingBalance = Math.max(0, +(paymentForm.currentBalance - effectiveReturnTotal - payAmt).toFixed(2));

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/bakery/daily-receiving')}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                        <History className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Bakery Receiving & Settlement Ledger</h1>
                        <p className="text-sm text-slate-500">
                            Track daily stock receipts, return deductions, balance carryovers & record supplier payments
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleOpenGeneralPayment}
                        className="px-4 py-2 text-sm font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition flex items-center gap-1.5 shadow-sm"
                    >
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        + Record Supplier Payment
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/bakery/daily-receiving')}
                        className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition shadow-sm flex items-center gap-1.5"
                    >
                        <ShoppingBag className="w-4 h-4" />
                        + New Daily Receiving
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Filter by Supplier</label>
                    <select
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                        <option value="">All Bakery Suppliers</option>
                        {suppliers.map((s) => (
                            <option key={s._id} value={s._id}>
                                {s.displayName}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">From Date</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">To Date</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                </div>
            </div>

            {/* Statement Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-xs font-semibold text-blue-600 uppercase">Total Gross Supply</p>
                        <p className="text-lg font-bold text-blue-900 mt-1">
                            Rs. {summary.totalGrossSupply?.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </p>
                    </div>

                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                        <p className="text-xs font-semibold text-rose-600 uppercase">Total Returns Deducted</p>
                        <p className="text-lg font-bold text-rose-900 mt-1">
                            Rs. {summary.totalReturns?.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </p>
                    </div>

                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <p className="text-xs font-semibold text-indigo-600 uppercase">Net Supply Amount</p>
                        <p className="text-lg font-bold text-indigo-900 mt-1">
                            Rs. {summary.totalNetSupply?.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </p>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <p className="text-xs font-semibold text-emerald-600 uppercase">Total Paid</p>
                        <p className="text-lg font-bold text-emerald-900 mt-1">
                            Rs. {summary.totalPaid?.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </p>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 col-span-2 sm:col-span-1 flex flex-col justify-between">
                        <div>
                            <p className="text-xs font-semibold text-amber-700 uppercase">Current Balance Due</p>
                            <p className="text-lg font-bold text-amber-900 mt-1">
                                Rs. {summary.currentOutstanding?.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        {summary.currentOutstanding > 0 && (
                            <button
                                type="button"
                                onClick={handleOpenGeneralPayment}
                                className="mt-2 w-full py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded shadow-sm transition"
                            >
                                Pay Balance
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Entries Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="font-bold text-slate-800 text-base">Delivery Entries ({entries.length})</h2>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-400">Loading ledger...</div>
                ) : entries.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 space-y-2">
                        <ShoppingBag className="w-12 h-12 mx-auto text-slate-300" />
                        <p className="font-medium text-slate-600">No daily entries found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="py-3 px-4">Entry #</th>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">Supplier</th>
                                    <th className="py-3 px-4">Shop / WH</th>
                                    <th className="py-3 px-3 text-right">Gross Supply</th>
                                    <th className="py-3 px-3 text-right">Returns</th>
                                    <th className="py-3 px-3 text-right">Net Supply</th>
                                    <th className="py-3 px-3 text-right">Paid</th>
                                    <th className="py-3 px-3 text-right">Closing Balance</th>
                                    <th className="py-3 px-4 text-center">Action & Payment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
                                {entries.map((entry) => {
                                    const closingBal = entry.financials?.closingBalance || 0;
                                    return (
                                        <tr key={entry._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4 font-mono font-bold text-amber-700 text-xs">
                                                {entry.entryNumber}
                                            </td>
                                            <td className="py-3 px-4 text-xs">
                                                {new Date(entry.entryDate).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-slate-800">
                                                {entry.supplierId?.displayName || 'Unknown Supplier'}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-slate-500">
                                                {entry.warehouseId?.name}
                                            </td>
                                            <td className="py-3 px-3 text-right text-xs">
                                                Rs. {entry.financials?.grossSupplyAmount?.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-3 text-right text-xs text-rose-600 font-semibold">
                                                - Rs. {entry.financials?.totalReturnAmount?.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-3 text-right text-xs font-semibold text-indigo-700">
                                                Rs. {entry.financials?.netSupplyAmount?.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-3 text-right text-xs font-bold text-emerald-600">
                                                Rs. {entry.financials?.paidAmount?.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-3 text-right text-xs font-bold">
                                                {closingBal > 0 ? (
                                                    <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-mono">
                                                        Rs. {closingBal.toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">
                                                        Settled (0.00)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {/* Payment Option Button */}
                                                    {closingBal > 0 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenPaymentForEntry(entry)}
                                                            className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1 transition"
                                                            title="Make Partial or Full Payment"
                                                        >
                                                            <DollarSign className="w-3.5 h-3.5" />
                                                            Pay
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenPaymentForEntry(entry)}
                                                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                                                            title="Record additional payment"
                                                        >
                                                            + Pay More
                                                        </button>
                                                    )}

                                                    {/* View Slip Details */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedEntry(entry)}
                                                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                                        title="View / Print Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Record Supplier Settlement Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-700 border border-emerald-200">
                                    <Wallet className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">Record Supplier Payment</h3>
                                    <p className="text-xs text-slate-500">
                                        Pay partial or full amount to settle bakery delivery balance
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPaymentModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handlePaymentSubmit} className="space-y-4 text-sm">
                            {/* Supplier & Entry Details Card */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500">Supplier:</span>
                                    <span className="font-bold text-slate-800">{paymentForm.supplierName}</span>
                                </div>
                                {paymentForm.entryNumber && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Delivery Entry #:</span>
                                        <span className="font-mono font-bold text-amber-700">{paymentForm.entryNumber}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                                    <span className="text-xs font-semibold text-slate-700">Closing Balance Due:</span>
                                    <span className="font-mono font-extrabold text-rose-600 text-base">
                                        Rs. {paymentForm.currentBalance?.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Item-wise Return Deduction Input */}
                            <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-bold text-xs text-rose-800 uppercase tracking-wider">
                                        <RefreshCw className="w-4 h-4 text-rose-600" />
                                        <span>🔄 Returns Handed Over at Payment Time (Item-wise)</span>
                                    </div>
                                    <span className="text-[11px] text-rose-600 font-semibold">Auto-deducted</span>
                                </div>

                                {paymentForm.returnItems?.length > 0 ? (
                                    <div className="bg-white rounded-lg border border-rose-200 overflow-hidden shadow-xs">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-rose-100/70 text-rose-900 font-bold uppercase text-[10px]">
                                                <tr>
                                                    <th className="py-2 px-3">Item Name</th>
                                                    <th className="py-2 px-2 text-right">Buy Price</th>
                                                    <th className="py-2 px-2 text-center w-24">Return Qty</th>
                                                    <th className="py-2 px-3 text-right">Deduction</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-rose-100 text-slate-700">
                                                {paymentForm.returnItems.map((rItem, idx) => {
                                                    const rQty = Number(rItem.returnQty) || 0;
                                                    const lineReturnVal = rQty * (Number(rItem.buyPrice) || 0);
                                                    return (
                                                        <tr key={idx} className="hover:bg-rose-50/40">
                                                            <td className="py-2 px-3 font-semibold text-slate-800">
                                                                {rItem.productName}
                                                            </td>
                                                            <td className="py-2 px-2 text-right font-mono text-slate-600">
                                                                Rs. {Number(rItem.buyPrice).toFixed(2)}
                                                            </td>
                                                            <td className="py-1.5 px-2 text-center">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    placeholder="0"
                                                                    value={rItem.returnQty}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const updated = [...paymentForm.returnItems];
                                                                        updated[idx] = { ...updated[idx], returnQty: val };

                                                                        const newReturnSum = updated.reduce(
                                                                            (sum, it) => sum + ((Number(it.returnQty) || 0) * (Number(it.buyPrice) || 0)),
                                                                            0
                                                                        );
                                                                        const newNet = Math.max(0, +(paymentForm.currentBalance - newReturnSum).toFixed(2));

                                                                        setPaymentForm((f) => ({
                                                                            ...f,
                                                                            returnItems: updated,
                                                                            amount: newNet > 0 ? newNet.toString() : f.amount,
                                                                        }));
                                                                    }}
                                                                    className="w-20 text-center font-bold font-mono py-1 px-2 border border-rose-300 rounded focus:ring-2 focus:ring-rose-500 bg-white"
                                                                />
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-bold font-mono text-rose-700">
                                                                {lineReturnVal > 0 ? `- Rs. ${lineReturnVal.toFixed(2)}` : 'Rs. 0.00'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <label className="block text-[11px] font-semibold text-rose-800">
                                            Return Deduction Amount (Rs.)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={paymentForm.returnAmount}
                                            onChange={(e) => {
                                                const r = e.target.value;
                                                const rVal = Number(r) || 0;
                                                const newNet = Math.max(0, +(paymentForm.currentBalance - rVal).toFixed(2));
                                                setPaymentForm((f) => ({
                                                    ...f,
                                                    returnAmount: r,
                                                    amount: newNet > 0 ? newNet.toString() : f.amount,
                                                }));
                                            }}
                                            className="w-full px-3 py-2 text-sm font-bold font-mono text-rose-900 border border-rose-300 rounded-lg bg-white"
                                        />
                                    </div>
                                )}

                                {/* Return summary line */}
                                <div className="flex items-center justify-between pt-1 border-t border-rose-200 text-xs font-semibold text-rose-900">
                                    <span>Total Return Deduction:</span>
                                    <span className="font-mono font-bold text-sm text-rose-700">
                                        - Rs. {effectiveReturnTotal.toFixed(2)}
                                    </span>
                                </div>

                                {effectiveReturnTotal > 0 && (
                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-dashed border-rose-300 text-slate-800 font-bold">
                                        <span>Net Balance to Settle:</span>
                                        <span className="font-mono text-sm text-emerald-800">
                                            Rs. {netPayable.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Payment Amount Input */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        Payment Amount (Rs.) <span className="text-rose-500">*</span>
                                    </label>
                                    {netPayable > 0 && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPaymentForm((f) => ({
                                                        ...f,
                                                        amount: (netPayable / 2).toFixed(2),
                                                    }))
                                                }
                                                className="text-[11px] font-bold text-blue-600 hover:underline px-1.5 py-0.5 bg-blue-50 rounded"
                                            >
                                                Half (50%)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPaymentForm((f) => ({
                                                        ...f,
                                                        amount: netPayable.toString(),
                                                    }))
                                                }
                                                className="text-[11px] font-bold text-emerald-700 hover:underline px-1.5 py-0.5 bg-emerald-50 rounded"
                                            >
                                                Full Settle (Rs. {netPayable.toFixed(2)})
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Enter partial or full payment amount (e.g. 5000)"
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                                    className="w-full px-3 py-2 text-base font-bold font-mono text-emerald-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                                />
                            </div>

                            {/* Live Balance Remaining Preview */}
                            {(payAmt > 0 || effectiveReturnTotal > 0) && (
                                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 flex items-center justify-between text-xs font-medium">
                                    <span className="text-emerald-900">Remaining Balance after settlement:</span>
                                    <span className="font-mono font-bold text-slate-800 text-sm">
                                        Rs. {remainingBalance.toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {/* Payment Date & Method */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                        Payment Date
                                    </label>
                                    <input
                                        type="date"
                                        value={paymentForm.paymentDate}
                                        onChange={(e) => setPaymentForm((f) => ({ ...f, paymentDate: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                        Payment Method
                                    </label>
                                    <select
                                        value={paymentForm.paymentMethod}
                                        onChange={(e) => setPaymentForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white"
                                    >
                                        <option value="cash">💵 Cash (Handover)</option>
                                        <option value="bank_transfer">🏦 Bank Transfer</option>
                                        <option value="cheque">📑 Cheque</option>
                                    </select>
                                </div>
                            </div>

                            {/* Conditional Bank Account */}
                            {paymentForm.paymentMethod === 'bank_transfer' && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                        Paid From Bank Account <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={paymentForm.bankAccountId}
                                        onChange={(e) => setPaymentForm((f) => ({ ...f, bankAccountId: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                                        required
                                    >
                                        <option value="">-- Select Bank Account --</option>
                                        {bankAccounts.map((b) => (
                                            <option key={b._id} value={b._id}>
                                                {b.bankName} - {b.accountNumber} ({b.accountName})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Conditional Cheque Number */}
                            {paymentForm.paymentMethod === 'cheque' && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                        Cheque Number <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. CHQ-998821"
                                        value={paymentForm.chequeNumber}
                                        onChange={(e) => setPaymentForm((f) => ({ ...f, chequeNumber: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white"
                                    />
                                </div>
                            )}

                            {/* Reference / Voucher # */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                    Payment Reference / Voucher # (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. REC-1029 / Cash Receipt"
                                    value={paymentForm.paymentReference}
                                    onChange={(e) => setPaymentForm((f) => ({ ...f, paymentReference: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                    Notes
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Paid afternoon cash instalment to delivery driver"
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsPaymentModalOpen(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={paymentMutation.isPending}
                                    className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-2 transition"
                                >
                                    {paymentMutation.isPending ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CheckCircle className="w-4 h-4" />
                                    )}
                                    Confirm Payment (Rs. {payAmt.toFixed(2)})
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Entry Detail Slip Modal */}
            {selectedEntry && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="font-bold text-slate-800 text-base">Delivery Entry Slip</h3>
                            <button
                                onClick={() => setSelectedEntry(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Slip Content */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-xs font-mono space-y-3">
                            <div className="text-center border-b pb-2">
                                <h2 className="text-sm font-bold uppercase">BAKERY DELIVERY & SETTLEMENT SLIP</h2>
                                <p className="text-[11px] text-slate-500">Entry #: {selectedEntry.entryNumber}</p>
                                <p className="text-[11px] text-slate-500">Date: {new Date(selectedEntry.entryDate).toLocaleDateString()}</p>
                            </div>

                            <div className="text-[11px] space-y-1">
                                <p><span className="font-bold">Supplier:</span> {selectedEntry.supplierId?.displayName}</p>
                                <p><span className="font-bold">Shop/Warehouse:</span> {selectedEntry.warehouseId?.name}</p>
                            </div>

                            <table className="w-full border-t border-b border-slate-300 py-1 text-[11px]">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-1">Item</th>
                                        <th className="text-right py-1">Rec.</th>
                                        <th className="text-right py-1">Ret.</th>
                                        <th className="text-right py-1">Buy</th>
                                        <th className="text-right py-1">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedEntry.items?.map((it, idx) => (
                                        <tr key={idx} className="border-b border-slate-100">
                                            <td className="py-1">{it.productName}</td>
                                            <td className="text-right py-1">{it.receivedQty}</td>
                                            <td className="text-right py-1">{it.returnedQty || 0}</td>
                                            <td className="text-right py-1">{it.buyPrice}</td>
                                            <td className="text-right py-1">{(it.receivedQty * it.buyPrice).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="space-y-1 text-right text-[11px]">
                                <p>Today Gross Supply: <span className="font-bold">Rs. {selectedEntry.financials?.grossSupplyAmount?.toFixed(2)}</span></p>
                                <p>Today Returns Deducted: <span className="font-bold text-rose-600">- Rs. {selectedEntry.financials?.totalReturnAmount?.toFixed(2)}</span></p>
                                <p>Previous Balance: <span className="font-bold">Rs. {selectedEntry.financials?.previousBalance?.toFixed(2)}</span></p>
                                <p className="font-bold border-t border-slate-300 pt-1 text-xs">Total Net Payable: Rs. {selectedEntry.financials?.totalPayable?.toFixed(2)}</p>
                                <p>Paid Today ({selectedEntry.financials?.paymentMethod}): <span className="font-bold text-emerald-600">Rs. {selectedEntry.financials?.paidAmount?.toFixed(2)}</span></p>
                                <p className="font-bold text-xs text-rose-700 border-t border-dashed pt-1">
                                    Closing Balance Due: Rs. {selectedEntry.financials?.closingBalance?.toFixed(2)}
                                </p>
                            </div>

                            {selectedEntry.notes && (
                                <p className="text-[10px] text-slate-500 border-t pt-1">
                                    <span className="font-bold">Note:</span> {selectedEntry.notes}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedEntry(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg flex items-center gap-2"
                            >
                                <Printer className="w-4 h-4" />
                                Print Slip
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
