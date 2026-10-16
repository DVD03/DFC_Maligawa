import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { ShoppingBag, Sparkles, X, Plus, Check } from 'lucide-react';
import { useCreateProduct, useCategories } from './useProducts';

export default function QuickCustomItemModal({
    isOpen,
    onClose,
    onItemAdded,
    initialName = '',
}) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [qty, setQty] = useState('1');
    const [categoryId, setCategoryId] = useState('');
    const [saveToCatalog, setSaveToCatalog] = useState(true);
    const [trackStock, setTrackStock] = useState(false); // default to false so it's always sellable

    const nameInputRef = useRef(null);
    const createMutation = useCreateProduct();
    const { data: categoriesData } = useCategories({ isActive: 'true' });
    const categories = categoriesData?.data || [];

    useEffect(() => {
        if (isOpen) {
            setName(initialName || '');
            setPrice('');
            setQty('1');
            setSaveToCatalog(true);
            setTrackStock(false);
            if (categories.length > 0) {
                // Find a bakery/food category or default to first
                const bakeryCat = categories.find((c) => /bakery|food|short|snack/i.test(c.name));
                setCategoryId(bakeryCat ? bakeryCat._id : categories[0]._id);
            }
            setTimeout(() => {
                nameInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen, initialName, categories]);

    if (!isOpen) return null;

    const quickPresets = [
        { label: '🥐 Short Eat', prefix: 'Short Eat' },
        { label: '🥟 Roti / Snack', prefix: 'Roti' },
        { label: '🍞 Bun / Loaf', prefix: 'Bun' },
        { label: '☕ Drink', prefix: 'Drink' },
        { label: '🍰 Pastry / Sweet', prefix: 'Sweet' },
    ];

    const handleSubmit = async (e) => {
        e?.preventDefault();
        const trimmedName = name.trim();
        const numericPrice = parseFloat(price);
        const numericQty = parseFloat(qty) || 1;

        if (!trimmedName) {
            toast.error('Please enter an item name');
            return;
        }

        if (isNaN(numericPrice) || numericPrice < 0) {
            toast.error('Please enter a valid price');
            return;
        }

        try {
            const productPayload = {
                name: trimmedName,
                productType: 'finished_good',
                categoryId: categoryId || (categories[0]?._id || undefined),
                unitOfMeasure: 'pcs',
                basePrice: numericPrice,
                purchasePrice: +(numericPrice * 0.7).toFixed(2), // estimated purchase price
                trackStock: trackStock, // false means can be sold anytime
                canBeSold: true,
                canBePurchased: true,
                status: 'active',
            };

            const result = await createMutation.mutateAsync(productPayload);
            const createdProd = result?.data;

            if (createdProd) {
                toast.success(`"${trimmedName}" added to bill!`);
                onItemAdded?.(createdProd, numericQty, numericPrice);
                onClose();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add custom item');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-amber-50/60">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                            <Sparkles className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-base leading-tight">
                                Quick Open / Custom Item
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                Sell unlisted or new items directly at POS in seconds
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Quick Presets */}
                    <div>
                        <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Quick Category Presets
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {quickPresets.map((p, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        if (!name) setName(p.prefix + ' ');
                                        else setName((prev) => `${prev} (${p.prefix})`);
                                    }}
                                    className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 rounded-lg transition"
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Item Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Item Name / Description <span className="text-rose-500">*</span>
                        </label>
                        <input
                            ref={nameInputRef}
                            type="text"
                            required
                            placeholder="e.g. Cheese Roti / Special Pastry / Cold Soda"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                        />
                    </div>

                    {/* Price and Qty */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Selling Price (Rs.) <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.5"
                                placeholder="e.g. 150"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-right"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Quantity
                            </label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={qty}
                                onChange={(e) => setQty(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none bg-white text-center"
                            />
                        </div>
                    </div>

                    {/* Category Selection */}
                    {categories.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Category
                            </label>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-white"
                            >
                                {categories.map((c) => (
                                    <option key={c._id} value={c._id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Options checkboxes */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                            <input
                                type="checkbox"
                                checked={saveToCatalog}
                                onChange={(e) => setSaveToCatalog(e.target.checked)}
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                            />
                            <span>Keep in Product Catalog for future sales</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer font-medium text-amber-800">
                            <input
                                type="checkbox"
                                checked={!trackStock}
                                onChange={(e) => setTrackStock(!e.target.checked)}
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                            />
                            <span>Always sellable at POS (Bypass zero-stock check)</span>
                        </label>
                    </div>

                    {/* Submit Button */}
                    <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || !name.trim() || !price}
                            className="flex-1 sm:flex-none px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition"
                        >
                            <Plus className="w-4 h-4" />
                            {createMutation.isPending ? 'Adding to Bill...' : 'Add to Bill (Enter)'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
