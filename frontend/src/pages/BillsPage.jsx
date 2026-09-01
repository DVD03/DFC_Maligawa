import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Receipt as ReceiptIcon, CreditCard } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import { useBills, usePayablesAging } from '../features/bills/useBills';
import { paymentsApi } from '../features/payments/paymentsApi';
import { bankAccountsApi } from '../features/bankAccounts/bankAccountsApi';
import api from '../api/axios';

const statusVariant = {
    unpaid: 'warning', partially_paid: 'info', paid: 'success',
    overdue: 'danger', cancelled: 'default', disputed: 'danger',
};

export default function BillsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [filters, setFilters] = useState({
        search: '', paymentStatus: '', agingBucket: '', page: 1, limit: 15,
    });

    // Payment Modal State
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [payingBill, setPayingBill] = useState(null);
    const [payAmount, setPayAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [bankAccountId, setBankAccountId] = useState('');
    const [chequeNumber, setChequeNumber] = useState('');
    const [chequeDate, setChequeDate] = useState('');
    const [bankName, setBankName] = useState('');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentNotes, setPaymentNotes] = useState('');

    const { data, isLoading } = useBills(filters);
    const { data: agingData } = usePayablesAging();
    const { data: bankAccountsData } = useQuery({
        queryKey: ['bank-accounts'],
        queryFn: () => bankAccountsApi.list(),
    });
    const bankAccounts = bankAccountsData?.data || [];

    const payingSupplierId = payingBill?.supplierId?._id || payingBill?.supplierId || null;
    const { data: supplierBalanceData } = useQuery({
        queryKey: ['supplier-balance', payingSupplierId],
        queryFn: async () => (await api.get(`/suppliers/${payingSupplierId}/balance`)).data,
        enabled: !!payingSupplierId && isPayModalOpen,
        staleTime: 0,
    });
    const otherUnpaidBills = (supplierBalanceData?.data?.unpaidBills || []).filter(b => b._id !== payingBill?._id);
    const otherUnpaidTotal = otherUnpaidBills.reduce((s, b) => s + (b.balanceDue || 0), 0);
    const totalSupplierPayable = (payingBill?.balanceDue || 0) + otherUnpaidTotal;

    const bills = data?.data || [];
    const total = data?.total || 0;
    const totalPages = data?.totalPages || 1;
    const aging = agingData?.data || { buckets: {}, counts: {}, totalPayable: 0 };

    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-LK') : '—';

    // Payment Mutation
    const paymentMutation = useMutation({
        mutationFn: async (payload) => paymentsApi.create(payload),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['bills'] });
            queryClient.invalidateQueries({ queryKey: ['payablesAging'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            queryClient.invalidateQueries({ queryKey: ['supplier-balance'] });
            queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['financial-pnl'] });
            queryClient.invalidateQueries({ queryKey: ['financialReports'] });
            toast.success(`Payment of ${fmt(payAmount)} recorded successfully!`);
            setIsPayModalOpen(false);
            setPayingBill(null);
            setPayAmount('');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to record payment');
        },
    });

    const handleOpenPayment = (bill, e) => {
        if (e) e.stopPropagation();
        setPayingBill(bill);
        setPayAmount(bill.balanceDue || '');
        setPaymentMethod('cash');
        setBankAccountId('');
        setChequeNumber('');
        setChequeDate('');
        setBankName('');
        setPaymentReference('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentNotes(`Payment for Bill ${bill.billNumber}`);
        setIsPayModalOpen(true);
    };

    const handleConfirmPayment = (e) => {
        e.preventDefault();
        const amt = Number(payAmount);
        if (!amt || amt <= 0) {
            toast.error('Please enter a valid payment amount');
            return;
        }
        if (amt > totalSupplierPayable) {
            toast.error(`Amount cannot exceed total supplier balance of ${fmt(totalSupplierPayable)}`);
            return;
        }
        if (paymentMethod === 'bank_transfer' && !bankAccountId) {
            toast.error('Please select a bank account');
            return;
        }

        const allocations = [];
        let remaining = amt;

        // 1. Allocate to this paying bill
        const allocThisBill = Math.min(remaining, payingBill.balanceDue);
        if (allocThisBill > 0) {
            allocations.push({
                documentType: 'bill',
                documentId: payingBill._id,
                amount: allocThisBill,
            });
            remaining -= allocThisBill;
        }

        // 2. If excess, allocate to other unpaid bills
        if (remaining > 0) {
            for (const otherBill of otherUnpaidBills) {
                if (remaining <= 0) break;
                const due = otherBill.balanceDue || 0;
                if (due <= 0) continue;
                const allocOther = Math.min(remaining, due);
                allocations.push({
                    documentType: 'bill',
                    documentId: otherBill._id,
                    amount: allocOther,
                });
                remaining -= allocOther;
            }
        }

        const payload = {
            direction: 'paid',
            supplierId: payingBill.supplierId?._id || payingBill.supplierId,
            amount: amt,
            method: paymentMethod,
            bankAccountId: bankAccountId || undefined,
            chequeNumber: chequeNumber || undefined,
            chequeDate: chequeDate || undefined,
            bankName: bankName || undefined,
            transactionReference: paymentReference || undefined,
            paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
            notes: paymentNotes || `Payment for Bill ${payingBill.billNumber}`,
            allocations,
        };

        paymentMutation.mutate(payload);
    };

    const columns = [
        { key: 'billNumber', label: 'Bill #', width: '120px', render: (r) => <span className="font-mono text-xs">{r.billNumber}</span> },
        { key: 'supplierInvoice', label: 'Supplier Inv #', render: (r) => r.supplierInvoiceNumber || '—' },
        { key: 'billDate', label: 'Date', render: (r) => fmtDate(r.billDate) },
        {
            key: 'supplier', label: 'Supplier',
            render: (r) => (
                <div>
                    <p className="font-medium">{r.supplierSnapshot?.name}</p>
                    <p className="text-xs text-gray-500">{r.supplierSnapshot?.code}</p>
                </div>
            ),
        },
        { key: 'dueDate', label: 'Due', render: (r) => fmtDate(r.dueDate) },
        { key: 'grandTotal', label: 'Total', render: (r) => fmt(r.grandTotal) },
        {
            key: 'balance', label: 'We Owe',
            render: (r) => r.balanceDue > 0
                ? <span className="font-medium text-red-600">{fmt(r.balanceDue)}</span>
                : <span className="text-green-600">Paid</span>,
        },
        { key: 'status', label: 'Status', render: (r) => <Badge variant={statusVariant[r.paymentStatus]}>{r.paymentStatus.replace('_', ' ')}</Badge> },
        {
            key: 'actions', label: '', width: '140px',
            render: (r) => (
                <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                    {r.balanceDue > 0 && (
                        <button
                            type="button"
                            onClick={(e) => handleOpenPayment(r, e)}
                            className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-2xs flex items-center gap-1 transition"
                            title="Mark / Record Payment"
                        >
                            <CreditCard size={13} />
                            Pay
                        </button>
                    )}
                    <button 
                        type="button"
                        onClick={() => navigate(`/bills/${r._id}`)}
                        className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition"
                        title="View Bill Details"
                    >
                        <Eye size={16} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div>
            <PageHeader title="Supplier Bills" description="Track what you owe suppliers" />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 mb-6">
                {[
                    { key: 'current', label: 'Current', color: 'bg-green-50 text-green-700 border-green-200' },
                    { key: '1_30', label: '1-30 days', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                    { key: '31_60', label: '31-60 days', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                    { key: '61_90', label: '61-90 days', color: 'bg-red-50 text-red-700 border-red-200' },
                    { key: '91_plus', label: '90+ days', color: 'bg-red-100 text-red-800 border-red-300' },
                ].map((b) => (
                    <button key={b.key}
                        onClick={() => setFilters((f) => ({ ...f, agingBucket: b.key, page: 1 }))}
                        className={`border rounded-lg p-3 text-left ${b.color} ${filters.agingBucket === b.key ? 'ring-2 ring-offset-1 ring-primary-500' : ''}`}>
                        <p className="text-xs">{b.label}</p>
                        <p className="text-lg font-bold">{fmt(aging.buckets?.[b.key] || 0)}</p>
                        <p className="text-xs opacity-75">{aging.counts?.[b.key] || 0}</p>
                    </button>
                ))}
            </div>

            <Card>
                <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Search..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                            value={filters.search}
                            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))} />
                    </div>
                    <div className="w-48">
                        <Select placeholder="All Statuses"
                            options={[
                                { value: 'unpaid', label: 'Unpaid' }, { value: 'partially_paid', label: 'Partially Paid' },
                                { value: 'paid', label: 'Paid' }, { value: 'overdue', label: 'Overdue' },
                                { value: 'disputed', label: 'Disputed' }, { value: 'cancelled', label: 'Cancelled' },
                            ]}
                            value={filters.paymentStatus}
                            onChange={(e) => setFilters((f) => ({ ...f, paymentStatus: e.target.value, page: 1 }))} />
                    </div>
                    {filters.agingBucket && (
                        <Button variant="outline" size="sm" onClick={() => setFilters((f) => ({ ...f, agingBucket: '' }))}>
                            Clear filter
                        </Button>
                    )}
                </div>

                {isLoading ? (
                    <div className="py-16 text-center text-gray-500">Loading...</div>
                ) : bills.length === 0 ? (
                    <EmptyState icon={ReceiptIcon} title="No bills yet" description="Bills are generated from GRNs when goods arrive" />
                ) : (
                    <>
                        <Table columns={columns} data={bills} onRowClick={(r) => navigate(`/bills/${r._id}`)} />
                        <Pagination page={filters.page} totalPages={totalPages} total={total}
                            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
                    </>
                )}
            </Card>

            {/* ── Quick Record Payment Modal ── */}
            <Modal
                isOpen={isPayModalOpen}
                onClose={() => {
                    setIsPayModalOpen(false);
                    setPayingBill(null);
                }}
                title={payingBill ? `Record Payment · ${payingBill.billNumber}` : 'Record Payment'}
                size="md"
            >
                {payingBill && (
                    <form onSubmit={handleConfirmPayment} className="p-6 space-y-4">
                        {/* Summary of Bill & Supplier Balance */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500 uppercase tracking-wider font-semibold">Supplier:</span>
                                <span className="font-bold text-slate-800">{payingBill.supplierSnapshot?.name}</span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200 text-center">
                                <div className="bg-white p-2 rounded-lg border border-slate-200">
                                    <span className="text-[10px] text-slate-400 block uppercase">This Bill Total</span>
                                    <strong className="text-slate-800 font-mono text-xs">{fmt(payingBill.grandTotal)}</strong>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200">
                                    <span className="text-[10px] text-slate-400 block uppercase">This Bill Paid</span>
                                    <strong className="text-emerald-700 font-mono text-xs">{fmt(payingBill.amountPaid || (payingBill.grandTotal - payingBill.balanceDue))}</strong>
                                </div>
                                <div className="bg-red-50 p-2 rounded-lg border border-red-200">
                                    <span className="text-[10px] text-red-600 block uppercase font-bold">This Bill Due</span>
                                    <strong className="text-red-700 font-mono text-xs font-bold">{fmt(payingBill.balanceDue)}</strong>
                                </div>
                            </div>

                            {otherUnpaidTotal > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1">
                                    <div className="flex justify-between text-amber-800 font-semibold text-xs">
                                        <span>⚠️ Other Unpaid Bills / Old Balance:</span>
                                        <span className="font-mono font-bold">+{fmt(otherUnpaidTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-amber-950 font-black text-xs border-t border-amber-200 pt-1">
                                        <span>Total Supplier Outstanding:</span>
                                        <span className="text-amber-900 font-mono text-sm">{fmt(totalSupplierPayable)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Payment Inputs */}
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
                                    <label className="text-xs font-semibold text-slate-700 uppercase">Payment Amount (Rs) *</label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPayAmount(payingBill.balanceDue)}
                                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
                                        >
                                            This Bill ({fmt(payingBill.balanceDue)})
                                        </button>
                                        {otherUnpaidTotal > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setPayAmount(totalSupplierPayable)}
                                                className="text-xs font-bold text-amber-700 hover:text-amber-800 underline"
                                            >
                                                Settle All ({fmt(totalSupplierPayable)})
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={totalSupplierPayable}
                                    required
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <Select
                                        label="Payment Method *"
                                        required
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        options={[
                                            { value: 'cash', label: 'Cash' },
                                            { value: 'bank_transfer', label: 'Bank Transfer' },
                                            { value: 'cheque', label: 'Cheque' },
                                            { value: 'card', label: 'Card' },
                                        ]}
                                    />
                                </div>

                                <div>
                                    <Input
                                        label="Payment Date *"
                                        type="date"
                                        required
                                        value={paymentDate}
                                        onChange={(e) => setPaymentDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            {paymentMethod === 'bank_transfer' && (
                                <div>
                                    <Select
                                        label="Bank Account *"
                                        required
                                        value={bankAccountId}
                                        onChange={(e) => setBankAccountId(e.target.value)}
                                        options={[
                                            { value: '', label: '-- Choose Bank Account --' },
                                            ...bankAccounts.map((b) => ({ value: b._id, label: `${b.accountName} (${b.bankName} - ${b.accountNumber})` })),
                                        ]}
                                    />
                                </div>
                            )}

                            {paymentMethod === 'cheque' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Input
                                        label="Cheque Number *"
                                        required
                                        placeholder="CHQ-12345"
                                        value={chequeNumber}
                                        onChange={(e) => setChequeNumber(e.target.value)}
                                    />
                                    <Input
                                        label="Cheque Date"
                                        type="date"
                                        value={chequeDate}
                                        onChange={(e) => setChequeDate(e.target.value)}
                                    />
                                </div>
                            )}

                            {(paymentMethod === 'bank_transfer' || paymentMethod === 'card') && (
                                <div>
                                    <Input
                                        label="Reference / Transaction #"
                                        placeholder="e.g. Bank Ref / Slip #"
                                        value={paymentReference}
                                        onChange={(e) => setPaymentReference(e.target.value)}
                                    />
                                </div>
                            )}

                            <div>
                                <Input
                                    label="Notes / Description"
                                    placeholder="Optional notes..."
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                />
                            </div>

                            {/* Remaining Balance Preview */}
                            <div className="bg-slate-100 p-2.5 rounded-lg text-xs flex justify-between items-center text-slate-700">
                                <span>Total Remaining Balance After Payment:</span>
                                <strong className="font-mono text-slate-900 font-bold">
                                    {fmt(Math.max(0, totalSupplierPayable - (Number(payAmount) || 0)))}
                                </strong>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="pt-3 flex gap-2">
                            <Button
                                type="submit"
                                variant="primary"
                                fullWidth
                                loading={paymentMutation.isPending}
                            >
                                Confirm Payment
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                fullWidth
                                onClick={() => {
                                    setIsPayModalOpen(false);
                                    setPayingBill(null);
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}