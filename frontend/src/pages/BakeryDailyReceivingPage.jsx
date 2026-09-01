import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ShoppingBag, Plus, Trash2, Save, Printer, ArrowLeft,
    CheckCircle, AlertCircle, RefreshCw, DollarSign, ArrowDownLeft,
    ArrowUpRight, Calculator, FileText, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { suppliersApi } from '../features/suppliers/suppliersApi';
import { warehousesApi } from '../features/warehouses/warehousesApi';
import { productsApi } from '../features/products/productsApi';
import { bankAccountsApi } from '../features/bankAccounts/bankAccountsApi';
import BakerySupplierModal from '../features/bakery/BakerySupplierModal';
import { bakeryApi } from '../api/bakeryApi';

export default function BakeryDailyReceivingPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const printRef = useRef(null);

    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState([]);
    const [paidAmount, setPaidAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [bankAccountId, setBankAccountId] = useState('');
    const [chequeNumber, setChequeNumber] = useState('');
    const [paymentReference, setPaymentReference] = useState('');
    const [notes, setNotes] = useState('');
    const [createdEntry, setCreatedEntry] = useState(null);
    const [showPrintModal, setShowPrintModal] = useState(false);

    // Fetch bakery suppliers, warehouses, products
    const { data: suppliersData, isLoading: loadingSuppliers } = useQuery({
        queryKey: ['suppliers', 'active', 'bakery_short_eats'],
        queryFn: () => suppliersApi.list({ category: 'bakery_short_eats', status: 'active', limit: 100 }),
    });

    const { data: warehousesData } = useQuery({
        queryKey: ['warehouses'],
        queryFn: () => warehousesApi.list(),
    });

    const { data: productsData } = useQuery({
        queryKey: ['products', 'all'],
        queryFn: () => productsApi.list({ limit: 500 }),
    });

    const { data: bankAccountsData } = useQuery({
        queryKey: ['bank-accounts'],
        queryFn: () => bankAccountsApi.list(),
    });

    const suppliers = suppliersData?.data || [];
    const warehouses = warehousesData?.data || [];
    const products = productsData?.data || [];
    const bankAccounts = bankAccountsData?.data || [];

    // Auto-select default warehouse
    useEffect(() => {
        if (!selectedWarehouseId && warehouses.length > 0) {
            const def = warehouses.find((w) => w.isDefault) || warehouses[0];
            if (def) setSelectedWarehouseId(def._id);
        }
    }, [warehouses, selectedWarehouseId]);

    // Fetch supplier outstanding balance
    const { data: balanceData, refetch: refetchBalance } = useQuery({
        queryKey: ['bakery-balance', selectedSupplierId],
        queryFn: () => bakeryApi.getBalance(selectedSupplierId),
        enabled: !!selectedSupplierId,
        staleTime: 0,
        refetchOnMount: 'always',
    });

    // Fetch supplier template items
    const { data: templateData, isLoading: loadingTemplate } = useQuery({
        queryKey: ['bakery-template', selectedSupplierId],
        queryFn: () => bakeryApi.getTemplate(selectedSupplierId),
        enabled: !!selectedSupplierId,
    });

    const previousBalance = balanceData?.data?.outstandingBalance || 0;

    // Populate items when template loads or supplier changes
    useEffect(() => {
        if (templateData?.data?.items && templateData.data.items.length > 0) {
            const templateItems = templateData.data.items.map((t) => ({
                productId: t.productId?._id || t.productId,
                productCode: t.productCode || t.productId?.productCode || '',
                productName: t.productName || t.productId?.name || '',
                buyPrice: t.defaultBuyPrice || 0,
                sellPrice: t.defaultSellPrice || 0,
                isDailyReturnable: t.isDailyReturnable !== false,
                shelfLifeDays: t.shelfLifeDays || 1,
                receivedQty: 0,
                returnedQty: 0,
            }));
            setItems(templateItems);
        } else if (selectedSupplierId) {
            setItems([]);
        }
    }, [templateData, selectedSupplierId]);

    // Handle Item field updates
    const handleItemChange = (index, field, value) => {
        setItems((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    // Add extra product row
    const handleAddProduct = (productId) => {
        if (!productId) return;
        const prod = products.find((p) => p._id === productId);
        if (!prod) return;

        // Check if already in list
        const exists = items.some((i) => i.productId === prod._id);
        if (exists) {
            toast.error('Item is already in the list');
            return;
        }

        setItems((prev) => [
            ...prev,
            {
                productId: prod._id,
                productCode: prod.productCode || '',
                productName: prod.name,
                buyPrice: prod.purchasePrice || 0,
                sellPrice: prod.basePrice || 0,
                receivedQty: 0,
                returnedQty: 0,
            },
        ]);
    };

    const handleRemoveItem = (index) => {
        setItems((prev) => prev.filter((_, idx) => idx !== index));
    };

    // Calculations
    const totals = useMemo(() => {
        let grossSupply = 0;
        let totalReturns = 0;
        let totalReceivedQty = 0;
        let totalReturnedQty = 0;
        let expectedGrossSales = 0;

        items.forEach((item) => {
            const buy = Number(item.buyPrice) || 0;
            const sell = Number(item.sellPrice) || 0;
            const rec = Number(item.receivedQty) || 0;
            const ret = Number(item.returnedQty) || 0;

            grossSupply += rec * buy;
            totalReturns += ret * buy;
            totalReceivedQty += rec;
            totalReturnedQty += ret;
            expectedGrossSales += rec * sell;
        });

        const netSupply = grossSupply - totalReturns;
        const totalPayable = previousBalance + netSupply;
        const paid = Number(paidAmount) || 0;
        const closingBalance = totalPayable - paid;
        const expectedProfit = expectedGrossSales - grossSupply;

        return {
            grossSupply: +grossSupply.toFixed(2),
            totalReturns: +totalReturns.toFixed(2),
            netSupply: +netSupply.toFixed(2),
            totalPayable: +totalPayable.toFixed(2),
            paid: +paid.toFixed(2),
            closingBalance: +closingBalance.toFixed(2),
            expectedProfit: +expectedProfit.toFixed(2),
            totalReceivedQty,
            totalReturnedQty,
        };
    }, [items, previousBalance, paidAmount]);

    // Mutation to submit daily entry
    const createMutation = useMutation({
        mutationFn: (data) => bakeryApi.createDailyEntry(data),
        onSuccess: (res) => {
            toast.success('Daily bakery receiving & settlement recorded successfully!');
            queryClient.invalidateQueries({ queryKey: ['bakery-balance'] });
            queryClient.invalidateQueries({ queryKey: ['bakery-entries'] });
            queryClient.invalidateQueries({ queryKey: ['stock'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setCreatedEntry(res.data);
            setShowPrintModal(true);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to record daily entry');
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedSupplierId) {
            toast.error('Please select a supplier');
            return;
        }
        if (!selectedWarehouseId) {
            toast.error('Please select a warehouse');
            return;
        }
        if (items.length === 0) {
            toast.error('Please add at least one bakery item');
            return;
        }

        // Validate that at least some quantity is received or returned
        const hasQty = items.some((i) => (Number(i.receivedQty) || 0) > 0 || (Number(i.returnedQty) || 0) > 0);
        if (!hasQty) {
            toast.error('Please enter received or returned quantity for at least one item');
            return;
        }

        const payload = {
            supplierId: selectedSupplierId,
            warehouseId: selectedWarehouseId,
            entryDate,
            items: items.map((i) => ({
                productId: i.productId,
                productCode: i.productCode,
                productName: i.productName,
                buyPrice: Number(i.buyPrice) || 0,
                sellPrice: Number(i.sellPrice) || 0,
                receivedQty: Number(i.receivedQty) || 0,
                returnedQty: Number(i.returnedQty) || 0,
            })),
            financials: {
                previousBalance,
                paidAmount: Number(paidAmount) || 0,
                paymentMethod,
                bankAccountId: bankAccountId || undefined,
                chequeNumber: chequeNumber || undefined,
                paymentReference,
            },
            notes,
        };

        createMutation.mutate(payload);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleResetForm = () => {
        setItems([]);
        setSelectedSupplierId('');
        setPaidAmount('');
        setNotes('');
        setCreatedEntry(null);
        setShowPrintModal(false);
    };

    const currentSupplier = suppliers.find((s) => s._id === selectedSupplierId);
    const currentWarehouse = warehouses.find((w) => w._id === selectedWarehouseId);

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 sm:p-3 bg-amber-50 rounded-lg text-amber-600 flex-shrink-0">
                        <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-slate-800 leading-tight">Daily Bakery & Short Eats Receiving</h1>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Record daily delivered stock, deduct returns, calculate profit & settle supplier balances</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => navigate('/bakery/templates')}
                        className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                    >
                        Templates
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/bakery/history')}
                        className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                    >
                        History & Ledger
                    </button>
                </div>
            </div>

            {/* Selection Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Supplier / Baker <span className="text-rose-500">*</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => setIsSupplierModalOpen(true)}
                            className="text-xs font-bold text-amber-600 hover:text-amber-700 underline"
                        >
                            + Add New Supplier
                        </button>
                    </div>
                    <select
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm font-medium text-slate-800"
                    >
                        <option value="">-- Select Bakery Supplier --</option>
                        {suppliers.map((s) => (
                            <option key={s._id} value={s._id}>
                                {s.displayName} {s.supplierCode ? `(${s.supplierCode})` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Receiving Warehouse / Shop <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={selectedWarehouseId}
                        onChange={(e) => setSelectedWarehouseId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm font-medium text-slate-800"
                    >
                        {warehouses.map((w) => (
                            <option key={w._id} value={w._id}>
                                {w.name} {w.isDefault ? '(Default)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Delivery Date
                    </label>
                    <input
                        type="date"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm text-slate-800"
                    />
                </div>
            </div>

            {/* Financial Summary Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Previous Balance</p>
                    <p className="text-lg font-bold text-slate-800 mt-1">Rs. {previousBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
                    <span className="text-[11px] text-slate-400">Carried forward</span>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <p className="text-xs font-semibold text-blue-600 uppercase">Today's Gross Supply</p>
                    <p className="text-lg font-bold text-blue-900 mt-1">Rs. {totals.grossSupply.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
                    <span className="text-[11px] text-blue-500">{totals.totalReceivedQty} items received</span>
                </div>

                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                    <p className="text-xs font-semibold text-rose-600 uppercase">Today's Returns</p>
                    <p className="text-lg font-bold text-rose-900 mt-1">- Rs. {totals.totalReturns.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
                    <span className="text-[11px] text-rose-500">{totals.totalReturnedQty} items returned</span>
                </div>

                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <p className="text-xs font-semibold text-indigo-600 uppercase">Net Payable Today</p>
                    <p className="text-lg font-bold text-indigo-900 mt-1">Rs. {totals.totalPayable.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
                    <span className="text-[11px] text-indigo-500">Prev Bal + Net Supply</span>
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-600 uppercase">New Closing Balance</p>
                    <p className="text-lg font-bold text-emerald-900 mt-1">Rs. {totals.closingBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
                    <span className="text-[11px] text-emerald-500">Remaining to carry over</span>
                </div>

                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <p className="text-xs font-semibold text-amber-700 uppercase">Expected Profit</p>
                    <p className="text-lg font-bold text-amber-900 mt-1">Rs. {totals.expectedProfit.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
                    <span className="text-[11px] text-amber-600">On full retail sales</span>
                </div>
            </div>

            {/* Daily Items Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold text-slate-800">Daily Stock & Price Breakdown</h2>
                        <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                            {items.length} items
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            onChange={(e) => {
                                handleAddProduct(e.target.value);
                                e.target.value = '';
                            }}
                            defaultValue=""
                            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white"
                        >
                            <option value="" disabled>+ Quick Add Extra Product...</option>
                            {products.map((p) => (
                                <option key={p._id} value={p._id}>
                                    {p.name} ({p.productCode}) - Buy: {p.purchasePrice || 0} / Sell: {p.basePrice}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {items.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <ShoppingBag className="w-12 h-12 mx-auto mb-2 stroke-[1.5] text-slate-300" />
                        <p className="text-base font-medium text-slate-600">No bakery items loaded</p>
                        <p className="text-xs text-slate-400 mt-1">
                            {selectedSupplierId
                                ? 'Select products using the "+ Quick Add Extra Product" dropdown above, or configure a template for this supplier.'
                                : 'Please select a bakery supplier above to load their daily items.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100/70 text-slate-600 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="py-3 px-4">#</th>
                                    <th className="py-3 px-4">Item Name / Code</th>
                                    <th className="py-3 px-3 text-right">Buy Price (Rs.)</th>
                                    <th className="py-3 px-3 text-right">Sell Price (Rs.)</th>
                                    <th className="py-3 px-3 text-right">Profit / Unit</th>
                                    <th className="py-3 px-3 text-center bg-blue-50/70 text-blue-800">Received Qty (In)</th>
                                    <th className="py-3 px-3 text-center bg-rose-50/70 text-rose-800">Returned Qty (Out)</th>
                                    <th className="py-3 px-3 text-right">Supply Total (Rs.)</th>
                                    <th className="py-3 px-3 text-right">Return Deduct (Rs.)</th>
                                    <th className="py-3 px-3 text-right text-emerald-700">Exp. Profit (Rs.)</th>
                                    <th className="py-3 px-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                                {items.map((item, idx) => {
                                    const buy = Number(item.buyPrice) || 0;
                                    const sell = Number(item.sellPrice) || 0;
                                    const unitProfit = +(sell - buy).toFixed(2);
                                    const rec = Number(item.receivedQty) || 0;
                                    const ret = Number(item.returnedQty) || 0;
                                    const supplyTotal = +(rec * buy).toFixed(2);
                                    const returnTotal = +(ret * buy).toFixed(2);
                                    const profitTotal = +((rec - ret) * unitProfit).toFixed(2);

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4 text-xs text-slate-400">{idx + 1}</td>
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-slate-800">{item.productName}</div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {item.productCode && <span className="text-[10px] text-slate-400 font-mono">{item.productCode}</span>}
                                                    {item.isDailyReturnable !== false ? (
                                                        <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                                            🥐 Daily
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                                                            🍪 Shelf
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.5"
                                                    value={item.buyPrice}
                                                    onChange={(e) => handleItemChange(idx, 'buyPrice', e.target.value)}
                                                    className="w-20 px-2 py-1 text-right text-xs border border-slate-200 rounded focus:ring-1 focus:ring-amber-500 font-medium"
                                                />
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.5"
                                                    value={item.sellPrice}
                                                    onChange={(e) => handleItemChange(idx, 'sellPrice', e.target.value)}
                                                    className="w-20 px-2 py-1 text-right text-xs border border-slate-200 rounded focus:ring-1 focus:ring-amber-500 font-medium"
                                                />
                                            </td>
                                            <td className="py-3 px-3 text-right text-xs font-semibold text-amber-700">
                                                Rs. {unitProfit.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-3 text-center bg-blue-50/30">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.receivedQty || ''}
                                                    placeholder="0"
                                                    onChange={(e) => handleItemChange(idx, 'receivedQty', e.target.value)}
                                                    className="w-20 px-2 py-1 text-center text-sm font-bold border border-blue-300 rounded bg-white text-blue-900 focus:ring-2 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="py-3 px-3 text-center bg-rose-50/30">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.returnedQty || ''}
                                                    placeholder="0"
                                                    onChange={(e) => handleItemChange(idx, 'returnedQty', e.target.value)}
                                                    className="w-20 px-2 py-1 text-center text-sm font-bold border border-rose-300 rounded bg-white text-rose-900 focus:ring-2 focus:ring-rose-500"
                                                />
                                            </td>
                                            <td className="py-3 px-3 text-right font-semibold text-slate-800 text-xs">
                                                Rs. {supplyTotal.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-3 text-right font-semibold text-rose-600 text-xs">
                                                {returnTotal > 0 ? `- Rs. ${returnTotal.toFixed(2)}` : 'Rs. 0.00'}
                                            </td>
                                            <td className="py-3 px-3 text-right font-semibold text-emerald-600 text-xs">
                                                Rs. {profitTotal.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(idx)}
                                                    className="p-1 text-slate-400 hover:text-rose-500 transition"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Payment & Settlement Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    Supplier Payment & Settlement
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                            Today's Paid Amount (Rs.)
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={paidAmount}
                            placeholder="Enter amount paid today"
                            onChange={(e) => setPaidAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] text-slate-400">Enter 0 for full credit</span>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                            Payment Method
                        </label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="cash">Cash Payment</option>
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="cheque">Cheque</option>
                            <option value="none">No Payment (Credit Only)</option>
                        </select>
                    </div>

                    {paymentMethod === 'bank_transfer' ? (
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                Bank Account
                            </label>
                            <select
                                value={bankAccountId}
                                onChange={(e) => setBankAccountId(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800"
                            >
                                <option value="">-- Choose Bank Account --</option>
                                {bankAccounts.map((b) => (
                                    <option key={b._id} value={b._id}>
                                        {b.accountName} ({b.bankName})
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : paymentMethod === 'cheque' ? (
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                Cheque Number
                            </label>
                            <input
                                type="text"
                                value={chequeNumber}
                                placeholder="e.g. CHQ-789012"
                                onChange={(e) => setChequeNumber(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                Reference No.
                            </label>
                            <input
                                type="text"
                                value={paymentReference}
                                placeholder="e.g. Receipt # / Voucher #"
                                onChange={(e) => setPaymentReference(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                            Notes / Memo
                        </label>
                        <input
                            type="text"
                            value={notes}
                            placeholder="e.g. Morning delivery short-eats"
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800"
                        />
                    </div>
                </div>

                {/* Final Action Button */}
                <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-800">Remaining to Carry Forward:</span>{' '}
                        <span className="font-bold text-base text-rose-600">
                            Rs. {totals.closingBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleResetForm}
                            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        >
                            Clear Form
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={createMutation.isPending || items.length === 0}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-2 transition"
                        >
                            {createMutation.isPending ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Save & Update POS Stock
                        </button>
                    </div>
                </div>
            </div>

            {/* Print Slip Modal */}
            {showPrintModal && createdEntry && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b pb-3">
                            <div className="flex items-center gap-2 text-emerald-600">
                                <CheckCircle className="w-5 h-5" />
                                <h3 className="font-bold text-slate-800 text-base">Delivery Slip Saved</h3>
                            </div>
                            <button
                                onClick={() => setShowPrintModal(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Printable Area */}
                        <div ref={printRef} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-xs font-mono space-y-3">
                            <div className="text-center border-b pb-2">
                                <h2 className="text-sm font-bold uppercase">BAKERY DELIVERY & SETTLEMENT SLIP</h2>
                                <p className="text-[11px] text-slate-500">Entry #: {createdEntry.entryNumber}</p>
                                <p className="text-[11px] text-slate-500">Date: {new Date(createdEntry.entryDate).toLocaleDateString()}</p>
                            </div>

                            <div className="text-[11px] space-y-1">
                                <p><span className="font-bold">Supplier:</span> {createdEntry.supplierId?.displayName || currentSupplier?.displayName}</p>
                                <p><span className="font-bold">Shop/Warehouse:</span> {createdEntry.warehouseId?.name || currentWarehouse?.name}</p>
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
                                    {createdEntry.items?.map((it, idx) => (
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
                                <p>Today Gross Supply: <span className="font-bold">Rs. {createdEntry.financials?.grossSupplyAmount?.toFixed(2)}</span></p>
                                <p>Today Returns Deducted: <span className="font-bold text-rose-600">- Rs. {createdEntry.financials?.totalReturnAmount?.toFixed(2)}</span></p>
                                <p>Previous Balance: <span className="font-bold">Rs. {createdEntry.financials?.previousBalance?.toFixed(2)}</span></p>
                                <p className="font-bold border-t border-slate-300 pt-1 text-xs">Total Net Payable: Rs. {createdEntry.financials?.totalPayable?.toFixed(2)}</p>
                                <p>Paid Today ({createdEntry.financials?.paymentMethod}): <span className="font-bold text-emerald-600">Rs. {createdEntry.financials?.paidAmount?.toFixed(2)}</span></p>
                                <p className="font-bold text-xs text-rose-700 border-t border-dashed pt-1">
                                    Closing Balance Due: Rs. {createdEntry.financials?.closingBalance?.toFixed(2)}
                                </p>
                            </div>

                            <div className="border-t pt-2 text-center text-[10px] text-slate-400">
                                Generated by Dinesh Food Court POS System
                            </div>
                        </div>

                        {/* Modal buttons */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPrintModal(false);
                                    handleResetForm();
                                }}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Done
                            </button>
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg flex items-center gap-2"
                            >
                                <Printer className="w-4 h-4" />
                                Print Delivery Slip
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Dedicated Bakery Supplier Modal */}
            <BakerySupplierModal
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                onCreated={(newSupplier) => {
                    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
                    if (newSupplier?._id) {
                        setSelectedSupplierId(newSupplier._id);
                    }
                }}
            />
        </div>
    );
}
