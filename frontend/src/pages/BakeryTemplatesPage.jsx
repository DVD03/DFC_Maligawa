import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ShoppingBag, Plus, Trash2, Save, ArrowLeft,
    CheckCircle, AlertCircle, RefreshCw, Layers, Edit3,
    Search, X, DollarSign, PackagePlus, Eye, Users, Coffee,
    Calculator, TrendingUp, Sparkles, HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { suppliersApi } from '../features/suppliers/suppliersApi';
import { productsApi } from '../features/products/productsApi';
import BakerySupplierModal from '../features/bakery/BakerySupplierModal';
import { bakeryApi } from '../api/bakeryApi';

export default function BakeryTemplatesPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Supplier creation modal
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

    // Editor Modal state
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [items, setItems] = useState([]);
    const [notes, setNotes] = useState('');

    // Search filter for template list
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch bakery suppliers, products, and saved templates
    const { data: suppliersData, isLoading: loadingSuppliers } = useQuery({
        queryKey: ['suppliers', 'active', 'bakery_short_eats'],
        queryFn: () => suppliersApi.list({ category: 'bakery_short_eats', status: 'active', limit: 100 }),
    });

    const { data: productsData } = useQuery({
        queryKey: ['products', 'all'],
        queryFn: () => productsApi.list({ limit: 500 }),
    });

    const { data: templatesListData, isLoading: loadingTemplates } = useQuery({
        queryKey: ['bakery-templates-list'],
        queryFn: () => bakeryApi.listTemplates(),
    });

    const suppliers = suppliersData?.data || [];
    const products = productsData?.data || [];
    const savedTemplates = templatesListData?.data || [];

    // Fetch single template when selectedSupplierId changes
    const { data: templateData, isLoading: loadingTemplate } = useQuery({
        queryKey: ['bakery-template', selectedSupplierId],
        queryFn: () => bakeryApi.getTemplate(selectedSupplierId),
        enabled: !!selectedSupplierId && isEditorOpen,
    });

    // Populate editor when templateData loads
    useEffect(() => {
        if (templateData?.data) {
            const t = templateData.data;
            setTemplateName(t.templateName || '');
            setNotes(t.notes || '');

            if (t.items && t.items.length > 0) {
                setItems(
                    t.items.map((i) => ({
                        productId: i.productId?._id || i.productId || '',
                        productName: i.productName || i.productId?.name || '',
                        productCode: i.productCode || i.productId?.productCode || '',
                        defaultBuyPrice: i.defaultBuyPrice ?? (i.productId?.purchasePrice || ''),
                        defaultSellPrice: i.defaultSellPrice ?? (i.productId?.basePrice || ''),
                        unitOfMeasure: i.unitOfMeasure || i.productId?.unitOfMeasure || 'pcs',
                    }))
                );
            } else {
                // If brand new template, start with 3 empty rows ready for quick typing
                setItems([
                    { productId: '', productName: '', productCode: '', defaultBuyPrice: '', defaultSellPrice: '', unitOfMeasure: 'pcs' },
                    { productId: '', productName: '', productCode: '', defaultBuyPrice: '', defaultSellPrice: '', unitOfMeasure: 'pcs' },
                    { productId: '', productName: '', productCode: '', defaultBuyPrice: '', defaultSellPrice: '', unitOfMeasure: 'pcs' },
                ]);
            }
        }
    }, [templateData]);

    // Save Template Mutation
    const saveMutation = useMutation({
        mutationFn: (payload) => bakeryApi.saveTemplate(selectedSupplierId, payload),
        onSuccess: () => {
            toast.success('Supplier template saved successfully!');
            queryClient.invalidateQueries({ queryKey: ['bakery-templates-list'] });
            queryClient.invalidateQueries({ queryKey: ['bakery-template', selectedSupplierId] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setIsEditorOpen(false);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to save template');
        },
    });

    // Add empty row
    const handleAddEmptyRow = () => {
        setItems((prev) => [
            ...prev,
            {
                productId: '',
                productName: '',
                productCode: '',
                defaultBuyPrice: '',
                defaultSellPrice: '',
                unitOfMeasure: 'pcs',
            },
        ]);
    };

    // Add 5 empty rows
    const handleAdd5Rows = () => {
        setItems((prev) => [
            ...prev,
            { productId: '', productName: '', productCode: '', defaultBuyPrice: '', defaultSellPrice: '', unitOfMeasure: 'pcs' },
            { productId: '', productName: '', productCode: '', defaultBuyPrice: '', defaultSellPrice: '', unitOfMeasure: 'pcs' },
            { productId: '', productName: '', productCode: '', defaultBuyPrice: '', defaultSellPrice: '', unitOfMeasure: 'pcs' },
            { productId: '', productName: '', productCode: '', defaultBuyPrice: '', defaultSellPrice: '', unitOfMeasure: 'pcs' },
            { productId: '', productName: '', productCode: '', defaultBuyPrice: '', defaultSellPrice: '', unitOfMeasure: 'pcs' },
        ]);
    };

    // Quick add existing product from dropdown
    const handleAddExistingProduct = (prodId) => {
        if (!prodId) return;
        const prod = products.find((p) => p._id === prodId);
        if (!prod) return;

        // Check if already in list
        const exists = items.some((i) => (i.productId === prod._id) || (i.productName?.toLowerCase() === prod.name.toLowerCase()));
        if (exists) {
            toast.error(`${prod.name} is already in the template`);
            return;
        }

        setItems((prev) => [
            ...prev,
            {
                productId: prod._id,
                productName: prod.name,
                productCode: prod.productCode || '',
                defaultBuyPrice: prod.purchasePrice || '',
                defaultSellPrice: prod.basePrice || '',
                unitOfMeasure: prod.unitOfMeasure || 'pcs',
            },
        ]);
    };

    // Row change handler
    const handleItemChange = (index, field, value) => {
        setItems((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    // Remove row
    const handleRemoveItem = (index) => {
        setItems((prev) => prev.filter((_, idx) => idx !== index));
    };

    // Save Template Submission
    const handleSaveTemplate = (e) => {
        e.preventDefault();
        if (!selectedSupplierId) {
            toast.error('Please select a supplier');
            return;
        }

        // Filter out completely blank rows
        const validItems = items.filter((i) => (i.productName && i.productName.trim()) || i.productId);

        if (validItems.length === 0) {
            toast.error('Please add at least 1 item with a name, buying price, and selling price');
            return;
        }

        saveMutation.mutate({
            templateName: templateName || 'Daily Bakery & Short Eats Structure',
            items: validItems,
            notes,
        });
    };

    // Open Editor for a specific supplier
    const handleOpenEditorForSupplier = (sId) => {
        setSelectedSupplierId(sId);
        const sup = suppliers.find((s) => s._id === sId);
        setTemplateName(sup ? `${sup.displayName} Item Structure` : '');
        setItems([
            { productId: '', productName: '', productCode: '', defaultBuyPrice: '', defaultSellPrice: '', unitOfMeasure: 'pcs' },
            { productId: '', productName: '', productCode: '', defaultBuyPrice: '', defaultSellPrice: '', unitOfMeasure: 'pcs' },
            { productId: '', productName: '', productCode: '', defaultBuyPrice: '', defaultSellPrice: '', unitOfMeasure: 'pcs' },
        ]);
        setIsEditorOpen(true);
    };

    // Filter templates for search
    const filteredTemplates = savedTemplates.filter((t) => {
        const sName = t.supplierId?.displayName || '';
        const sCode = t.supplierId?.supplierCode || '';
        const tName = t.templateName || '';
        const q = searchTerm.toLowerCase();
        return sName.toLowerCase().includes(q) || sCode.toLowerCase().includes(q) || tName.toLowerCase().includes(q);
    });

    // Calculate Summary Stats for open editor
    const validItemsForStats = items.filter((i) => (i.productName && i.productName.trim()) || i.productId);
    const totalUnitProfit = validItemsForStats.reduce((sum, i) => {
        const buy = Number(i.defaultBuyPrice) || 0;
        const sell = Number(i.defaultSellPrice) || 0;
        return sum + Math.max(0, sell - buy);
    }, 0);

    const avgMargin =
        validItemsForStats.length > 0
            ? (
                  validItemsForStats.reduce((sum, i) => {
                      const buy = Number(i.defaultBuyPrice) || 0;
                      const sell = Number(i.defaultSellPrice) || 0;
                      return sum + (sell > 0 ? ((sell - buy) / sell) * 100 : 0);
                  }, 0) / validItemsForStats.length
              ).toFixed(1)
            : '0.0';

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
            {/* Datalist for fast item name autocomplete */}
            <datalist id="bakery-product-suggestions">
                {products.map((p) => (
                    <option key={p._id} value={p.name} />
                ))}
            </datalist>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 sm:p-3 bg-amber-50 rounded-xl text-amber-700 border border-amber-200 flex-shrink-0">
                        <Coffee className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Supplier Bakery Templates</h1>
                        <p className="text-xs sm:text-sm text-slate-500">
                            Configure standard daily items, buy prices, selling prices & profit margins per supplier
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/bakery/daily-receiving')}
                        className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition text-center"
                    >
                        Go to Daily Receiving
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedSupplierId(suppliers[0]?._id || '');
                            setIsEditorOpen(true);
                        }}
                        className="px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm flex items-center justify-center gap-2 transition"
                    >
                        <Plus className="w-4 h-4" />
                        + Setup Supplier Template
                    </button>
                </div>
            </div>

            {/* Quick Supplier Picker Bar */}
            <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        Select Supplier to Configure or Edit Structure
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <select
                            value={selectedSupplierId}
                            onChange={(e) => {
                                setSelectedSupplierId(e.target.value);
                                if (e.target.value) {
                                    handleOpenEditorForSupplier(e.target.value);
                                }
                            }}
                            className="w-full sm:flex-1 sm:max-w-md px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-800 bg-white"
                        >
                            <option value="">-- Choose a Bakery Supplier --</option>
                            {suppliers.map((s) => (
                                <option key={s._id} value={s._id}>
                                    {s.displayName} {s.supplierCode ? `(${s.supplierCode})` : ''}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => setIsSupplierModalOpen(true)}
                            className="text-xs font-bold text-amber-600 hover:text-amber-700 underline text-left sm:text-center"
                        >
                            + Add New Supplier
                        </button>
                    </div>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search saved templates..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm bg-white"
                    />
                </div>
            </div>

            {/* Templates List Grid */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-600" />
                        Configured Supplier Templates ({filteredTemplates.length})
                    </h2>
                </div>

                {loadingTemplates ? (
                    <div className="bg-white p-12 rounded-xl text-center text-slate-400 border border-slate-200">
                        Loading saved templates...
                    </div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="bg-white p-12 rounded-xl text-center space-y-3 border border-slate-200">
                        <Coffee className="w-12 h-12 mx-auto text-amber-300 stroke-[1.5]" />
                        <h3 className="font-bold text-slate-700 text-base">No Bakery Templates Saved Yet</h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                            Setup standard item pricing structures for your suppliers so morning deliveries automatically populate with buy and sell prices.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedSupplierId(suppliers[0]?._id || '');
                                setIsEditorOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-sm transition mt-2 shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            + Setup First Supplier Template
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredTemplates.map((template) => {
                            const supplier = template.supplierId;
                            const itemCount = template.items?.length || 0;

                            const totalProfitPotential = template.items?.reduce((sum, item) => {
                                const buy = Number(item.defaultBuyPrice) || 0;
                                const sell = Number(item.defaultSellPrice) || 0;
                                return sum + Math.max(0, sell - buy);
                            }, 0) || 0;

                            return (
                                <div
                                    key={template._id}
                                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className="font-bold text-slate-900 text-base">
                                                    {supplier?.displayName || 'Unknown Supplier'}
                                                </h3>
                                                {supplier?.supplierCode && (
                                                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                        {supplier.supplierCode}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold whitespace-nowrap">
                                                {itemCount} Items
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-600 line-clamp-1 font-medium">
                                            {template.templateName || 'Daily Bakery & Short Eats Structure'}
                                        </p>

                                        {/* Preview of first 3 items */}
                                        <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 border border-slate-100 text-xs">
                                            <div className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider mb-1">
                                                Agreed Price Preview:
                                            </div>
                                            {template.items?.slice(0, 3).map((item, idx) => {
                                                const profit = (Number(item.defaultSellPrice) || 0) - (Number(item.defaultBuyPrice) || 0);
                                                return (
                                                    <div key={idx} className="flex items-center justify-between text-slate-700">
                                                        <span className="truncate max-w-[140px] font-medium">{item.productName}</span>
                                                        <span className="font-mono text-[11px]">
                                                            Buy: Rs.{item.defaultBuyPrice} | Sell: Rs.{item.defaultSellPrice}
                                                            <span className="text-emerald-700 font-bold ml-1.5">
                                                                (+Rs.{profit})
                                                            </span>
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            {itemCount > 3 && (
                                                <div className="text-[11px] text-slate-400 italic text-center pt-1">
                                                    + {itemCount - 3} more items configured
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <div className="text-xs">
                                            <span className="text-slate-400 block text-[10px]">POTENTIAL PROFIT</span>
                                            <span className="font-bold text-emerald-700 text-sm">
                                                Rs. {totalProfitPotential.toFixed(2)}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditorForSupplier(supplier?._id)}
                                            className="px-3.5 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1.5 transition"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                            Edit Structure
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Template Editor Full Modal with Direct Inline Table */}
            {isEditorOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4">
                    <div className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full p-3.5 sm:p-6 shadow-2xl space-y-3 sm:space-y-4 max-h-[96vh] sm:max-h-[92vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b pb-2.5 sm:pb-3 flex-shrink-0">
                            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                                <div className="p-2 sm:p-2.5 bg-amber-50 rounded-lg sm:rounded-xl text-amber-700 border border-amber-200 flex-shrink-0">
                                    <Coffee className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-800 text-base sm:text-lg truncate">
                                        {selectedSupplierId ? 'Configure Supplier Pricing Template' : 'Setup Supplier Template'}
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-none">
                                        Add items directly in the table below. Enter buy & sell prices to calculate profit in real time.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsEditorOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 -mr-1 rounded-lg flex-shrink-0 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTemplate} className="space-y-3 sm:space-y-4 flex-1 overflow-hidden flex flex-col text-sm">
                            {/* Supplier & Template Name Bar */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200 flex-shrink-0">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                            Bakery Supplier <span className="text-rose-500">*</span>
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
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-800 bg-white"
                                        required
                                    >
                                        <option value="">-- Select Supplier --</option>
                                        {suppliers.map((s) => (
                                            <option key={s._id} value={s._id}>
                                                {s.displayName} {s.supplierCode ? `(${s.supplierCode})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Template Name
                                    </label>
                                    <input
                                        type="text"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        placeholder="e.g. Daily Short Eats & Buns Structure"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm bg-white"
                                    />
                                </div>
                            </div>

                            {/* Table Header Controls */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                        Standard Items & Price Agreements ({validItemsForStats.length})
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Quick Existing Product Selector */}
                                    <select
                                        onChange={(e) => {
                                            handleAddExistingProduct(e.target.value);
                                            e.target.value = '';
                                        }}
                                        defaultValue=""
                                        className="flex-1 sm:flex-none px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-700 bg-white min-w-[140px]"
                                    >
                                        <option value="" disabled>+ Pick Existing Product...</option>
                                        {products.map((p) => (
                                            <option key={p._id} value={p._id}>
                                                {p.name} ({p.productCode || 'No Code'})
                                            </option>
                                        ))}
                                    </select>

                                    <button
                                        type="button"
                                        onClick={handleAdd5Rows}
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                                    >
                                        + 5 Rows
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleAddEmptyRow}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        + Add Item Row
                                    </button>
                                </div>
                            </div>

                            {/* Mobile Card View (shown on screens < md) */}
                            <div className="md:hidden flex-1 overflow-y-auto space-y-3 pr-0.5 border border-slate-200 rounded-xl p-2.5 bg-slate-50/50">
                                {items.length === 0 ? (
                                    <div className="text-center py-6 text-slate-400 text-xs">
                                        No items added yet. Click "+ Add Item Row" to start.
                                    </div>
                                ) : (
                                    items.map((item, idx) => {
                                        const buy = Number(item.defaultBuyPrice) || 0;
                                        const sell = Number(item.defaultSellPrice) || 0;
                                        const profit = sell > 0 ? +(sell - buy).toFixed(2) : 0;
                                        const margin = sell > 0 ? +((profit / sell) * 100).toFixed(1) : 0;

                                        return (
                                            <div key={idx} className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs space-y-2.5">
                                                {/* Header inside Card: Row Number, Return Type, Delete */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-mono font-bold flex items-center justify-center border border-slate-200">
                                                            {idx + 1}
                                                        </span>
                                                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Item #{idx + 1}</span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        <select
                                                            value={item.isDailyReturnable !== false ? 'daily' : 'shelf'}
                                                            onChange={(e) => handleItemChange(idx, 'isDailyReturnable', e.target.value === 'daily')}
                                                            className={`px-2 py-1 text-[11px] font-bold rounded-lg border focus:ring-2 focus:ring-amber-500 outline-none ${
                                                                item.isDailyReturnable !== false 
                                                                    ? 'bg-amber-50 border-amber-300 text-amber-900' 
                                                                    : 'bg-purple-50 border-purple-300 text-purple-900'
                                                            }`}
                                                        >
                                                            <option value="daily">🥐 Daily Return</option>
                                                            <option value="shelf">🍪 Multi-Day Shelf</option>
                                                        </select>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(idx)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                                            title="Delete Row"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Short Eat Name Input */}
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                        Short Eat / Item Name <span className="text-rose-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        list="bakery-product-suggestions"
                                                        placeholder="e.g. Fish Bun / Chicken Roll / Egg Roti"
                                                        value={item.productName}
                                                        onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                                                        className="w-full px-3 py-1.5 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white placeholder:font-normal"
                                                    />
                                                </div>

                                                {/* Buy & Sell Price Inputs */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                            Buy Price (Rs.) <span className="text-rose-500">*</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.5"
                                                            placeholder="e.g. 70"
                                                            value={item.defaultBuyPrice}
                                                            onChange={(e) => handleItemChange(idx, 'defaultBuyPrice', e.target.value)}
                                                            className="w-full px-2.5 py-1.5 text-right text-xs font-mono font-bold text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                            Sell Price (Rs.) <span className="text-rose-500">*</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.5"
                                                            placeholder="e.g. 100"
                                                            value={item.defaultSellPrice}
                                                            onChange={(e) => handleItemChange(idx, 'defaultSellPrice', e.target.value)}
                                                            className="w-full px-2.5 py-1.5 text-right text-xs font-mono font-bold text-emerald-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Calculated Profit & Margin bar */}
                                                <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 text-[11px]">
                                                    <span className="text-slate-500 font-medium">Profit & Margin:</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className={`font-bold font-mono px-1.5 py-0.5 rounded ${
                                                                profit > 0
                                                                    ? 'text-emerald-700 bg-emerald-50'
                                                                    : profit < 0
                                                                    ? 'text-rose-700 bg-rose-50'
                                                                    : 'text-slate-400'
                                                            }`}
                                                        >
                                                            Rs. {profit.toFixed(2)}
                                                        </span>
                                                        <span
                                                            className={`font-bold font-mono px-1.5 py-0.5 rounded ${
                                                                margin >= 25
                                                                    ? 'text-emerald-700 bg-emerald-100'
                                                                    : margin > 0
                                                                    ? 'text-amber-800 bg-amber-100'
                                                                    : 'text-slate-400'
                                                            }`}
                                                        >
                                                            {margin}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Desktop / Tablet Table View (shown on md+ screens) */}
                            <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl flex-1 overflow-y-auto min-h-[160px]">
                                <table className="w-full text-left text-sm min-w-[680px]">
                                    <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] font-bold tracking-wider sticky top-0 border-b border-slate-200 z-10">
                                        <tr>
                                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                                            <th className="py-2.5 px-3 min-w-[200px]">
                                                Short Eat / Item Name <span className="text-rose-500">*</span>
                                            </th>
                                            <th className="py-2.5 px-2 text-center w-36">
                                                Return / Shelf Type
                                            </th>
                                            <th className="py-2.5 px-3 text-right w-28">
                                                Buy Price (Rs.) <span className="text-rose-500">*</span>
                                            </th>
                                            <th className="py-2.5 px-3 text-right w-28">
                                                Sell Price (Rs.) <span className="text-rose-500">*</span>
                                            </th>
                                            <th className="py-2.5 px-3 text-right w-24">Profit</th>
                                            <th className="py-2.5 px-3 text-right w-20">Margin</th>
                                            <th className="py-2.5 px-3 text-center w-10">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 font-medium text-slate-700 bg-white">
                                        {items.map((item, idx) => {
                                            const buy = Number(item.defaultBuyPrice) || 0;
                                            const sell = Number(item.defaultSellPrice) || 0;
                                            const profit = sell > 0 ? +(sell - buy).toFixed(2) : 0;
                                            const margin = sell > 0 ? +((profit / sell) * 100).toFixed(1) : 0;

                                            return (
                                                <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                                                    <td className="py-2 px-3 text-xs text-slate-400 text-center font-mono">
                                                        {idx + 1}
                                                    </td>

                                                    <td className="py-2 px-3">
                                                        <input
                                                            type="text"
                                                            list="bakery-product-suggestions"
                                                            placeholder="e.g. Fish Bun / Chicken Roll / Egg Roti"
                                                            value={item.productName}
                                                            onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                                                            className="w-full px-3 py-1.5 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                                                        />
                                                    </td>

                                                    <td className="py-2 px-2 text-center">
                                                        <select
                                                            value={item.isDailyReturnable !== false ? 'daily' : 'shelf'}
                                                            onChange={(e) => handleItemChange(idx, 'isDailyReturnable', e.target.value === 'daily')}
                                                            className={`w-full px-2 py-1 text-[11px] font-bold rounded-lg border focus:ring-2 focus:ring-amber-500 outline-none ${
                                                                item.isDailyReturnable !== false 
                                                                    ? 'bg-amber-50 border-amber-300 text-amber-900' 
                                                                    : 'bg-purple-50 border-purple-300 text-purple-900'
                                                            }`}
                                                        >
                                                            <option value="daily">🥐 Daily Return</option>
                                                            <option value="shelf">🍪 Multi-Day Shelf</option>
                                                        </select>
                                                    </td>

                                                    <td className="py-2 px-3 text-right">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.5"
                                                            placeholder="e.g. 70"
                                                            value={item.defaultBuyPrice}
                                                            onChange={(e) => handleItemChange(idx, 'defaultBuyPrice', e.target.value)}
                                                            className="w-full px-2.5 py-1.5 text-right text-xs font-mono font-bold text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                                                        />
                                                    </td>

                                                    <td className="py-2 px-3 text-right">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.5"
                                                            placeholder="e.g. 100"
                                                            value={item.defaultSellPrice}
                                                            onChange={(e) => handleItemChange(idx, 'defaultSellPrice', e.target.value)}
                                                            className="w-full px-2.5 py-1.5 text-right text-xs font-mono font-bold text-emerald-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                                                        />
                                                    </td>

                                                    <td className="py-2 px-3 text-right">
                                                        <span
                                                            className={`inline-block font-bold text-xs font-mono px-1.5 py-0.5 rounded ${
                                                                profit > 0
                                                                    ? 'text-emerald-700 bg-emerald-50'
                                                                    : profit < 0
                                                                    ? 'text-rose-700 bg-rose-50'
                                                                    : 'text-slate-400'
                                                            }`}
                                                        >
                                                            Rs. {profit.toFixed(2)}
                                                        </span>
                                                    </td>

                                                    <td className="py-2 px-3 text-right">
                                                        <span
                                                            className={`inline-block font-bold text-xs font-mono px-1.5 py-0.5 rounded ${
                                                                margin >= 25
                                                                    ? 'text-emerald-700 bg-emerald-100'
                                                                    : margin > 0
                                                                    ? 'text-amber-800 bg-amber-100'
                                                                    : 'text-slate-400'
                                                            }`}
                                                        >
                                                            {margin}%
                                                        </span>
                                                    </td>

                                                    <td className="py-2 px-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(idx)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                                            title="Delete Row"
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

                            {/* Live Profit Summary Ribbon */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-amber-50/70 p-2.5 sm:p-3 rounded-xl border border-amber-200 text-xs flex-shrink-0">
                                <div>
                                    <span className="text-slate-500 block text-[10px] sm:text-xs leading-tight">Total Items</span>
                                    <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                        {validItemsForStats.length} items
                                    </span>
                                </div>
                                <div className="text-center">
                                    <span className="text-slate-500 block text-[10px] sm:text-xs leading-tight">Profit Potential</span>
                                    <span className="font-bold text-emerald-700 text-xs sm:text-sm">
                                        Rs. {totalUnitProfit.toFixed(2)}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-500 block text-[10px] sm:text-xs leading-tight">Avg Margin</span>
                                    <span className="font-bold text-amber-800 text-xs sm:text-sm">
                                        {avgMargin}%
                                    </span>
                                </div>
                            </div>

                            <div className="flex-shrink-0">
                                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                    Notes & Return Agreement Terms
                                </label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="e.g. Daily morning returns accepted for unsold items and deducted from bill"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm bg-white"
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={handleAddEmptyRow}
                                    className="order-2 sm:order-1 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition"
                                >
                                    <Plus className="w-4 h-4" />
                                    + Add Another Row
                                </button>

                                <div className="order-1 sm:order-2 flex items-center gap-2 sm:gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditorOpen(false)}
                                        className="flex-1 sm:flex-none px-3.5 sm:px-4 py-2 text-xs sm:text-sm text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 sm:border-transparent text-center transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saveMutation.isPending || validItemsForStats.length === 0}
                                        className="flex-[2] sm:flex-none px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center justify-center gap-1.5 sm:gap-2 transition"
                                    >
                                        {saveMutation.isPending ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        <span>Save Supplier Template</span>
                                    </button>
                                </div>
                            </div>
                        </form>
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
