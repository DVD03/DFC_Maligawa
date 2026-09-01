import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Coffee, Plus, Edit, Trash2, Search, Phone, MapPin,
    Clock, DollarSign, Layers, ArrowRight, ShoppingBag,
    CheckCircle, User, RefreshCw, Landmark, FileText, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { suppliersApi } from '../features/suppliers/suppliersApi';
import { bakeryApi } from '../api/bakeryApi';
import BakerySupplierModal from '../features/bakery/BakerySupplierModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuthStore } from '../store/authStore';

export default function BakerySuppliersPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const canManage = ['admin', 'manager', 'accountant', 'inventory_admin'].includes(user?.role);

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [deletingSupplier, setDeletingSupplier] = useState(null);

    // Fetch Bakery Suppliers
    const { data: suppliersData, isLoading } = useQuery({
        queryKey: ['suppliers', 'bakery_short_eats', searchTerm],
        queryFn: () =>
            suppliersApi.list({
                category: 'bakery_short_eats',
                search: searchTerm || undefined,
                limit: 100,
            }),
    });

    // Fetch Templates to count configured templates
    const { data: templatesData } = useQuery({
        queryKey: ['bakery-templates-list'],
        queryFn: () => bakeryApi.listTemplates(),
    });

    const suppliers = suppliersData?.data || [];
    const templates = templatesData?.data || [];

    // Map template count by supplierId
    const templateMap = new Map();
    templates.forEach((t) => {
        const sId = t.supplierId?._id || t.supplierId;
        if (sId) templateMap.set(sId.toString(), t);
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => suppliersApi.delete(id),
        onSuccess: () => {
            toast.success('Bakery supplier removed');
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            setDeletingSupplier(null);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to delete supplier');
        },
    });

    const handleOpenCreate = () => {
        setEditingSupplier(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (supplier) => {
        setEditingSupplier(supplier);
        setIsModalOpen(true);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-50 rounded-xl text-amber-700 border border-amber-200">
                        <Coffee className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Bakery & Short Eats Suppliers</h1>
                        <p className="text-sm text-slate-500">
                            Directory of daily morning bakers, pastry vendors, delivery drivers, and pricing agreements
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/bakery/daily-receiving')}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                    >
                        Daily Receiving
                    </button>
                    {canManage && (
                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm flex items-center gap-2 transition"
                        >
                            <Plus className="w-4 h-4" />
                            + Register Bakery Supplier
                        </button>
                    )}
                </div>
            </div>

            {/* Financial & Status Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Total Bakery Vendors</span>
                    <p className="text-2xl font-black text-slate-800 mt-1">{suppliers.length}</p>
                    <span className="text-[11px] text-amber-600 font-medium">Short-eats & bakery suppliers</span>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Configured Price Templates</span>
                    <p className="text-2xl font-black text-blue-700 mt-1">{templates.length}</p>
                    <span className="text-[11px] text-blue-600">Auto-loading item structures</span>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Daily Deliveries</span>
                    <p className="text-2xl font-black text-emerald-700 mt-1">
                        {suppliers.filter((s) => s.status === 'active').length} Active
                    </p>
                    <span className="text-[11px] text-emerald-600">Ready for morning stock-in</span>
                </div>

                <div className="bg-amber-50/70 p-5 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-amber-900 uppercase">Price Structures</span>
                        <p className="text-xs text-amber-700 mt-1">Configure standard buy & sell prices per supplier</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/bakery/templates')}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm whitespace-nowrap"
                    >
                        Templates <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Suppliers List Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold text-slate-800 text-base">Registered Bakers & Vendors ({suppliers.length})</h2>
                    </div>

                    <div className="relative w-full sm:w-80">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search bakery name, phone, or code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-400">Loading bakery suppliers...</div>
                ) : suppliers.length === 0 ? (
                    <div className="p-12 text-center space-y-3">
                        <Coffee className="w-12 h-12 mx-auto text-amber-300 stroke-[1.5]" />
                        <h3 className="font-bold text-slate-700 text-base">No Bakery Suppliers Registered</h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                            Register your daily morning short-eats, pastry, and bun suppliers to configure their pricing templates and start daily stock receiving.
                        </p>
                        {canManage && (
                            <button
                                type="button"
                                onClick={handleOpenCreate}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-sm transition mt-2 shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                + Register First Bakery Supplier
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="py-3 px-4">Code</th>
                                    <th className="py-3 px-4">Bakery / Supplier Name</th>
                                    <th className="py-3 px-4">Specialty & Items</th>
                                    <th className="py-3 px-4">Delivery & Contact</th>
                                    <th className="py-3 px-3 text-center">Price Template</th>
                                    <th className="py-3 px-3">Settlement Terms</th>
                                    <th className="py-3 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                                {suppliers.map((s) => {
                                    const template = templateMap.get(s._id.toString());
                                    return (
                                        <tr key={s._id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4 font-mono font-bold text-xs text-slate-700">
                                                {s.supplierCode}
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-900 text-sm">
                                                    {s.displayName}
                                                </div>
                                                {s.companyName && s.companyName !== s.displayName && (
                                                    <div className="text-xs text-slate-500">{s.companyName}</div>
                                                )}
                                                {s.billingAddress?.city && (
                                                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                        <MapPin className="w-3 h-3 text-slate-400" />
                                                        {s.billingAddress.city}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-3 px-4">
                                                <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                                    {s.tags?.[0] || '🥐 Short Eats & Pastries'}
                                                </span>
                                                {s.internalNotes && (
                                                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                        {s.internalNotes}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-3 px-4 text-xs">
                                                <div className="font-semibold text-slate-800 flex items-center gap-1">
                                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                                    {s.primaryContact?.name || s.displayName}
                                                </div>
                                                <div className="text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                                    <Phone className="w-3 h-3 text-slate-400" />
                                                    {s.primaryContact?.phone || s.primaryContact?.mobile || 'No phone'}
                                                </div>
                                            </td>

                                            <td className="py-3 px-3 text-center">
                                                {template ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate('/bakery/templates')}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold hover:bg-emerald-100 transition"
                                                        title="Click to view/edit price template"
                                                    >
                                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                                        {template.items?.length || 0} items configured
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate('/bakery/templates')}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[11px] font-bold hover:bg-amber-100 transition"
                                                    >
                                                        + Setup Template
                                                    </button>
                                                )}
                                            </td>

                                            <td className="py-3 px-3 text-xs">
                                                <span className="inline-block font-semibold text-slate-700">
                                                    {s.paymentTerms?.type === 'credit'
                                                        ? `${s.paymentTerms.creditDays}d Credit`
                                                        : 'Daily Settlement'}
                                                </span>
                                                {s.notes && (
                                                    <p className="text-[10px] text-slate-400 max-w-xs truncate mt-0.5">
                                                        {s.notes}
                                                    </p>
                                                )}
                                            </td>

                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate('/bakery/daily-receiving')}
                                                        className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                                                        title="Receive Daily Stock"
                                                    >
                                                        <ShoppingBag className="w-4 h-4" />
                                                    </button>
                                                    {canManage && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEdit(s)}
                                                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                            title="Edit Bakery Supplier"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canManage && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeletingSupplier(s)}
                                                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                                            title="Remove Supplier"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
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

            {/* Dedicated Bakery Supplier Form Modal */}
            <BakerySupplierModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingSupplier(null);
                }}
                supplier={editingSupplier}
                onCreated={() => {
                    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
                }}
            />

            {/* Confirm Delete Dialog */}
            <ConfirmDialog
                isOpen={!!deletingSupplier}
                onClose={() => setDeletingSupplier(null)}
                onConfirm={() => deleteMutation.mutate(deletingSupplier._id)}
                title="Remove Bakery Supplier"
                message={`Are you sure you want to remove "${deletingSupplier?.displayName}"?`}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}
