import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Package } from 'lucide-react';

export default function SearchableProductSelect({
    products = [],
    value = '',
    onChange,
    placeholder = 'Type to search product name or code...',
    className = '',
    disabled = false,
    autoFocus = false,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Find selected product
    const selectedProduct = useMemo(() => {
        if (!value) return null;
        return products.find((p) => p._id === value) || null;
    }, [products, value]);

    // Keep search query synced with selected product when dropdown is closed
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery(selectedProduct ? selectedProduct.name : '');
        }
    }, [selectedProduct, isOpen]);

    // Filter products
    const filteredProducts = useMemo(() => {
        const q = (searchQuery || '').trim().toLowerCase();
        if (!q) return products.slice(0, 30); // show top 30 initially

        return products.filter((p) => {
            const nameMatch = (p.name || '').toLowerCase().includes(q);
            const codeMatch = (p.productCode || '').toLowerCase().includes(q);
            const barcodeMatch = (p.barcode || '').toLowerCase().includes(q);
            return nameMatch || codeMatch || barcodeMatch;
        }).slice(0, 50);
    }, [products, searchQuery]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearchQuery(selectedProduct ? selectedProduct.name : '');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedProduct]);

    const handleSelect = (product) => {
        if (onChange) {
            onChange(product._id, product);
        }
        setSearchQuery(product.name);
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        if (onChange) {
            onChange('', null);
        }
        setSearchQuery('');
        setIsOpen(true);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (disabled) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
            } else {
                setHighlightedIndex((prev) =>
                    prev < filteredProducts.length - 1 ? prev + 1 : prev
                );
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (isOpen) {
                setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen && filteredProducts[highlightedIndex]) {
                handleSelect(filteredProducts[highlightedIndex]);
            } else if (!isOpen) {
                setIsOpen(true);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setSearchQuery(selectedProduct ? selectedProduct.name : '');
        }
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                    ref={inputRef}
                    type="text"
                    disabled={disabled}
                    autoFocus={autoFocus}
                    value={searchQuery}
                    placeholder={placeholder}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsOpen(true);
                        setHighlightedIndex(0);
                    }}
                    onFocus={() => {
                        setIsOpen(true);
                        setHighlightedIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    className={`w-full pl-9 pr-14 py-2 border rounded-lg text-sm bg-white font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition shadow-2xs ${
                        disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'hover:border-gray-400'
                    } ${isOpen ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-300'}`}
                />

                <div className="absolute right-2 flex items-center gap-1">
                    {selectedProduct && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                            title="Clear selection"
                        >
                            <X size={13} />
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                            setIsOpen(!isOpen);
                            inputRef.current?.focus();
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Suggestions Dropdown */}
            {isOpen && !disabled && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-gray-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    {filteredProducts.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-500">
                            No products match <span className="font-semibold text-gray-700">"{searchQuery}"</span>
                        </div>
                    ) : (
                        filteredProducts.map((p, index) => {
                            const isSelected = selectedProduct?._id === p._id;
                            const isHighlighted = highlightedIndex === index;

                            const cost = p.purchasePrice != null ? p.purchasePrice : p.basePrice || 0;
                            const sell = p.basePrice || 0;

                            return (
                                <button
                                    key={p._id}
                                    type="button"
                                    onClick={() => handleSelect(p)}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 text-sm transition-colors ${
                                        isHighlighted ? 'bg-primary-50 text-primary-950' : isSelected ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${isSelected ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            <Package size={14} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 truncate text-xs sm:text-sm">
                                                {p.name}
                                            </p>
                                            <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                                {p.productCode && (
                                                    <span className="font-mono bg-gray-100 px-1.5 py-0.2 rounded text-gray-700 font-bold text-[10px]">
                                                        {p.productCode}
                                                    </span>
                                                )}
                                                {p.barcode && <span>BC: {p.barcode}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                                        <div>
                                            <p className="text-xs font-bold text-gray-900">
                                                Rs. {Number(cost).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                            </p>
                                            <span className="text-[10px] text-gray-400">
                                                Sell: Rs. {Number(sell).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        {isSelected && <Check size={14} className="text-primary-600 ml-1" />}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
