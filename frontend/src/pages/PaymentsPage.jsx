import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Trash2, Receipt } from 'lucide-react';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { usePayments, useDeletePayment } from '../features/payments/usePayments';

export default function PaymentsPage() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState({ direction: '', method: '', page: 1, limit: 15 });
    const { data, isLoading } = usePayments(filters);
    const deleteMutation = useDeletePayment();
    const [deletingId, setDeletingId] = useState(null);

    const payments = data?.data || [];
    const total = data?.total || 0;
    const totalPages = data?.totalPages || 1;

    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);
    const fmtDate = (d) => new Date(d).toLocaleDateString('en-LK');

    const handleDelete = async () => {
        if (!deletingId) return;
        try {
            await deleteMutation.mutateAsync(deletingId);
            setDeletingId(null);
        } catch {}
    };

    const columns = [
        { key: 'paymentNumber', label: 'Ref #', width: '110px', render: (r) => <span className="font-mono text-xs font-bold">{r.paymentNumber}</span> },
        {
            key: 'direction', label: 'Type', width: '80px',
            render: (r) => <Badge variant={r.direction === 'received' ? 'success' : 'info'}>
                {r.direction === 'received' ? 'IN' : 'OUT'}
            </Badge>,
        },
        { key: 'paymentDate', label: 'Date', render: (r) => fmtDate(r.paymentDate) },
        {
            key: 'party', label: 'Party',
            render: (r) => (
                <div>
                    <p className="font-medium text-slate-800">{r.partyName}</p>
                    <p className="text-xs text-gray-500">
                        {r.customerId?.customerCode || r.supplierId?.supplierCode}
                    </p>
                </div>
            ),
        },
        { key: 'method', label: 'Method', render: (r) => <span className="capitalize">{r.method.replace('_', ' ')}</span> },
        {
            key: 'amount', label: 'Paid Amount',
            render: (r) => (
                <div>
                    <span className="font-bold text-slate-900 font-mono">
                        {fmt(r.amount)}
                    </span>
                    {r.allocations && r.allocations.length > 0 && (
                        <div className="text-[11px] text-slate-500 font-medium">
                            {r.allocations.map((a, i) => (
                                <span key={i} className="inline-block mr-1">
                                    {a.documentNumber || a.documentType}: {fmt(a.amount)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ),
        },
        { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        {
            key: 'actions', label: '', width: '85px',
            render: (r) => (
                <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    <button 
                        type="button"
                        onClick={() => navigate(`/payments/${r._id}`)}
                        className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition"
                        title="View Details"
                    >
                        <Eye size={16} />
                    </button>
                    <button 
                        type="button"
                        onClick={() => setDeletingId(r._id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                        title="Delete Payment & Reverse Balance"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div>
            <PageHeader title="Payments" description="Customer payments received and supplier payments made"
                actions={<Button variant="primary" onClick={() => navigate('/payments/new')}>
                    <Plus size={16} className="mr-1.5" /> Record Payment
                </Button>} />

            <Card>
                <div className="p-4 border-b flex flex-wrap gap-3">
                    <div className="w-48">
                        <Select placeholder="All Types"
                            options={[{ value: 'received', label: 'Received' }, { value: 'paid', label: 'Paid Out' }]}
                            value={filters.direction}
                            onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value, page: 1 }))} />
                    </div>
                    <div className="w-48">
                        <Select placeholder="All Methods"
                            options={[
                                { value: 'cash', label: 'Cash' }, { value: 'cheque', label: 'Cheque' },
                                { value: 'bank_transfer', label: 'Bank Transfer' }, { value: 'card', label: 'Card' },
                                { value: 'mobile_wallet', label: 'Mobile Wallet' },
                            ]}
                            value={filters.method}
                            onChange={(e) => setFilters((f) => ({ ...f, method: e.target.value, page: 1 }))} />
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-16 text-center text-gray-500">Loading...</div>
                ) : payments.length === 0 ? (
                    <EmptyState icon={Receipt} title="No payments" description="Record customer or supplier payments"
                        action={<Button variant="primary" onClick={() => navigate('/payments/new')}>
                            <Plus size={16} className="mr-1.5" /> Record Payment
                        </Button>} />
                ) : (
                    <>
                        <Table columns={columns} data={payments} onRowClick={(r) => navigate(`/payments/${r._id}`)} />
                        <Pagination page={filters.page} totalPages={totalPages} total={total}
                            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
                    </>
                )}
            </Card>

            <ConfirmDialog
                isOpen={!!deletingId}
                title="Delete Payment Record"
                message="Are you sure you want to delete this payment record? This will reverse the bill's paid amount and outstanding balance."
                confirmText="Delete & Reverse"
                confirmVariant="danger"
                loading={deleteMutation.isPending}
                onConfirm={handleDelete}
                onClose={() => setDeletingId(null)}
            />
        </div>
    );
}