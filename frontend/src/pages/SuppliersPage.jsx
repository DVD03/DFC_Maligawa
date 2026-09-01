import { useState, useEffect } from 'react';
import { Eye, Plus, Edit, Trash2, Search, Truck, Coffee, Layers, Package } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import SupplierFormModal from '../features/suppliers/SupplierFormModal';
import BakerySupplierModal from '../features/bakery/BakerySupplierModal';
import { useSuppliers, useDeleteSupplier } from '../features/suppliers/useSuppliers';
import { useAuthStore } from '../store/authStore';

const statusVariant = {
    active: 'success',
    inactive: 'default',
    on_hold: 'warning',
    blacklisted: 'danger',
};

const categoryLabels = {
    bakery_short_eats: '🥐 Bakery & Short Eats',
    raw_material: 'Raw Material',
    packaging: 'Packaging',
    services: 'Services',
    equipment: 'Equipment',
    finished_goods: 'Finished Goods',
    multiple: 'Multiple',
};

export default function SuppliersPage() {
    const { user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const categoryParam = searchParams.get('category') || '';

    const canManage = ['admin', 'manager', 'accountant'].includes(user?.role);
    const canDelete = ['admin', 'manager'].includes(user?.role);

    const [activeTab, setActiveTab] = useState(categoryParam || 'all');
    const [filters, setFilters] = useState({
        search: '',
        category: categoryParam || '',
        status: '',
        page: 1,
        limit: 10,
    });

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isBakeryFormOpen, setIsBakeryFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);

    // Sync tab with URL parameter or state
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        const catValue = tabId === 'all' ? '' : tabId;
        setFilters((prev) => ({ ...prev, category: catValue, page: 1 }));
        if (catValue) {
            setSearchParams({ category: catValue });
        } else {
            setSearchParams({});
        }
    };

    useEffect(() => {
        if (categoryParam) {
            setActiveTab(categoryParam);
            setFilters((prev) => ({ ...prev, category: categoryParam, page: 1 }));
        }
    }, [categoryParam]);

    const { data, isLoading } = useSuppliers(filters);
    const deleteMutation = useDeleteSupplier();

    const suppliers = data?.data || [];
    const total = data?.total || 0;
    const totalPages = data?.totalPages || 1;

    const handleAddClick = () => {
        if (activeTab === 'bakery_short_eats') {
            setEditing(null);
            setIsBakeryFormOpen(true);
        } else {
            setEditing(null);
            setIsFormOpen(true);
        }
    };

    const handleEditClick = (supplier) => {
        setEditing(supplier);
        if (supplier.category === 'bakery_short_eats') {
            setIsBakeryFormOpen(true);
        } else {
            setIsFormOpen(true);
        }
    };

    const columns = [
        {
            key: 'supplierCode',
            label: 'Code',
            width: '110px',
            render: (r) => <span className="font-mono text-xs font-semibold">{r.supplierCode}</span>,
        },
        {
            key: 'displayName',
            label: 'Supplier Name',
            render: (r) => (
                <div>
                    <p className="font-bold text-slate-800">{r.displayName}</p>
                    {r.companyName && r.companyName !== r.displayName && (
                        <p className="text-xs text-gray-500">{r.companyName}</p>
                    )}
                    {r.tags?.[0] && (
                        <span className="inline-block text-[10px] text-amber-700 font-medium mt-0.5">
                            {r.tags[0]}
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'category',
            label: 'Category',
            render: (r) => (
                <span
                    className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-bold uppercase ${
                        r.category === 'bakery_short_eats'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-slate-100 text-slate-700'
                    }`}
                >
                    {categoryLabels[r.category] || r.category}
                </span>
            ),
        },
        {
            key: 'contact',
            label: 'Contact',
            render: (r) => (
                <div className="text-xs">
                    {r.primaryContact?.name && <p className="font-medium text-slate-700">{r.primaryContact.name}</p>}
                    {r.primaryContact?.phone && <p className="text-slate-500 font-mono">{r.primaryContact.phone}</p>}
                </div>
            ),
        },
        {
            key: 'payment',
            label: 'Payment Terms',
            render: (r) => {
                const t = r.paymentTerms?.type;
                if (r.category === 'bakery_short_eats') return <Badge variant="warning">Daily / Carryover</Badge>;
                if (t === 'credit') return <Badge variant="info">{r.paymentTerms.creditDays}d credit</Badge>;
                if (t === 'advance') return <Badge variant="warning">Advance</Badge>;
                if (t === 'consignment') return <Badge variant="info">Consignment</Badge>;
                return <Badge>Daily COD / Cash</Badge>;
            },
        },
        {
            key: 'status',
            label: 'Status',
            render: (r) => <Badge variant={statusVariant[r.status]}>{r.status}</Badge>,
        },
        {
            key: 'actions',
            label: 'Actions',
            width: '120px',
            render: (r) => (
                <div className="flex gap-1">
                    {canManage && (
                        <button
                            onClick={() => handleEditClick(r)}
                            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                            title="Edit"
                        >
                            <Edit size={16} />
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={() => setDeleting(r)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Suppliers Directory"
                description="Manage your bakery, short-eats, raw materials, and wholesale suppliers"
                actions={
                    canManage && (
                        <div className="flex items-center gap-2">
                            {activeTab !== 'bakery_short_eats' && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setEditing(null);
                                        setIsBakeryFormOpen(true);
                                    }}
                                    className="border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                                >
                                    <Coffee size={16} className="mr-1.5 text-amber-600" /> + Bakery Supplier
                                </Button>
                            )}
                            <Button variant="primary" onClick={handleAddClick}>
                                <Plus size={16} className="mr-1.5" />
                                {activeTab === 'bakery_short_eats' ? '+ New Bakery Supplier' : '+ Add Supplier'}
                            </Button>
                        </div>
                    )
                }
            />

            {/* Segmented Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                {[
                    { id: 'all', label: '🌟 All Suppliers', icon: Layers },
                    { id: 'bakery_short_eats', label: '🥐 Bakery & Short Eats Suppliers', icon: Coffee },
                    { id: 'general', label: '📦 General / Wholesale Suppliers', icon: Package },
                ].map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => handleTabChange(t.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
                                activeTab === t.id
                                    ? 'bg-amber-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <Icon size={16} />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            <Card>
                <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, code, or phone..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                            value={filters.search}
                            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
                        />
                    </div>
                    {activeTab === 'all' && (
                        <div className="w-56">
                            <Select
                                placeholder="Filter Category"
                                options={[
                                    { value: '', label: 'All Categories' },
                                    ...Object.entries(categoryLabels).map(([v, l]) => ({ value: v, label: l })),
                                ]}
                                value={filters.category}
                                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value, page: 1 }))}
                            />
                        </div>
                    )}
                    <div className="w-40">
                        <Select
                            placeholder="All Statuses"
                            options={[
                                { value: '', label: 'All Statuses' },
                                { value: 'active', label: 'Active' },
                                { value: 'on_hold', label: 'On Hold' },
                                { value: 'inactive', label: 'Inactive' },
                                { value: 'blacklisted', label: 'Blacklisted' },
                            ]}
                            value={filters.status}
                            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-16 text-center text-gray-500">Loading suppliers...</div>
                ) : suppliers.length === 0 ? (
                    <EmptyState
                        icon={Truck}
                        title={
                            activeTab === 'bakery_short_eats'
                                ? 'No Bakery & Short Eats Suppliers Found'
                                : 'No Suppliers Found'
                        }
                        description={
                            activeTab === 'bakery_short_eats'
                                ? 'Add your daily bakery suppliers (e.g. morning short-eats, buns, pastries) to start daily receiving.'
                                : 'Add suppliers to start purchasing products.'
                        }
                        action={
                            canManage && (
                                <Button variant="primary" onClick={handleAddClick}>
                                    <Plus size={16} className="mr-1.5" />{' '}
                                    {activeTab === 'bakery_short_eats' ? 'Add Bakery Supplier' : 'Add Supplier'}
                                </Button>
                            )
                        }
                    />
                ) : (
                    <>
                        <Table columns={columns} data={suppliers} />
                        <Pagination
                            page={filters.page}
                            totalPages={totalPages}
                            total={total}
                            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
                        />
                    </>
                )}
            </Card>

            {/* General Supplier Form Modal */}
            <SupplierFormModal
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false);
                    setEditing(null);
                }}
                supplier={editing}
            />

            {/* Dedicated Bakery Supplier Form Modal */}
            <BakerySupplierModal
                isOpen={isBakeryFormOpen}
                onClose={() => {
                    setIsBakeryFormOpen(false);
                    setEditing(null);
                }}
                supplier={editing}
            />

            <ConfirmDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={async () => {
                    await deleteMutation.mutateAsync(deleting._id);
                    setDeleting(null);
                }}
                title="Delete Supplier"
                message={`Delete "${deleting?.displayName}"? This is a soft delete.`}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}