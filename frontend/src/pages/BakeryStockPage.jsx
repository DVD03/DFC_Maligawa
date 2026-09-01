import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Croissant, Search, Filter, RefreshCw, AlertTriangle, CheckCircle,
    Package, Sparkles, TrendingUp, DollarSign, Calendar, Layers, Clock, ShieldCheck
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { bakeryApi } from '../api/bakeryApi';
import { warehousesApi } from '../features/warehouses/warehousesApi';
import { suppliersApi } from '../features/suppliers/suppliersApi';

export default function BakeryStockPage() {
    const [search, setSearch] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [itemType, setItemType] = useState('all'); // all, daily, shelf
    const [statusFilter, setStatusFilter] = useState('all'); // all, in_stock, low_stock, out_of_stock

    const { data: stockRes, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['bakery-stock', { search, supplierId: selectedSupplierId, warehouseId: selectedWarehouseId, itemType }],
        queryFn: () => bakeryApi.getStockLevels({
            search,
            supplierId: selectedSupplierId || undefined,
            warehouseId: selectedWarehouseId || undefined,
            itemType: itemType !== 'all' ? itemType : undefined,
        }),
    });

    const { data: suppliersData } = useQuery({
        queryKey: ['suppliers', 'all'],
        queryFn: () => suppliersApi.list({ limit: 500 }),
    });

    const { data: warehousesData } = useQuery({
        queryKey: ['warehouses', 'all'],
        queryFn: () => warehousesApi.list({ limit: 500 }),
    });

    const allItems = stockRes?.data || [];
    const summary = stockRes?.summary || {
        totalItems: 0,
        totalUnitsOnHand: 0,
        totalRetailValue: 0,
        totalCostValue: 0,
        expectedGrossProfit: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        dailyFreshCount: 0,
        multiDayShelfCount: 0,
    };

    const suppliers = suppliersData?.data || [];
    const warehouses = warehousesData?.data || [];

    // Filter by stock status if selected
    const filteredItems = allItems.filter((item) => {
        if (statusFilter === 'in_stock') return item.status === 'in_stock';
        if (statusFilter === 'low_stock') return item.status === 'low_stock';
        if (statusFilter === 'out_of_stock') return item.status === 'out_of_stock';
        return true;
    });

    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(n || 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="Bakery & Short Eats Stock Levels"
                description="Live counter inventory, physical on-hand stock, and retail valuation for fresh & packaged bakery goods"
                icon={Croissant}
                actions={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="flex items-center gap-1.5"
                        >
                            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
                            Refresh Live
                        </Button>
                    </div>
                }
            />

            {/* KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Total On-Hand Stock</p>
                            <h3 className="text-2xl font-black text-amber-950 mt-1">{summary.totalUnitsOnHand.toLocaleString()} <span className="text-sm font-medium text-amber-800">units</span></h3>
                            <p className="text-[11px] text-amber-700 mt-1 font-medium">{summary.totalItems} active bakery products</p>
                        </div>
                        <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
                            <Croissant className="w-6 h-6" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Total Retail Value</p>
                            <h3 className="text-2xl font-black text-emerald-950 mt-1">{fmt(summary.totalRetailValue)}</h3>
                            <p className="text-[11px] text-emerald-700 mt-1 font-medium">Cost: {fmt(summary.totalCostValue)}</p>
                        </div>
                        <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border-purple-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-purple-900 uppercase tracking-wider">Item Categories</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-bold text-purple-950">🥐 {summary.dailyFreshCount} Daily</span>
                                <span className="text-slate-300">|</span>
                                <span className="text-sm font-bold text-purple-950">🍪 {summary.multiDayShelfCount} Shelf</span>
                            </div>
                            <p className="text-[11px] text-purple-700 mt-1 font-medium">Multi-day non-daily returns</p>
                        </div>
                        <div className="p-3 bg-purple-100 text-purple-800 rounded-xl">
                            <Layers className="w-6 h-6" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-rose-900 uppercase tracking-wider">Stock Alerts</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-bold text-amber-700">{summary.lowStockCount} Low</span>
                                <span className="text-slate-300">|</span>
                                <span className="text-sm font-bold text-rose-700">{summary.outOfStockCount} Out</span>
                            </div>
                            <p className="text-[11px] text-rose-700 mt-1 font-medium">Require supplier refill</p>
                        </div>
                        <div className="p-3 bg-rose-100 text-rose-800 rounded-xl">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filters Bar */}
            <Card className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search bakery items or code..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                    </div>

                    {/* Supplier Filter */}
                    <div>
                        <select
                            value={selectedSupplierId}
                            onChange={(e) => setSelectedSupplierId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                        >
                            <option value="">-- All Bakery Suppliers --</option>
                            {suppliers.map((s) => (
                                <option key={s._id} value={s._id}>{s.displayName}</option>
                            ))}
                        </select>
                    </div>

                    {/* Item Type (Daily vs Shelf) */}
                    <div>
                        <select
                            value={itemType}
                            onChange={(e) => setItemType(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                        >
                            <option value="all">-- All Item Types --</option>
                            <option value="daily">🥐 Daily Fresh (Returnable)</option>
                            <option value="shelf">🍪 Multi-Day Shelf Items (Non-daily)</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                        >
                            <option value="all">-- All Stock Statuses --</option>
                            <option value="in_stock">In Stock (&gt; 5)</option>
                            <option value="low_stock">Low Stock (1 - 5)</option>
                            <option value="out_of_stock">Out of Stock (0)</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Live Stock Table */}
            <Card className="overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                        <Croissant className="w-4 h-4 text-amber-600" />
                        Live Bakery Stock Items ({filteredItems.length})
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">Real-time POS Inventory</span>
                </div>

                {isLoading ? (
                    <div className="py-20 text-center text-slate-500">Loading live bakery stock...</div>
                ) : filteredItems.length === 0 ? (
                    <div className="py-16 text-center text-slate-500">
                        <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700">No bakery items found</p>
                        <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search keywords</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="py-3 px-4">#</th>
                                    <th className="py-3 px-4">Product Name & Code</th>
                                    <th className="py-3 px-4">Bakery Supplier</th>
                                    <th className="py-3 px-3 text-center">Item Type</th>
                                    <th className="py-3 px-3 text-right">Cost Price</th>
                                    <th className="py-3 px-3 text-right">Sell Price</th>
                                    <th className="py-3 px-3 text-right">Unit Profit</th>
                                    <th className="py-3 px-4 text-right font-black text-slate-900">Current On-Hand</th>
                                    <th className="py-3 px-4 text-right">Retail Value</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-slate-800">
                                {filteredItems.map((item, idx) => (
                                    <tr key={item._id} className="hover:bg-amber-50/30 transition">
                                        <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                                        <td className="py-3 px-4">
                                            <div className="font-bold text-slate-900 text-sm">{item.productName}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {item.productCode && (
                                                    <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {item.productCode}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-slate-400">Unit: {item.unitOfMeasure}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            {item.supplier ? (
                                                <div>
                                                    <span className="font-semibold text-slate-800">{item.supplier.name}</span>
                                                    {item.supplier.code && (
                                                        <span className="block text-[10px] font-mono text-slate-400">{item.supplier.code}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            {item.isDailyReturnable ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                    🥐 Daily Fresh
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                                    🍪 Multi-Day Shelf ({item.shelfLifeDays}d)
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono text-slate-600">
                                            {fmt(item.buyPrice)}
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                                            {fmt(item.sellPrice)}
                                        </td>
                                        <td className="py-3 px-3 text-right font-mono text-emerald-700 font-bold">
                                            +{fmt(item.unitProfit)}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <span className={`inline-block font-black text-sm px-2.5 py-1 rounded-lg font-mono ${
                                                item.onHand > 5 
                                                    ? 'bg-emerald-100 text-emerald-900' 
                                                    : item.onHand > 0 
                                                        ? 'bg-amber-100 text-amber-900' 
                                                        : 'bg-rose-100 text-rose-900'
                                            }`}>
                                                {item.onHand} {item.unitOfMeasure}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-950">
                                            {fmt(item.totalRetailValue)}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <Badge variant={
                                                item.status === 'in_stock' ? 'success' :
                                                item.status === 'low_stock' ? 'warning' : 'danger'
                                            }>
                                                {item.status === 'in_stock' ? 'In Stock' :
                                                 item.status === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
