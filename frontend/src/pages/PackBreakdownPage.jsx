import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Boxes, ArrowRight, RefreshCw, CheckCircle, Package,
    History, AlertCircle, Sparkles, Layers, ArrowDownRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../features/products/productsApi';
import { warehousesApi } from '../features/warehouses/warehousesApi';
import { stockApi } from '../features/stock/stockApi';
import { packBreakdownApi } from '../api/packBreakdownApi';
import SearchableProductSelect from '../components/ui/SearchableProductSelect';

export default function PackBreakdownPage() {
    const queryClient = useQueryClient();

    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [sourceProductId, setSourceProductId] = useState('');
    const [targetProductId, setTargetProductId] = useState('');
    const [packsQuantity, setPacksQuantity] = useState('1');
    const [unitsPerPack, setUnitsPerPack] = useState('100');
    const [notes, setNotes] = useState('');

    const { data: warehousesData } = useQuery({
        queryKey: ['warehouses'],
        queryFn: () => warehousesApi.list(),
    });

    const { data: productsData } = useQuery({
        queryKey: ['products', 'all'],
        queryFn: () => productsApi.list({ limit: 500 }),
    });

    const warehouses = warehousesData?.data || [];
    const products = productsData?.data || [];

    // Auto-select default warehouse
    useEffect(() => {
        if (!selectedWarehouseId && warehouses.length > 0) {
            const def = warehouses.find((w) => w.isDefault) || warehouses[0];
            if (def) setSelectedWarehouseId(def._id);
        }
    }, [warehouses, selectedWarehouseId]);

    // Fetch stock for selected warehouse
    const { data: stockData } = useQuery({
        queryKey: ['stock', selectedWarehouseId],
        queryFn: () => stockApi.list({ warehouseId: selectedWarehouseId, limit: 500 }),
        enabled: !!selectedWarehouseId,
    });

    const stockItems = stockData?.data || [];

    // Stock map
    const stockMap = useMemo(() => {
        const map = new Map();
        stockItems.forEach((s) => {
            const pid = s.productId?._id || s.productId;
            map.set(pid, s.quantities?.onHand || 0);
        });
        return map;
    }, [stockItems]);

    // Breakdown History
    const { data: historyData, isLoading: loadingHistory } = useQuery({
        queryKey: ['pack-breakdowns-history', selectedWarehouseId],
        queryFn: () => packBreakdownApi.getHistory({ warehouseId: selectedWarehouseId || undefined, limit: 30 }),
    });

    const history = historyData?.data || [];

    const sourceProduct = products.find((p) => p._id === sourceProductId);
    const targetProduct = products.find((p) => p._id === targetProductId);

    const sourceOnHand = sourceProduct ? (stockMap.get(sourceProduct._id) || 0) : 0;
    const targetOnHand = targetProduct ? (stockMap.get(targetProduct._id) || 0) : 0;

    const numPacks = Number(packsQuantity) || 0;
    const numUnitsPerPack = Number(unitsPerPack) || 0;
    const totalUnitsProduced = numPacks * numUnitsPerPack;

    // Mutation to unpack
    const unpackMutation = useMutation({
        mutationFn: (data) => packBreakdownApi.unpack(data),
        onSuccess: (res) => {
            toast.success(res.message || 'Pack unpacked successfully into retail units!');
            queryClient.invalidateQueries({ queryKey: ['stock'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['pack-breakdowns-history'] });
            setPacksQuantity('1');
            setNotes('');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to unpack items');
        },
    });

    const handleUnpack = (e) => {
        e.preventDefault();
        if (!selectedWarehouseId) {
            toast.error('Please select a warehouse');
            return;
        }
        if (!sourceProductId) {
            toast.error('Please select a Source Bulk Pack product');
            return;
        }
        if (!targetProductId) {
            toast.error('Please select a Target Retail Unit product');
            return;
        }
        if (sourceProductId === targetProductId) {
            toast.error('Source pack and target unit cannot be the same product');
            return;
        }
        if (numPacks <= 0) {
            toast.error('Packs quantity must be at least 1');
            return;
        }
        if (numUnitsPerPack <= 0) {
            toast.error('Units per pack must be at least 1');
            return;
        }
        if (sourceOnHand < numPacks) {
            toast.error(`Not enough pack stock on hand (${sourceOnHand} available)`);
            return;
        }

        unpackMutation.mutate({
            warehouseId: selectedWarehouseId,
            sourceProductId,
            targetProductId,
            packsQuantity: numPacks,
            unitsPerPack: numUnitsPerPack,
            notes,
        });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
                        <Boxes className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Pack Breakdown & Retail Unpacking</h1>
                        <p className="text-sm text-slate-500">
                            Open bulk packs/jars (e.g., Toffees, Candy jars, Boxed items) into retail individual units for POS sales
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Unpack Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        Unpack Pack Items into Retail Units
                    </h2>
                </div>

                <form onSubmit={handleUnpack} className="p-6 space-y-6">
                    {/* Warehouse selection */}
                    <div className="max-w-md">
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                            Warehouse / Shop Outlet <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={selectedWarehouseId}
                            onChange={(e) => setSelectedWarehouseId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-purple-500"
                        >
                            {warehouses.map((w) => (
                                <option key={w._id} value={w._id}>
                                    {w.name} {w.isDefault ? '(Default Outlet)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Conversion Card */}
                    <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-center">
                        {/* Source Pack Product */}
                        <div className="lg:col-span-5 bg-purple-50/50 p-5 rounded-xl border border-purple-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                                    1. Source Bulk Pack (Deducted -)
                                </span>
                                {sourceProduct && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">
                                        On Hand: {sourceOnHand} {sourceProduct.unitOfMeasure || 'packs'}
                                    </span>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    Select Pack Product <span className="text-rose-500">*</span>
                                </label>
                                <SearchableProductSelect
                                    products={products}
                                    value={sourceProductId}
                                    onChange={(pId) => setSourceProductId(pId)}
                                    placeholder="Type bulk pack product name or code..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    Number of Packs to Open <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={packsQuantity}
                                    onChange={(e) => setPacksQuantity(e.target.value)}
                                    className="w-full px-3 py-2 border border-purple-300 rounded-lg text-base font-bold text-purple-900 bg-white"
                                />
                            </div>
                        </div>

                        {/* Middle Arrow / Ratio Indicator */}
                        <div className="lg:col-span-1 flex flex-col items-center justify-center text-purple-500 py-2">
                            <div className="p-3 bg-purple-100 rounded-full">
                                <ArrowRight className="w-6 h-6 hidden lg:block" />
                                <ArrowDownRight className="w-6 h-6 lg:hidden" />
                            </div>
                            <span className="text-[11px] font-bold text-slate-500 mt-1">Converts to</span>
                        </div>

                        {/* Target Unit Product */}
                        <div className="lg:col-span-5 bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                                    2. Target Retail Unit (Added +)
                                </span>
                                {targetProduct && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                                        On Hand: {targetOnHand} {targetProduct.unitOfMeasure || 'units'}
                                    </span>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    Select Retail Unit Product <span className="text-rose-500">*</span>
                                </label>
                                <SearchableProductSelect
                                    products={products}
                                    value={targetProductId}
                                    onChange={(pId) => setTargetProductId(pId)}
                                    placeholder="Type retail unit product name or code..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    Pieces / Units per Pack <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={unitsPerPack}
                                    onChange={(e) => setUnitsPerPack(e.target.value)}
                                    className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-base font-bold text-emerald-900 bg-white"
                                    placeholder="e.g. 100"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Live Preview Box */}
                    {sourceProduct && targetProduct && (
                        <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="space-y-1 text-sm text-slate-700">
                                <p className="font-semibold text-slate-900">Stock Impact Preview:</p>
                                <p>
                                    • <span className="font-bold text-rose-600">-{numPacks} {sourceProduct.name}</span> (Pack Stock: {sourceOnHand} &rarr; {sourceOnHand - numPacks})
                                </p>
                                <p>
                                    • <span className="font-bold text-emerald-600">+{totalUnitsProduced} {targetProduct.name}</span> (Retail Stock: {targetOnHand} &rarr; {targetOnHand + totalUnitsProduced})
                                </p>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={unpackMutation.isPending || sourceOnHand < numPacks}
                                    className="px-6 py-3 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-md flex items-center gap-2 transition"
                                >
                                    {unpackMutation.isPending ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Boxes className="w-4 h-4" />
                                    )}
                                    Confirm Unpack & Update POS Stock
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>

            {/* Breakdown History Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-500" />
                        Pack Breakdown History Log
                    </h3>
                </div>

                {loadingHistory ? (
                    <div className="p-8 text-center text-slate-400">Loading history...</div>
                ) : history.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">No past pack breakdowns recorded.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="py-3 px-4">Ref #</th>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">Outlet</th>
                                    <th className="py-3 px-4">Source Pack Item</th>
                                    <th className="py-3 px-3 text-center">Packs Opened</th>
                                    <th className="py-3 px-4">Target Retail Unit</th>
                                    <th className="py-3 px-3 text-center">Units Produced</th>
                                    <th className="py-3 px-4">Performed By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
                                {history.map((h) => (
                                    <tr key={h._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-4 font-mono font-bold text-purple-700 text-xs">
                                            {h.breakdownNumber}
                                        </td>
                                        <td className="py-3 px-4 text-xs text-slate-500">
                                            {new Date(h.breakdownDate).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-4 text-xs text-slate-600">
                                            {h.warehouseId?.name}
                                        </td>
                                        <td className="py-3 px-4 font-semibold text-slate-800">
                                            {h.sourceProductName}
                                        </td>
                                        <td className="py-3 px-3 text-center text-xs font-bold text-rose-600">
                                            -{h.packsQuantity}
                                        </td>
                                        <td className="py-3 px-4 font-semibold text-emerald-800">
                                            {h.targetProductName}
                                        </td>
                                        <td className="py-3 px-3 text-center text-xs font-bold text-emerald-600">
                                            +{h.totalUnitsProduced}
                                        </td>
                                        <td className="py-3 px-4 text-xs text-slate-500">
                                            {h.performedBy?.name || 'Staff'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
