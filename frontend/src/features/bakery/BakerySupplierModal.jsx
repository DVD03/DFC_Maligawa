import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Coffee, User, Phone, MapPin, DollarSign, Clock,
    ShieldCheck, Landmark, X, Save, RefreshCw, CheckCircle,
    FileText, Tag, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { suppliersApi } from '../suppliers/suppliersApi';

export default function BakerySupplierModal({ isOpen, onClose, onCreated, supplier = null }) {
    const queryClient = useQueryClient();
    const isEdit = !!supplier?._id;

    const [form, setForm] = useState({
        displayName: '',
        companyName: '',
        contactPerson: '',
        phone: '',
        mobile: '',
        email: '',
        addressLine1: '',
        city: '',
        specialty: 'Short Eats & Pastries',
        deliveryTime: 'Morning (06:00 AM - 07:30 AM)',
        paymentTermsType: 'cod',
        creditDays: 0,
        returnPolicy: 'Daily morning returns accepted with full credit deduction',
        bankName: '',
        accountNumber: '',
        accountName: '',
        branchName: '',
        notes: '',
    });

    useEffect(() => {
        if (isOpen && supplier) {
            setForm({
                displayName: supplier.displayName || '',
                companyName: supplier.companyName || supplier.displayName || '',
                contactPerson: supplier.primaryContact?.name || '',
                phone: supplier.primaryContact?.phone || '',
                mobile: supplier.primaryContact?.mobile || '',
                email: supplier.primaryContact?.email || '',
                addressLine1: supplier.billingAddress?.line1 || '',
                city: supplier.billingAddress?.city || '',
                specialty: supplier.tags?.[0] || 'Short Eats & Pastries',
                deliveryTime: supplier.internalNotes || 'Morning (06:00 AM - 07:30 AM)',
                paymentTermsType: supplier.paymentTerms?.type || 'cod',
                creditDays: supplier.paymentTerms?.creditDays || 0,
                returnPolicy: supplier.notes || 'Daily morning returns accepted with full credit deduction',
                bankName: supplier.bankDetails?.bankName || '',
                accountNumber: supplier.bankDetails?.accountNumber || '',
                accountName: supplier.bankDetails?.accountName || '',
                branchName: supplier.bankDetails?.branchName || '',
                notes: supplier.notes || '',
            });
        } else if (isOpen) {
            setForm({
                displayName: '',
                companyName: '',
                contactPerson: '',
                phone: '',
                mobile: '',
                email: '',
                addressLine1: '',
                city: '',
                specialty: 'Short Eats & Pastries',
                deliveryTime: 'Morning (06:00 AM - 07:30 AM)',
                paymentTermsType: 'cod',
                creditDays: 0,
                returnPolicy: 'Daily morning returns accepted with full credit deduction',
                bankName: '',
                accountNumber: '',
                accountName: '',
                branchName: '',
                notes: '',
            });
        }
    }, [isOpen, supplier]);

    const mutation = useMutation({
        mutationFn: async (payload) => {
            if (isEdit) {
                return (await suppliersApi.update(supplier._id, payload)).data;
            } else {
                return (await suppliersApi.create(payload)).data;
            }
        },
        onSuccess: (savedData) => {
            toast.success(isEdit ? 'Bakery supplier updated!' : 'Bakery supplier added successfully!');
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            onCreated?.(savedData || supplier);
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to save bakery supplier');
        },
    });

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.displayName) {
            toast.error('Bakery / Supplier name is required');
            return;
        }

        const payload = {
            displayName: form.displayName,
            companyName: form.companyName || form.displayName,
            type: 'company',
            category: 'bakery_short_eats',
            tags: [form.specialty],
            primaryContact: {
                name: form.contactPerson || form.displayName,
                phone: form.phone || form.mobile || '0000000000',
                mobile: form.mobile || undefined,
                email: form.email || undefined,
            },
            billingAddress: {
                line1: form.addressLine1 || undefined,
                city: form.city || undefined,
                country: 'Sri Lanka',
            },
            paymentTerms: {
                type: form.paymentTermsType,
                creditDays: form.paymentTermsType === 'credit' ? Number(form.creditDays) || 0 : 0,
            },
            bankDetails: {
                bankName: form.bankName || undefined,
                accountNumber: form.accountNumber || undefined,
                accountName: form.accountName || undefined,
                branchName: form.branchName || undefined,
            },
            notes: form.returnPolicy || form.notes || undefined,
            internalNotes: form.deliveryTime || undefined,
            status: 'active',
        };

        mutation.mutate(payload);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white rounded-xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-3 sm:space-y-4 max-h-[96vh] sm:max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-2.5 sm:pb-3">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <div className="p-2 sm:p-2.5 bg-amber-50 rounded-lg sm:rounded-xl text-amber-700 border border-amber-200 flex-shrink-0">
                            <Coffee className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-800 text-base sm:text-lg truncate">
                                {isEdit ? 'Edit Bakery Supplier' : 'New Bakery & Short Eats Supplier'}
                            </h3>
                            <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-none">
                                Register daily morning short-eats, buns, and pastry bakers with agreed terms
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 -mr-1 rounded-lg flex-shrink-0 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                    {/* Bakery Basics */}
                    <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 space-y-3">
                        <h4 className="font-bold text-xs text-amber-900 uppercase flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                            Bakery & Vendor Details
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Bakery / Supplier Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Perera Bakers / Sunrise Short Eats"
                                    value={form.displayName}
                                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Specialization / Main Items
                                </label>
                                <select
                                    value={form.specialty}
                                    onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
                                >
                                    <option value="Short Eats & Pastries">🥐 Short Eats, Rolls & Pastries</option>
                                    <option value="Buns, Breads & Loaves">🍞 Buns, Breads & Loaves</option>
                                    <option value="Roti, Wade & Fried Items">🥟 Roti, Wade & Fried Snacks</option>
                                    <option value="Cakes & Desserts">🍰 Cakes & Sweet Items</option>
                                    <option value="Toffees, Jars & Sweets">🍬 Toffees & Packaged Sweets</option>
                                    <option value="All Bakery Products">🌟 All Bakery & Short Eats</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Contact Person & Delivery */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Baker / Delivery Contact Person
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Mr. Sunil (Baker)"
                                value={form.contactPerson}
                                onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Contact Phone / Driver Mobile <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="077 123 4567"
                                value={form.phone}
                                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-semibold"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Bakery Location / City
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Kandy Town / Katugastota"
                                value={form.city}
                                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                        </div>
                    </div>

                    {/* Terms & Delivery Timing */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Agreed Settlement Method
                            </label>
                            <select
                                value={form.paymentTermsType}
                                onChange={(e) => setForm((f) => ({ ...f, paymentTermsType: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                            >
                                <option value="cod">💵 Daily Partial Payment + Carryover Balance</option>
                                <option value="credit">📑 Weekly / Periodic Credit Settlement</option>
                                <option value="advance">💳 Advance Payment</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Daily Delivery Window
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Morning 06:00 AM - 07:00 AM"
                                value={form.deliveryTime}
                                onChange={(e) => setForm((f) => ({ ...f, deliveryTime: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                        </div>
                    </div>

                    {/* Return Agreement */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Daily Return & Unsold Items Policy
                        </label>
                        <input
                            type="text"
                            value={form.returnPolicy}
                            onChange={(e) => setForm((f) => ({ ...f, returnPolicy: e.target.value }))}
                            placeholder="e.g. Unsold daily short-eats returned next morning and deducted from today's bill"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        />
                    </div>

                    {/* Bank Details (Optional for direct payments) */}
                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2">
                        <h4 className="font-bold text-xs text-slate-700 uppercase flex items-center gap-1.5">
                            <Landmark className="w-4 h-4 text-blue-600" />
                            Supplier Bank Account (Optional for Bank Transfers)
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div>
                                <label className="block text-[11px] text-slate-500 mb-0.5">Bank Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Commercial Bank / BOC"
                                    value={form.bankName}
                                    onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-500 mb-0.5">Account Number</label>
                                <input
                                    type="text"
                                    placeholder="8001234567"
                                    value={form.accountNumber}
                                    onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-500 mb-0.5">Account Holder Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. K. Perera"
                                    value={form.accountName}
                                    onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 sm:border-transparent text-center transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm flex items-center justify-center gap-2 transition"
                        >
                            {mutation.isPending ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {isEdit ? 'Update Bakery Supplier' : 'Save Bakery Supplier'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
