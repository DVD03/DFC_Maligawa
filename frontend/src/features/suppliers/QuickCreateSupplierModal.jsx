import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useCreateSupplier } from './useSuppliers';

export default function QuickCreateSupplierModal({
    isOpen,
    onClose,
    onCreated,
    defaultCategory = 'bakery_short_eats',
}) {
    const [form, setForm] = useState({
        displayName: '',
        legalName: '',
        phone: '',
        email: '',
        category: defaultCategory,
        addressLine1: '',
        city: '',
        paymentTermsType: 'cash',
        creditDays: 30,
    });

    useEffect(() => {
        if (isOpen) {
            setForm((f) => ({ ...f, category: defaultCategory }));
        }
    }, [isOpen, defaultCategory]);

    const createMutation = useCreateSupplier();

    const submit = async () => {
        if (!form.displayName) {
            toast.error('Supplier name required');
            return;
        }

        try {
            const result = await createMutation.mutateAsync({
                displayName: form.displayName,
                legalName: form.legalName || form.displayName,
                category: form.category || defaultCategory || 'bakery_short_eats',
                primaryContact: {
                    name: form.displayName,
                    phone: form.phone || '0000000000',
                    email: form.email || undefined,
                },
                primaryAddress: form.addressLine1
                    ? {
                          line1: form.addressLine1,
                          city: form.city,
                          country: 'Sri Lanka',
                      }
                    : undefined,
                paymentTerms: {
                    type: form.paymentTermsType,
                    creditDays: form.paymentTermsType === 'credit' ? +form.creditDays : 0,
                },
                status: 'active',
            });

            setForm({
                displayName: '',
                legalName: '',
                phone: '',
                email: '',
                category: defaultCategory,
                addressLine1: '',
                city: '',
                paymentTermsType: 'cash',
                creditDays: 30,
            });

            toast.success('Supplier created successfully!');
            onCreated?.(result.data);
            onClose();
        } catch {}
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Quick Create Supplier" size="md">
            <div className="p-6 space-y-4">
                <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    Capture basics now. You can manage complete address, tax info, and bank accounts later from the Suppliers directory.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                        label="Supplier Name"
                        required
                        placeholder="e.g. Perera Bakers / Sunrise Short-Eats"
                        value={form.displayName}
                        onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    />

                    <Select
                        label="Supplier Category"
                        options={[
                            { value: 'bakery_short_eats', label: '🥐 Bakery & Short Eats' },
                            { value: 'raw_material', label: '🌾 Raw Material' },
                            { value: 'packaging', label: '📦 Packaging' },
                            { value: 'finished_goods', label: '🛒 Finished Goods' },
                            { value: 'multiple', label: '🌟 General / Multiple' },
                        ]}
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Input
                        label="Contact Phone"
                        placeholder="0771234567"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                    <Input
                        label="Email (optional)"
                        type="email"
                        placeholder="supplier@example.com"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Input
                        label="City / Area"
                        placeholder="e.g. Kandy / Colombo"
                        value={form.city}
                        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />

                    <Select
                        label="Default Payment Terms"
                        options={[
                            { value: 'cash', label: 'Cash on delivery (Daily)' },
                            { value: 'credit', label: 'Credit (Pay Later)' },
                            { value: 'advance', label: 'Advance' },
                        ]}
                        value={form.paymentTermsType}
                        onChange={(e) => setForm((f) => ({ ...f, paymentTermsType: e.target.value }))}
                    />
                </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
                <Button variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={submit} loading={createMutation.isPending}>
                    Create Supplier
                </Button>
            </div>
        </Modal>
    );
}