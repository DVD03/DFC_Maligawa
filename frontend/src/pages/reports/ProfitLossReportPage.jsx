import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    TrendingUp, DollarSign, Activity, Calendar, Filter,
    Layers, Printer, ArrowLeft, ArrowDownRight, ArrowUpRight,
    PieChart, BarChart3, Download, ShoppingBag, Users, CheckCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { financialReportsApi } from '../../features/reports/financialReportsApi';
import { useCategories } from '../../features/products/useProducts';
import { warehousesApi } from '../../features/warehouses/warehousesApi';

export default function ProfitLossReportPage() {
    const navigate = useNavigate();

    // Date presets
    const todayStr = new Date().toISOString().split('T')[0];
    const [periodPreset, setPeriodPreset] = useState('today');
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [selectedCategoryId, setSelectedCategoryId] = useState('all');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

    const { data: categoriesData } = useCategories();
    const { data: warehousesData } = useQuery({
        queryKey: ['warehouses'],
        queryFn: () => warehousesApi.list(),
    });

    const categories = categoriesData?.data || categoriesData || [];
    const warehouses = warehousesData?.data || [];

    // Handle Period Preset Change
    const handlePresetChange = (preset) => {
        setPeriodPreset(preset);
        const now = new Date();

        if (preset === 'today') {
            const d = now.toISOString().split('T')[0];
            setStartDate(d);
            setEndDate(d);
        } else if (preset === 'yesterday') {
            const d = new Date(now);
            d.setDate(d.getDate() - 1);
            const dStr = d.toISOString().split('T')[0];
            setStartDate(dStr);
            setEndDate(dStr);
        } else if (preset === 'this_week') {
            const first = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))); // Monday
            const last = new Date(first);
            last.setDate(last.getDate() + 6); // Sunday
            setStartDate(first.toISOString().split('T')[0]);
            setEndDate(last.toISOString().split('T')[0]);
        } else if (preset === 'last_week') {
            const first = new Date(now.setDate(now.getDate() - now.getDay() - 6));
            const last = new Date(first);
            last.setDate(last.getDate() + 6);
            setStartDate(first.toISOString().split('T')[0]);
            setEndDate(last.toISOString().split('T')[0]);
        } else if (preset === 'this_month') {
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            setStartDate(first.toISOString().split('T')[0]);
            setEndDate(last.toISOString().split('T')[0]);
        } else if (preset === 'last_month') {
            const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const last = new Date(now.getFullYear(), now.getMonth(), 0);
            setStartDate(first.toISOString().split('T')[0]);
            setEndDate(last.toISOString().split('T')[0]);
        }
    };

    // Query P&L Data
    const { data: pnlData, isLoading } = useQuery({
        queryKey: ['financial-pnl', startDate, endDate, selectedCategoryId, selectedWarehouseId],
        queryFn: () =>
            financialReportsApi.getProfitAndLoss({
                startDate,
                endDate,
                categoryId: selectedCategoryId !== 'all' ? selectedCategoryId : undefined,
                warehouseId: selectedWarehouseId || undefined,
            }),
    });

    const pnl = pnlData?.data || {};
    const summary = pnl.summary || {};
    const categoryBreakdown = pnl.categories || [];
    const expenseBreakdown = pnl.expenseBreakdown || [];
    const dailyTrend = pnl.dailyTrend || [];

    const fmt = (n) => `Rs. ${(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handlePrint = () => {
        window.print();
    };

    const selectedCategoryObj = categories.find((c) => c._id === selectedCategoryId);

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/reports')}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-lg text-emerald-600 flex-shrink-0">
                        <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-slate-800 leading-tight">Daily / Weekly Profit & Loss Statement</h1>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                            Net profit analytics across overall business and individual categories (Bakery, Short Eats, Grocery)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        Print Report
                    </button>
                </div>
            </div>

            {/* Filter & Period Bar */}
            <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200 space-y-3 sm:space-y-4">
                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase mr-1">Period Preset:</span>
                    {[
                        { id: 'today', label: 'Today' },
                        { id: 'yesterday', label: 'Yesterday' },
                        { id: 'this_week', label: 'This Week' },
                        { id: 'last_week', label: 'Last Week' },
                        { id: 'this_month', label: 'This Month' },
                        { id: 'last_month', label: 'Last Month' },
                        { id: 'custom', label: 'Custom Range' },
                    ].map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => handlePresetChange(p.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                periodPreset === p.id
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Date & Category Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                            Business Category
                        </label>
                        <select
                            value={selectedCategoryId}
                            onChange={(e) => setSelectedCategoryId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800"
                        >
                            <option value="all">🌟 Overall Business (All Categories)</option>
                            {categories.map((c) => (
                                <option key={c._id} value={c._id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                            Outlet / Warehouse
                        </label>
                        <select
                            value={selectedWarehouseId}
                            onChange={(e) => setSelectedWarehouseId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                            <option value="">All Outlets / Warehouses</option>
                            {warehouses.map((w) => (
                                <option key={w._id} value={w._id}>
                                    {w.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setPeriodPreset('custom');
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setPeriodPreset('custom');
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Main KPI Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Revenue */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase">Total Sales Revenue</span>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-blue-900 mt-2">{fmt(summary.totalRevenue)}</p>
                    <span className="text-[11px] text-slate-400">Gross: {fmt(summary.grossSales)}</span>
                </div>

                {/* 2. COGS */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase">Cost of Goods (COGS)</span>
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <ShoppingBag className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-amber-900 mt-2">{fmt(summary.cogs)}</p>
                    <span className="text-[11px] text-slate-400">Purchase / manufacturing cost</span>
                </div>

                {/* 3. Gross Profit */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-600 uppercase">Gross Profit</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {summary.grossMarginPercent}% Margin
                        </span>
                    </div>
                    <p className="text-2xl font-black text-emerald-800 mt-2">{fmt(summary.grossProfit)}</p>
                    <span className="text-[11px] text-slate-400">Revenue - Product Cost</span>
                </div>

                {/* 4. Net Profit */}
                <div
                    className={`p-5 rounded-xl border shadow-sm ${
                        summary.netProfit >= 0
                            ? 'bg-emerald-50/80 border-emerald-300'
                            : 'bg-rose-50/80 border-rose-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            🌟 Final Net Profit
                        </span>
                        <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                summary.netProfit >= 0
                                    ? 'bg-emerald-200 text-emerald-900'
                                    : 'bg-rose-200 text-rose-900'
                            }`}
                        >
                            {summary.netMarginPercent}% Net
                        </span>
                    </div>
                    <p
                        className={`text-3xl font-black mt-2 ${
                            summary.netProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'
                        }`}
                    >
                        {fmt(summary.netProfit)}
                    </p>
                    <span className="text-[11px] text-slate-600">Bottom-line profit after wages & expenses</span>
                </div>
            </div>

            {/* Operating Expenses & Labor Costs Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-purple-700">
                        <Users className="w-5 h-5" />
                        <h3 className="font-bold text-slate-800 text-sm">Labor & Employee Wages</h3>
                    </div>
                    <p className="text-xl font-bold text-purple-900">{fmt(summary.totalWages)}</p>
                    <p className="text-xs text-slate-500">Daily wages, weekly wages & regular salary payouts</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-rose-600">
                        <Activity className="w-5 h-5" />
                        <h3 className="font-bold text-slate-800 text-sm">Operational Expenses</h3>
                    </div>
                    <p className="text-xl font-bold text-rose-900">{fmt(summary.totalOperationalExpenses)}</p>
                    <p className="text-xs text-slate-500">Rent, electricity, transport, bills & general costs</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-amber-700">
                        <ArrowDownRight className="w-5 h-5" />
                        <h3 className="font-bold text-slate-800 text-sm">Customer Returns & Damages</h3>
                    </div>
                    <p className="text-xl font-bold text-amber-900">{fmt(summary.customerReturnsLoss)}</p>
                    <p className="text-xs text-slate-500">Refunds, damages & spoilage losses</p>
                </div>
            </div>

            {/* Bakery & Short Eats Daily Supply & Profit Overview */}
            {pnl.bakerySummary && pnl.bakerySummary.entriesCount > 0 && (
                <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 p-5 rounded-xl border border-amber-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🥐</span>
                            <div>
                                <h3 className="font-bold text-amber-950 text-base">Bakery & Short Eats Supply Performance</h3>
                                <p className="text-xs text-amber-800">
                                    Summary of fresh daily items received, returns deducted & projected profit margin across {pnl.bakerySummary.entriesCount} delivery entries
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                        <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-2xs">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase">Gross Supply</span>
                            <p className="text-base font-bold text-slate-800 mt-0.5">{fmt(pnl.bakerySummary.totalGrossSupply)}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-rose-200 shadow-2xs">
                            <span className="text-[11px] font-semibold text-rose-600 uppercase">Returns Deducted</span>
                            <p className="text-base font-bold text-rose-700 mt-0.5">- {fmt(pnl.bakerySummary.totalReturns)}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-indigo-200 shadow-2xs">
                            <span className="text-[11px] font-semibold text-indigo-600 uppercase">Net Supply Cost</span>
                            <p className="text-base font-bold text-indigo-900 mt-0.5">{fmt(pnl.bakerySummary.totalNetSupply)}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-emerald-200 shadow-2xs">
                            <span className="text-[11px] font-semibold text-emerald-600 uppercase">Projected Profit</span>
                            <p className="text-base font-bold text-emerald-700 mt-0.5">{fmt(pnl.bakerySummary.totalExpectedProfit)}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-2xs">
                            <span className="text-[11px] font-semibold text-blue-600 uppercase">Paid to Suppliers</span>
                            <p className="text-base font-bold text-blue-900 mt-0.5">{fmt(pnl.bakerySummary.totalPaid)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Breakdown Table */}
            {selectedCategoryId === 'all' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-emerald-600" />
                            Profit & Loss by Category (Bakery vs. Short Eats vs. Others)
                        </h3>
                    </div>

                    {categoryBreakdown.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">No category sales recorded in this period.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-4">Category Name</th>
                                        <th className="py-3 px-3 text-center">Items Sold</th>
                                        <th className="py-3 px-4 text-right">Sales Revenue</th>
                                        <th className="py-3 px-4 text-right">Product Cost (COGS)</th>
                                        <th className="py-3 px-4 text-right text-emerald-700">Gross Profit</th>
                                        <th className="py-3 px-4 text-right">Profit Margin (%)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                                    {categoryBreakdown.map((cat, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4 font-bold text-slate-800">
                                                {cat.categoryName}
                                            </td>
                                            <td className="py-3 px-3 text-center text-xs text-slate-500">
                                                {cat.itemsSold}
                                            </td>
                                            <td className="py-3 px-4 text-right font-semibold text-slate-900 text-xs">
                                                {fmt(cat.revenue)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-semibold text-amber-900 text-xs">
                                                {fmt(cat.cogs)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-emerald-700 text-sm">
                                                {fmt(cat.grossProfit)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-emerald-800 text-xs">
                                                {cat.marginPercent}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Daily Breakdown Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        Daily Loss & Profit Breakdown
                    </h3>
                </div>

                {dailyTrend.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">No transaction data for this date range.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-3 text-right">Revenue</th>
                                    <th className="py-3 px-3 text-right">COGS</th>
                                    <th className="py-3 px-3 text-right text-emerald-700">Gross Profit</th>
                                    <th className="py-3 px-3 text-right text-purple-700">Wages Paid</th>
                                    <th className="py-3 px-3 text-right text-rose-600">Expenses</th>
                                    <th className="py-3 px-4 text-right">Net Profit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                                {dailyTrend.map((day, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-4 font-bold text-xs text-slate-800">
                                            {new Date(day.date).toLocaleDateString(undefined, {
                                                weekday: 'short',
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </td>
                                        <td className="py-3 px-3 text-right text-xs text-slate-800">
                                            {fmt(day.revenue)}
                                        </td>
                                        <td className="py-3 px-3 text-right text-xs text-amber-800">
                                            {fmt(day.cogs)}
                                        </td>
                                        <td className="py-3 px-3 text-right text-xs font-bold text-emerald-700">
                                            {fmt(day.grossProfit)}
                                        </td>
                                        <td className="py-3 px-3 text-right text-xs text-purple-800">
                                            {fmt(day.wages)}
                                        </td>
                                        <td className="py-3 px-3 text-right text-xs text-rose-700">
                                            {fmt(day.expenses)}
                                        </td>
                                        <td
                                            className={`py-3 px-4 text-right font-black text-sm ${
                                                day.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                            }`}
                                        >
                                            {fmt(day.netProfit)}
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
