import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, PackageCheck, Truck, Warehouse as WarehouseIcon, Calendar, Trash2, Eye, Printer, X, FileText, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import SearchableProductSelect from '../components/ui/SearchableProductSelect';
import { bankAccountsApi } from '../features/bankAccounts/bankAccountsApi';
import api from '../api/axios';

export default function GrnsPage() {
    const queryClient = useQueryClient();
    const [filters, setFilters] = useState({ search: '', page: 1, limit: 15 });
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedGrnId, setSelectedGrnId] = useState(null);
    
    // Form state for new GRN (direct)
    const [supplierId, setSupplierId] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [items, setItems] = useState([{ productId: '', receivedQuantity: 1, unitPrice: 0, discountPercent: 0, discountAmount: 0, freeQuantity: 0 }]);
    const [billDiscountPercent, setBillDiscountPercent] = useState('');
    const [billDiscountAmount, setBillDiscountAmount] = useState('');
    const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
    const [supplierDN, setSupplierDN] = useState('');

    // Optional settlement payment at GRN creation
    const [paidAmount, setPaidAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [bankAccountId, setBankAccountId] = useState('');
    const [paymentReference, setPaymentReference] = useState('');
    const [chequeNumber, setChequeNumber] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['grns', filters],
        queryFn: async () => {
            const { data } = await api.get('/grns', { params: filters });
            return data;
        }
    });

    const { data: grnDetailData, isLoading: loadingDetail } = useQuery({
        queryKey: ['grn-detail', selectedGrnId],
        queryFn: async () => (await api.get(`/grns/${selectedGrnId}`)).data,
        enabled: !!selectedGrnId,
    });
    const activeGrn = grnDetailData?.data || null;

    const { data: suppliersData } = useQuery({ queryKey: ['suppliers', 'all'], queryFn: async () => (await api.get('/suppliers?limit=500')).data });
    const { data: warehousesData } = useQuery({ queryKey: ['warehouses', 'all'], queryFn: async () => (await api.get('/warehouses?limit=500')).data });
    const { data: productsData } = useQuery({ queryKey: ['products', 'all'], queryFn: async () => (await api.get('/products?limit=500')).data });
    const { data: bankAccountsData } = useQuery({ queryKey: ['bank-accounts'], queryFn: () => bankAccountsApi.list() });
    const bankAccounts = bankAccountsData?.data || [];

    const { data: supplierBalanceData } = useQuery({
        queryKey: ['supplier-balance', supplierId],
        queryFn: async () => (await api.get(`/suppliers/${supplierId}/balance`)).data,
        enabled: !!supplierId,
        staleTime: 0,
    });
    const oldSupplierBalance = supplierBalanceData?.data?.outstandingBalance || 0;

    const createMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await api.post('/grns', payload);
            return res.data;
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['grns'] });
            queryClient.invalidateQueries({ queryKey: ['bills'] });
            queryClient.invalidateQueries({ queryKey: ['payablesAging'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['stock'] });
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            queryClient.invalidateQueries({ queryKey: ['supplier-balance'] });
            queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['financial-pnl'] });
            queryClient.invalidateQueries({ queryKey: ['financialReports'] });
            toast.success('Goods received and Supplier Bill created successfully!');
            setIsFormOpen(false);
            setItems([{ productId: '', receivedQuantity: 1, unitPrice: 0, discountPercent: 0, discountAmount: 0, freeQuantity: 0 }]);
            setBillDiscountPercent('');
            setBillDiscountAmount('');
            setPaidAmount('');
            setPaymentMethod('cash');
            setBankAccountId('');
            setPaymentReference('');
            setChequeNumber('');
            setSupplierInvoiceNumber('');
            setSupplierDN('');
            if (res?.data?._id) {
                setSelectedGrnId(res.data._id);
            }
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => (await api.delete(`/grns/${id}`)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['grns'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['stock'] });
            queryClient.invalidateQueries({ queryKey: ['warehouses'] });
            toast.success('GRN cancelled and stock reversed');
            setSelectedGrnId(null);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Cancellation failed')
    });

    const grns = data?.data || [];
    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(n || 0);

    const columns = [
        { 
            key: 'grnNumber', 
            label: 'GRN #', 
            render: (r) => (
                <button 
                    onClick={() => setSelectedGrnId(r._id)}
                    className="font-mono font-bold text-primary-600 hover:text-primary-800 hover:underline flex items-center gap-1.5 transition"
                >
                    <PackageCheck size={15} className="text-primary-600 flex-shrink-0" />
                    <span>{r.grnNumber}</span>
                </button>
            ) 
        },
        { key: 'receiptDate', label: 'Date', render: (r) => new Date(r.receiptDate).toLocaleDateString() },
        { key: 'supplier', label: 'Supplier', render: (r) => r.supplierName || r.supplierId?.displayName },
        { key: 'warehouse', label: 'Warehouse', render: (r) => r.warehouseId?.name },
        { key: 'po', label: 'PO #', render: (r) => r.poNumber ? <Badge variant="info">{r.poNumber}</Badge> : <span className="text-gray-400">Direct</span> },
        { key: 'value', label: 'Total Value', render: (r) => <span className="font-bold">{fmt(r.totalReceivedValue)}</span> },
        { key: 'status', label: 'Status', render: (r) => <Badge variant={r.status === 'cancelled' ? 'danger' : 'success'}>{r.status}</Badge> },
        { 
            key: 'actions', label: 'Actions', render: (r) => (
                <div className="flex items-center justify-end gap-1">
                    <button 
                        onClick={() => setSelectedGrnId(r._id)}
                        className="p-1.5 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition"
                        title="View GRN Details"
                    >
                        <Eye size={16} />
                    </button>
                    {r.status !== 'cancelled' && (
                        <button 
                            onClick={() => { if(window.confirm(`Cancel GRN ${r.grnNumber}? Stock will be reversed.`)) deleteMutation.mutate(r._id) }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancel GRN"
                            disabled={deleteMutation.isPending}
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            )
        }
    ];

    const addLine = () => setItems([...items, { productId: '', receivedQuantity: 1, unitPrice: 0, discountPercent: 0, discountAmount: 0, freeQuantity: 0 }]);
    const removeLine = (idx) => setItems(items.filter((_, i) => i !== idx));
    const updateLine = (idx, f, v) => {
        const newItems = [...items];
        newItems[idx] = { ...newItems[idx], [f]: v };
        
        if (f === 'productId' && v) {
            const p = productsData?.data?.find(x => x._id === v);
            if (p) {
                newItems[idx].unitPrice = p.purchasePrice != null ? p.purchasePrice : (p.basePrice || 0);
                const lineTotal = (+newItems[idx].receivedQuantity || 0) * (+newItems[idx].unitPrice || 0);
                if (+newItems[idx].discountPercent > 0) {
                    newItems[idx].discountAmount = ((lineTotal * (+newItems[idx].discountPercent)) / 100).toFixed(2);
                }
            }
        } else if (f === 'receivedQuantity' || f === 'unitPrice') {
            const lineTotal = (+newItems[idx].receivedQuantity || 0) * (+newItems[idx].unitPrice || 0);
            if (+newItems[idx].discountPercent > 0) {
                newItems[idx].discountAmount = ((lineTotal * (+newItems[idx].discountPercent)) / 100).toFixed(2);
            }
        } else if (f === 'discountPercent') {
            const lineTotal = (+newItems[idx].receivedQuantity || 0) * (+newItems[idx].unitPrice || 0);
            newItems[idx].discountAmount = v ? ((lineTotal * (+v)) / 100).toFixed(2) : '';
        } else if (f === 'discountAmount') {
            const lineTotal = (+newItems[idx].receivedQuantity || 0) * (+newItems[idx].unitPrice || 0);
            newItems[idx].discountPercent = v && lineTotal > 0 ? (((+v) / lineTotal) * 100).toFixed(2) : '';
        }

        setItems(newItems);
    };

    const submit = () => {
        if (!supplierId || !warehouseId) return toast.error('Select supplier and warehouse');
        const validItems = items.filter(i => i.productId && (Number(i.receivedQuantity) > 0 || Number(i.freeQuantity) > 0));
        if (validItems.length === 0) return toast.error('Add at least one item');

        createMutation.mutate({
            supplierId, warehouseId,
            supplierInvoiceNumber,
            supplierDeliveryNoteNumber: supplierDN,
            billDiscountPercent: +billDiscountPercent || 0,
            billDiscountAmount: +billDiscountAmount || 0,
            paidAmount: +paidAmount || 0,
            paymentMethod,
            bankAccountId: paymentMethod === 'bank_transfer' ? bankAccountId : undefined,
            chequeNumber: paymentMethod === 'cheque' ? chequeNumber : undefined,
            paymentReference,
            items: validItems.map(i => ({ 
                ...i, 
                receivedQuantity: +i.receivedQuantity || 0, 
                acceptedQuantity: +i.receivedQuantity || 0, 
                unitPrice: +i.unitPrice || 0,
                discountPercent: +i.discountPercent || 0,
                discountAmount: +i.discountAmount || 0,
                freeQuantity: +i.freeQuantity || 0
            }))
        });
    };

    const calculateDirectTotals = () => {
        let totalReceivedQty = 0;
        let totalFreeQty = 0;
        let subtotal = 0;
        let lineDiscounts = 0;

        items.forEach((i) => {
            const recQty = +i.receivedQuantity || 0;
            const freeQty = +i.freeQuantity || 0;
            const price = +i.unitPrice || 0;
            const lineGross = recQty * price;
            const discount = +i.discountAmount || (lineGross * (+i.discountPercent || 0) / 100);

            totalReceivedQty += recQty;
            totalFreeQty += freeQty;
            subtotal += lineGross;
            lineDiscounts += discount;
        });

        const totalStockQty = totalReceivedQty + totalFreeQty;
        const valueBeforeBillDiscount = Math.max(0, subtotal - lineDiscounts);

        const billDiscPercentVal = +billDiscountPercent || 0;
        const billDiscPercentAmt = (valueBeforeBillDiscount * billDiscPercentVal) / 100;
        const billDiscFixedAmt = +billDiscountAmount || 0;
        const totalBillDiscount = billDiscPercentAmt + billDiscFixedAmt;

        const grandTotal = Math.max(0, valueBeforeBillDiscount - totalBillDiscount);
        const effectiveUnitCost = totalStockQty > 0 ? (grandTotal / totalStockQty) : 0;

        return {
            totalReceivedQty,
            totalFreeQty,
            totalStockQty,
            subtotal,
            lineDiscounts,
            valueBeforeBillDiscount,
            totalBillDiscount,
            grandTotal,
            effectiveUnitCost,
        };
    };

    const directTotals = calculateDirectTotals();

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Goods Received Notes" 
                description="View and record incoming goods (GRNs)"
                icon={PackageCheck}
                actions={
                    <Button variant="primary" onClick={() => setIsFormOpen(true)}>
                        <Plus size={16} className="mr-1.5" /> New Direct GRN
                    </Button>
                }
            />

            <Card>
                <div className="p-4 border-b">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search by GRN number..." 
                            className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                            value={filters.search}
                            onChange={(e) => setFilters({...filters, search: e.target.value, page: 1})}
                        />
                    </div>
                </div>
                {isLoading ? <div className="py-20 text-center">Loading...</div> : <Table columns={columns} data={grns} />}
            </Card>

            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="New Direct GRN (No PO)" size="lg">
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <Select label="Supplier *" required options={(suppliersData?.data || []).map(s => ({ value: s._id, label: s.displayName }))}
                            value={supplierId} onChange={(e) => setSupplierId(e.target.value)} />
                        <Select label="Warehouse *" required options={(warehousesData?.data || []).map(w => ({ value: w._id, label: w.name }))}
                            value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} />
                        <Input label="Supplier Invoice #" placeholder="e.g. INV-9901" value={supplierInvoiceNumber} onChange={(e) => setSupplierInvoiceNumber(e.target.value)} />
                        <Input label="Delivery Note #" placeholder="e.g. DN-5420" value={supplierDN} onChange={(e) => setSupplierDN(e.target.value)} />

                        {oldSupplierBalance > 0 && (
                            <div className="sm:col-span-2 md:col-span-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-amber-900">⚠️ Previous Outstanding Balance:</span>
                                    <span className="text-amber-700">Accumulated from prior unpaid bills/deliveries</span>
                                </div>
                                <span className="font-bold text-amber-950 font-mono text-sm">
                                    {fmt(oldSupplierBalance)}
                                </span>
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-semibold">Items</h4>
                            <Button size="sm" variant="outline" onClick={addLine}>Add Item</Button>
                        </div>
                        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                            {items.map((item, idx) => {
                                const recQty = +item.receivedQuantity || 0;
                                const freeQty = +item.freeQuantity || 0;
                                const unitPrice = +item.unitPrice || 0;
                                const totalQty = recQty + freeQty;
                                const lineGross = recQty * unitPrice;
                                const lineDisc = +item.discountAmount || (lineGross * (+item.discountPercent || 0) / 100);
                                const lineNet = Math.max(0, lineGross - lineDisc);
                                const effectiveCost = totalQty > 0 ? (lineNet / totalQty) : 0;

                                return (
                                    <div key={idx} className="border border-gray-200 bg-white p-3.5 rounded-xl space-y-2.5 shadow-2xs">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Product</label>
                                                <SearchableProductSelect
                                                    products={productsData?.data || []}
                                                    value={item.productId}
                                                    onChange={(pId) => updateLine(idx, 'productId', pId)}
                                                    placeholder="Type product name, code or barcode to select..."
                                                />
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => removeLine(idx)} className="text-red-600 mt-5">Remove</Button>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                                            <Input type="number" step="0.01" min="0" label="Billed Qty" value={item.receivedQuantity} onChange={(e) => updateLine(idx, 'receivedQuantity', e.target.value)} />
                                            <Input type="number" step="0.01" min="0" label="Unit Price" value={item.unitPrice} onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)} />
                                            <Input type="number" step="0.01" min="0" label="Free Qty (Bonus)" value={item.freeQuantity} onChange={(e) => updateLine(idx, 'freeQuantity', e.target.value)} />
                                            <Input type="number" step="0.01" min="0" max="100" label="Disc(%)" value={item.discountPercent} onChange={(e) => updateLine(idx, 'discountPercent', e.target.value)} />
                                            <Input type="number" step="0.01" min="0" label="Disc(Rs)" value={item.discountAmount} onChange={(e) => updateLine(idx, 'discountAmount', e.target.value)} />
                                        </div>

                                        {/* Real-time Calculation Badge for Line */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-gray-700">
                                                    📦 Stock In: <strong className="text-gray-900">{totalQty} units</strong>
                                                </span>
                                                {freeQty > 0 && (
                                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                        +{freeQty} Free Bonus
                                                    </span>
                                                )}
                                                {freeQty > 0 && (
                                                    <span className="text-gray-500 text-[11px]">
                                                        (Effective: Rs. {effectiveCost.toFixed(2)}/unit)
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className="text-gray-500">Line Cost: </span>
                                                <strong className="text-gray-900 font-bold">Rs. {lineNet.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {items.length > 0 && (
                        <div className="border-t pt-4 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
                            <div className="grid grid-cols-2 gap-4 w-full md:max-w-md">
                                <Input 
                                    label="Bill Discount (%)" 
                                    type="number" 
                                    step="0.01" 
                                    min="0" 
                                    max="100" 
                                    value={billDiscountPercent} 
                                    onChange={(e) => {
                                        setBillDiscountPercent(e.target.value);
                                        if (e.target.value) setBillDiscountAmount('');
                                    }} 
                                />
                                <Input 
                                    label="Bill Discount (Rs)" 
                                    type="number" 
                                    step="0.01" 
                                    min="0" 
                                    value={billDiscountAmount} 
                                    onChange={(e) => {
                                        setBillDiscountAmount(e.target.value);
                                        if (e.target.value) setBillDiscountPercent('');
                                    }} 
                                />
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 w-full md:max-w-xs space-y-1.5 text-xs self-stretch flex flex-col justify-center shadow-2xs">
                                <div className="flex justify-between text-gray-600">
                                    <span>Billed Items Qty:</span>
                                    <span className="font-semibold text-gray-900">{directTotals.totalReceivedQty}</span>
                                </div>
                                {directTotals.totalFreeQty > 0 && (
                                    <div className="flex justify-between text-emerald-700 font-medium">
                                        <span>Free Bonus Qty:</span>
                                        <span>+{directTotals.totalFreeQty}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-gray-700 font-semibold border-b border-gray-200 pb-1">
                                    <span>Total Physical Stock:</span>
                                    <span className="font-bold text-gray-900">{directTotals.totalStockQty} units</span>
                                </div>
                                <div className="flex justify-between text-gray-600 pt-1">
                                    <span>Subtotal:</span>
                                    <span className="font-semibold text-gray-900">{fmt(directTotals.subtotal)}</span>
                                </div>
                                {directTotals.lineDiscounts > 0 && (
                                    <div className="flex justify-between text-red-600">
                                        <span>Line Discounts:</span>
                                        <span>-{fmt(directTotals.lineDiscounts)}</span>
                                    </div>
                                )}
                                {directTotals.totalBillDiscount > 0 && (
                                    <div className="flex justify-between text-red-600 font-medium">
                                        <span>Bill Discount:</span>
                                        <span>-{fmt(directTotals.totalBillDiscount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-gray-700 font-semibold border-t border-gray-200 pt-1">
                                    <span>Current GRN Net:</span>
                                    <span className="font-bold text-gray-900">{fmt(directTotals.grandTotal)}</span>
                                </div>
                                {oldSupplierBalance > 0 && (
                                    <div className="flex justify-between text-amber-800 bg-amber-100/70 font-bold px-1.5 py-0.5 rounded">
                                        <span>+ Old Outstanding:</span>
                                        <span>+{fmt(oldSupplierBalance)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-black text-sm border-t border-gray-200 pt-1.5 text-gray-950">
                                    <span>Total Payable:</span>
                                    <span className="text-primary-700">{fmt((directTotals.grandTotal || 0) + (oldSupplierBalance || 0))}</span>
                                </div>
                                {directTotals.totalFreeQty > 0 && directTotals.totalStockQty > 0 && (
                                    <div className="text-[11px] text-gray-500 text-right pt-0.5">
                                        Landed Cost: {fmt(directTotals.effectiveUnitCost)} / unit
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Optional Immediate Settlement / Payment Card ── */}
                    {items.length > 0 && directTotals.grandTotal > 0 && (
                        <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-3">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                                        💳 Immediate Supplier Payment (Full / Partial)
                                    </span>
                                    <Badge variant="success">Auto-creates Bill</Badge>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button 
                                        type="button" 
                                        onClick={() => setPaidAmount(directTotals.grandTotal)}
                                        className="text-xs font-semibold px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition"
                                    >
                                        Pay Current ({fmt(directTotals.grandTotal)})
                                    </button>
                                    {oldSupplierBalance > 0 && (
                                        <button 
                                            type="button" 
                                            onClick={() => setPaidAmount((directTotals.grandTotal || 0) + (oldSupplierBalance || 0))}
                                            className="text-xs font-semibold px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md transition"
                                        >
                                            Settle All ({fmt((directTotals.grandTotal || 0) + (oldSupplierBalance || 0))})
                                        </button>
                                    )}
                                    {paidAmount > 0 && (
                                        <button 
                                            type="button" 
                                            onClick={() => setPaidAmount('')}
                                            className="text-xs text-gray-500 hover:text-gray-700 underline ml-1"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                                <div>
                                    <Input 
                                        label="Paid Amount (Rs)" 
                                        type="number" 
                                        step="0.01" 
                                        min="0" 
                                        max={(directTotals.grandTotal || 0) + (oldSupplierBalance || 0)}
                                        placeholder="0.00" 
                                        value={paidAmount} 
                                        onChange={(e) => setPaidAmount(e.target.value)} 
                                    />
                                </div>
                                <div>
                                    <Select 
                                        label="Payment Method" 
                                        value={paymentMethod} 
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        options={[
                                            { value: 'cash', label: 'Cash' },
                                            { value: 'bank_transfer', label: 'Bank Transfer' },
                                            { value: 'cheque', label: 'Cheque' },
                                            { value: 'card', label: 'Card' }
                                        ]}
                                    />
                                </div>
                                {paymentMethod === 'bank_transfer' ? (
                                    <div>
                                        <Select 
                                            label="Bank Account" 
                                            value={bankAccountId} 
                                            onChange={(e) => setBankAccountId(e.target.value)}
                                            options={[
                                                { value: '', label: '-- Select Bank Account --' },
                                                ...bankAccounts.map(b => ({ value: b._id, label: `${b.accountName} (${b.bankName})` }))
                                            ]}
                                        />
                                    </div>
                                ) : paymentMethod === 'cheque' ? (
                                    <div>
                                        <Input 
                                            label="Cheque Number" 
                                            placeholder="CHQ-00123" 
                                            value={chequeNumber} 
                                            onChange={(e) => setChequeNumber(e.target.value)} 
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <Input 
                                            label="Reference / Slip #" 
                                            placeholder="Txn reference..." 
                                            value={paymentReference} 
                                            onChange={(e) => setPaymentReference(e.target.value)} 
                                        />
                                    </div>
                                )}
                                <div>
                                    <div className="bg-white border border-emerald-200 rounded-lg p-2 text-xs flex flex-col justify-center h-[38px]">
                                        <span className="text-[10px] text-gray-500 font-medium">Total Remaining Due:</span>
                                        <strong className="text-gray-900 font-bold font-mono">
                                            {fmt(Math.max(0, ((directTotals.grandTotal || 0) + (oldSupplierBalance || 0)) - (Number(paidAmount) || 0)))}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex gap-2">
                        <Button variant="primary" fullWidth onClick={submit} loading={createMutation.isPending}>Confirm Receipt & Create Bill</Button>
                        <Button variant="outline" fullWidth onClick={() => setIsFormOpen(false)}>Cancel</Button>
                    </div>
                </div>
            </Modal>

            {/* ── View / Print GRN Slip Modal ── */}
            <Modal 
                isOpen={!!selectedGrnId} 
                onClose={() => setSelectedGrnId(null)} 
                title={activeGrn ? `Goods Received Note — ${activeGrn.grnNumber}` : 'Loading GRN...'} 
                size="xl"
            >
                {loadingDetail || !activeGrn ? (
                    <div className="py-20 text-center text-gray-500">Loading GRN details...</div>
                ) : (
                    <div className="p-6 space-y-6">
                        {/* Printable Document Box */}
                        <div id="grn-print-slip" className="border border-slate-200 rounded-xl p-6 bg-white space-y-6 shadow-2xs">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-primary-100 text-primary-700 rounded-lg">
                                            <PackageCheck className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">GOODS RECEIVED NOTE (GRN)</h2>
                                            <p className="font-mono text-sm font-bold text-primary-700">{activeGrn.grnNumber}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right space-y-1">
                                    <Badge variant={activeGrn.status === 'cancelled' ? 'danger' : 'success'}>
                                        {activeGrn.status?.toUpperCase()}
                                    </Badge>
                                    <p className="text-xs text-slate-500">
                                        Date: <strong className="text-slate-800">{new Date(activeGrn.receiptDate || activeGrn.createdAt).toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
                                    </p>
                                </div>
                            </div>

                            {/* Supplier & Warehouse Meta Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                                <div className="space-y-1">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase">Supplier / Vendor:</span>
                                    <p className="text-sm font-bold text-slate-900">
                                        {activeGrn.supplierName || activeGrn.supplierId?.displayName || 'Unknown Supplier'}
                                    </p>
                                    {activeGrn.supplierId?.supplierCode && (
                                        <p className="text-slate-500">Code: <span className="font-mono">{activeGrn.supplierId.supplierCode}</span></p>
                                    )}
                                    {activeGrn.supplierId?.primaryContact?.phone && (
                                        <p className="text-slate-500">Phone: {activeGrn.supplierId.primaryContact.phone}</p>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase">Destination Warehouse / Outlet:</span>
                                    <p className="text-sm font-bold text-slate-900">
                                        {activeGrn.warehouseId?.name || 'Default Warehouse'}
                                    </p>
                                    {activeGrn.warehouseId?.warehouseCode && (
                                        <p className="text-slate-500">Code: <span className="font-mono">{activeGrn.warehouseId.warehouseCode}</span></p>
                                    )}
                                    <div className="pt-1 text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                                        <span>PO: <strong>{activeGrn.purchaseOrderId?.poNumber || activeGrn.poNumber || 'Direct (No PO)'}</strong></span>
                                        {activeGrn.supplierDeliveryNoteNumber && <span>DN #: <strong>{activeGrn.supplierDeliveryNoteNumber}</strong></span>}
                                        {activeGrn.vehicleNumber && <span>Vehicle: <strong>{activeGrn.vehicleNumber}</strong></span>}
                                        {activeGrn.driverName && <span>Driver: <strong>{activeGrn.driverName}</strong></span>}
                                    </div>
                                </div>
                            </div>

                            {/* Received Items Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                                    <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="py-2.5 px-3">#</th>
                                            <th className="py-2.5 px-3">Product Name / Code</th>
                                            <th className="py-2.5 px-2 text-right">Billed Qty</th>
                                            <th className="py-2.5 px-2 text-right text-emerald-700">Free Qty</th>
                                            <th className="py-2.5 px-2 text-right font-bold text-slate-900">Total Stock In</th>
                                            <th className="py-2.5 px-3 text-right">Unit Price</th>
                                            <th className="py-2.5 px-3 text-right">Discount</th>
                                            <th className="py-2.5 px-3 text-right font-bold text-slate-900">Net Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                                        {(activeGrn.items || []).map((item, idx) => {
                                            const pName = item.productName || item.productId?.name || 'Product';
                                            const pCode = item.productCode || item.productId?.productCode || '';
                                            const billed = item.receivedQuantity || 0;
                                            const free = item.freeQuantity || 0;
                                            const totalIn = billed + free;
                                            const price = item.unitPrice || 0;
                                            const lineGross = billed * price;
                                            const disc = item.discountAmount || (lineGross * (item.discountPercent || 0) / 100);
                                            const netLine = Math.max(0, lineGross - disc);
                                            const landed = totalIn > 0 ? (netLine / totalIn) : 0;

                                            return (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                                                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                                                        <div>{pName}</div>
                                                        {pCode && <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 rounded">{pCode}</span>}
                                                    </td>
                                                    <td className="py-2.5 px-2 text-right font-semibold">{billed}</td>
                                                    <td className="py-2.5 px-2 text-right text-emerald-700 font-bold">
                                                        {free > 0 ? `+${free}` : '-'}
                                                    </td>
                                                    <td className="py-2.5 px-2 text-right font-bold text-slate-950 bg-slate-50/50">
                                                        {totalIn}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right text-slate-700 font-mono">
                                                        {fmt(price)}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right text-rose-600 font-mono">
                                                        {disc > 0 ? `-${fmt(disc)}` : '-'}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-bold text-slate-950 font-mono">
                                                        {fmt(netLine)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Summary & Totals Breakdown */}
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                                <div className="text-xs text-slate-500 space-y-1">
                                    <p>Total Items: <strong className="text-slate-800">{activeGrn.items?.length || 0} items</strong></p>
                                    <p>Total Stock Items Received: <strong className="text-slate-900">
                                        {(activeGrn.items || []).reduce((s, i) => s + (i.receivedQuantity || 0) + (i.freeQuantity || 0), 0)} units
                                    </strong></p>
                                    {activeGrn.receivedBy && (
                                        <p>Received By: <strong>{activeGrn.receivedBy.firstName} {activeGrn.receivedBy.lastName}</strong></p>
                                    )}
                                </div>

                                <div className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Raw Value:</span>
                                        <span className="font-semibold">{fmt(activeGrn.totalReceivedValue)}</span>
                                    </div>
                                    {activeGrn.billDiscountAmount > 0 && (
                                        <div className="flex justify-between text-rose-600 font-medium">
                                            <span>Bill Discount:</span>
                                            <span>-{fmt(activeGrn.billDiscountAmount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-200 pt-2">
                                        <span>Grand Total Value:</span>
                                        <span className="text-primary-700">{fmt(activeGrn.totalReceivedValue || activeGrn.totalAcceptedValue)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex justify-end gap-3 pt-2">
                            <Button 
                                variant="primary" 
                                onClick={() => window.print()}
                                className="flex items-center gap-2"
                            >
                                <Printer size={16} /> Print GRN Slip
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => setSelectedGrnId(null)}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
