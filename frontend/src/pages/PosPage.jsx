import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Search, Plus, Minus, Trash2, ShoppingCart, Save, X,
    Package, AlertCircle, UserPlus, PackagePlus, CreditCard,
    CheckCircle, ArrowLeft, LayoutGrid, List,
    Banknote, QrCode, Split, Zap, DollarSign, Wallet, FileText, ArrowRight,
    Wifi, WifiOff, RefreshCw, Scale, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { customersApi } from '../features/customers/customersApi';
import { productsApi } from '../features/products/productsApi';
import { stockApi } from '../features/stock/stockApi';
import { useWarehouses } from '../features/warehouses/useWarehouses';
import { useCategories } from '../features/products/useProducts';
import { useCreateSalesOrder } from '../features/salesOrders/useSalesOrders';
import { useCreateCustomer } from '../features/customers/useCustomers';
import QuickCreateCustomerModal from '../features/customers/QuickCreateCustomerModal';
import QuickCustomItemModal from '../features/products/QuickCustomItemModal';
import { posSessionsApi } from '../features/posSessions/posSessionsApi';
import PosSessionModal from '../features/posSessions/PosSessionModal';
import CloseRegisterModal from '../features/posSessions/CloseRegisterModal';
import ThermalReceipt from '../components/print/ThermalReceipt';
import api from '../api/axios';
import { useCompanySettings } from '../features/settings/useSettings';
import { settingsApi } from '../features/settings/settingsApi';

import { useAuthStore } from '../store/authStore';
import { useMobile } from '../hooks/useMobile';

export default function PosPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const createOrder = useCreateSalesOrder();
    const isMobile = useMobile();
    const [showCartOnMobile, setShowCartOnMobile] = useState(false);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('posViewMode') || 'grid');

    const toggleViewMode = (mode) => {
        setViewMode(mode);
        localStorage.setItem('posViewMode', mode);
    };

    // Pre-fetch settings for receipt
    useCompanySettings();

    // Cart state
    const [customerId, setCustomerId] = useState('');
    const [sourceWarehouseId, setSourceWarehouseId] = useState('');
    const [cart, setCart] = useState([]); // [{ productId, name, code, price, qty, available, taxRate, taxable }]
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [phoneSearch, setPhoneSearch] = useState('');
    const [orderDiscountPercent, setOrderDiscountPercent] = useState(0);
    const [orderDiscountAmount, setOrderDiscountAmount] = useState(0);
    const createCustomer = useCreateCustomer();

    // Custom Open Item Modal
    const [isCustomItemOpen, setIsCustomItemOpen] = useState(false);
    const [customItemInitialName, setCustomItemInitialName] = useState('');

    // Payment Modals & Options
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
    const [isCloseRegisterModalOpen, setIsCloseRegisterModalOpen] = useState(false);
    const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash'); // 'cash' | 'card' | 'qr' | 'credit' | 'split'
    const [calculatorCashReceived, setCalculatorCashReceived] = useState('');
    const [calculatorChangeReturned, setCalculatorChangeReturned] = useState(0);
    const [cardRefNumber, setCardRefNumber] = useState('');
    const [splitCashAmount, setSplitCashAmount] = useState('');
    const [splitCardAmount, setSplitCardAmount] = useState('');

    // Weight Selection Modal (for Bites & Per-KG items)
    const [weightModalProduct, setWeightModalProduct] = useState(null);
    const [selectedWeightGrams, setSelectedWeightGrams] = useState(100);
    const [customWeightInput, setCustomWeightInput] = useState('100');

    // Direct Printing
    const [recentInvoice, setRecentInvoice] = useState(null);
    const [paymentForPrint, setPaymentForPrint] = useState([]);

    // Offline storage & sync state
    const [offlineQueue, setOfflineQueue] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('pos_offline_orders') || '[]');
        } catch {
            return [];
        }
    });
    const [isSyncing, setIsSyncing] = useState(false);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Data
    const { data: activeSessionData, isLoading: isLoadingSession } = useQuery({
        queryKey: ['pos-sessions', 'active'],
        queryFn: posSessionsApi.getActive,
        retry: false
    });
    const activeSession = activeSessionData?.data;
    const { data: warehousesData } = useWarehouses({ isActive: true });
    const { data: customersData } = useQuery({
        queryKey: ['customers', 'active'],
        queryFn: () => customersApi.list({ status: 'active', limit: 500 }),
    });
    const { data: productsData } = useQuery({
        queryKey: ['products', 'active', 'pos'],
        queryFn: () => productsApi.list({ status: 'active', canBeSold: true, limit: 500, includeBakery: true }),
    });
    const { data: categoriesData } = useCategories({ isActive: 'true' });
    const { data: stockData } = useQuery({
        queryKey: ['stock', 'pos', sourceWarehouseId],
        queryFn: () => stockApi.list({ warehouseId: sourceWarehouseId, limit: 500 }),
        enabled: !!sourceWarehouseId,
    });

    // Cache to localStorage for offline access
    useEffect(() => {
        if (productsData?.data?.length > 0) {
            localStorage.setItem('pos_offline_products', JSON.stringify(productsData.data));
        }
    }, [productsData]);

    useEffect(() => {
        const catList = Array.isArray(categoriesData?.data) ? categoriesData.data : (Array.isArray(categoriesData) ? categoriesData : []);
        if (catList.length > 0) {
            localStorage.setItem('pos_offline_categories', JSON.stringify(catList));
        }
    }, [categoriesData]);

    useEffect(() => {
        if (stockData?.data?.length > 0 && sourceWarehouseId) {
            localStorage.setItem('pos_offline_stock_' + sourceWarehouseId, JSON.stringify(stockData.data));
        }
    }, [stockData, sourceWarehouseId]);

    const warehouses = warehousesData?.data || [];
    const customers = customersData?.data || [];

    const products = useMemo(() => {
        if (productsData?.data?.length) return productsData.data.filter((p) => p.canBeSold !== false);
        try {
            const raw = localStorage.getItem('pos_offline_products');
            return raw ? JSON.parse(raw).filter((p) => p.canBeSold !== false) : [];
        } catch {
            return [];
        }
    }, [productsData]);

    const categories = useMemo(() => {
        const catList = Array.isArray(categoriesData?.data) ? categoriesData.data : (Array.isArray(categoriesData) ? categoriesData : null);
        if (catList && catList.length > 0) return catList;
        try {
            const raw = localStorage.getItem('pos_offline_categories');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }, [categoriesData]);

    const stockItems = useMemo(() => {
        if (stockData?.data?.length) return stockData.data;
        try {
            const raw = localStorage.getItem('pos_offline_stock_' + sourceWarehouseId);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }, [stockData, sourceWarehouseId]);

    // Set default warehouse
    useEffect(() => {
        if (!sourceWarehouseId && warehouses.length > 0) {
            const assignedVan = warehouses.find((w) => w.assignedRep === user?._id || w.assignedRep?._id === user?._id);
            const def = assignedVan || warehouses.find((w) => w.isDefault) || warehouses[0];
            if (def) setSourceWarehouseId(def._id);
        }
    }, [warehouses, sourceWarehouseId, user]);

    // Removed auto-select walk-in logic per user request

    // Build stock map
    const stockMap = useMemo(() => {
        const map = new Map();
        stockItems.forEach((s) => {
            const pid = s.productId?._id || s.productId;
            const existing = map.get(pid) || { onHand: 0, reserved: 0 };
            existing.onHand += s.quantities?.onHand || 0;
            existing.reserved += s.quantities?.reserved || 0;
            map.set(pid, existing);
        });
        return map;
    }, [stockItems]);

    // Filter products
    const filteredProducts = useMemo(() => {
        let result = products;
        if (activeCategory !== 'all') {
            result = result.filter((p) => {
                const pCatId = (p.categoryId?._id || p.categoryId)?.toString();
                return pCatId === activeCategory?.toString();
            });
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter((p) =>
                p.name?.toLowerCase().includes(q)
                || p.productCode?.toLowerCase().includes(q)
                || p.barcode?.toLowerCase().includes(q)
            );
        }
        return result.slice(0, 150); // limit display
    }, [products, activeCategory, searchQuery]);

    const customerSuggestions = useMemo(() => {
        if ((!customerSearch && !phoneSearch) || customerId) return [];
        const q = customerSearch.toLowerCase();
        const ph = phoneSearch.toLowerCase();
        return customers.filter(c => {
            if (customerSearch) return (
                c.displayName?.toLowerCase().includes(q) ||
                c.primaryContact?.phone?.includes(q) ||
                c.customerCode?.toLowerCase().includes(q)
            );
            if (phoneSearch) return c.primaryContact?.phone?.includes(ph);
            return false;
        }).slice(0, 5);
    }, [customerSearch, phoneSearch, customers, customerId]);

    const phoneSuggestions = useMemo(() => {
        if (!phoneSearch || customerId) return [];
        const ph = phoneSearch.toLowerCase();
        return customers.filter(c => c.primaryContact?.phone?.includes(ph)).slice(0, 5);
    }, [phoneSearch, customers, customerId]);

    // Helper: get tier price for product at given quantity
    const getTierPrice = (product, qty) => {
        if (!product.tierPricing || product.tierPricing.length === 0) return product.basePrice;
        const tiers = [...product.tierPricing].sort((a, b) => (b.minQuantity || 0) - (a.minQuantity || 0));
        for (const tier of tiers) {
            if (qty >= (tier.minQuantity || 0)) {
                const maxOk = !tier.maxQuantity || qty <= tier.maxQuantity;
                if (maxOk && tier.price > 0) return tier.price;
            }
        }
        return product.basePrice;
    };

    const selectedCustomer = customers.find((c) => c._id === customerId);
    const customerOptions = customers.map((c) => ({
        value: c._id,
        label: `${c.displayName} (${c.customerCode})`,
    }));

    // Helper to check non-stock items (beverages, services, trackStock: false)
    const checkIsNonStock = (product) => {
        if (!product) return false;
        if (product.trackStock === false) return true;
        if (product.productType === 'service' || product.type === 'service') return true;
        const name = (product.name || '').toLowerCase();
        if (/nescafe|nestea|plain tea|milk tea|coffee/i.test(name)) return true;
        return false;
    };

    // Helper to check if a product is sold by weight (loose bites, mixtures, bulk per-kg items)
    const isWeightProduct = (product) => {
        if (!product) return false;
        if (product.isWeightBased === true) return true;
        if (product.isWeightBased === false) return false;
        // Fallback for legacy items without explicit isWeightBased flag:
        const uom = (product.unitOfMeasure || '').toLowerCase();
        const name = (product.name || '').toLowerCase();
        const isPacketOrFixedGram = /(\d+\s*g|pkt|packet)/i.test(name);
        return (uom === 'kg' || uom === 'g') && !isPacketOrFixedGram;
    };

    const handleProductClick = (product) => {
        if (isWeightProduct(product)) {
            setWeightModalProduct(product);
            const existing = cart.find((i) => i.productId === (product._id || product.productId));
            const initialGrams = existing ? Math.round(existing.qty * 1000) : 100;
            setSelectedWeightGrams(initialGrams);
            setCustomWeightInput(initialGrams.toString());
            return;
        }
        addToCart(product);
    };

    const confirmWeight = (product, grams) => {
        const g = Math.max(1, parseFloat(grams) || 100);
        const isGramsUom = (product.unitOfMeasure || '').toLowerCase() === 'g';
        const qtyInKg = isGramsUom ? g : +(g / 1000).toFixed(3);

        const isNonStock = checkIsNonStock(product);
        const stock = stockMap.get(product._id || product.productId);
        const available = isNonStock ? 999999 : (stock ? Math.max(0, stock.onHand - stock.reserved) : (!isOnline ? 999999 : 0));

        const basePrice = product.basePrice || product.price || 0;
        const pid = product._id || product.productId;

        setCart((prev) => {
            const existing = prev.find((i) => i.productId === pid);
            if (existing) {
                return prev.map((i) => i.productId === pid
                    ? { ...i, qty: qtyInKg, price: basePrice }
                    : i
                );
            }

            return [...prev, {
                productId: pid,
                name: product.name,
                code: product.productCode || product.code,
                price: basePrice,
                qty: qtyInKg,
                available,
                isNonStock,
                unitOfMeasure: product.unitOfMeasure || 'kg',
                tierPricing: product.tierPricing || [],
                basePrice: basePrice,
            }];
        });

        setWeightModalProduct(null);
        toast.success(`Set ${g}g of ${product.name} (${fmt(qtyInKg * basePrice)})`);
    };

    // Cart actions
    const addToCart = (product) => {
        const isNonStock = checkIsNonStock(product);
        const stock = stockMap.get(product._id);
        const available = isNonStock ? 999999 : (stock ? Math.max(0, stock.onHand - stock.reserved) : (!isOnline ? 999999 : 0));

        if (!isNonStock && available <= 0) {
            toast(`${product.name}: 0 in stock (selling on negative balance)`, { icon: '⚠️', duration: 1800 });
        }

        setCart((prev) => {
            const existing = prev.find((i) => i.productId === product._id);
            if (existing) {
                const newQty = +(existing.qty + 1).toFixed(3);
                const tierPrice = getTierPrice(product, newQty);
                let price = tierPrice;
                if (selectedCustomer?.defaultDiscountPercent) {
                    price = price * (1 - selectedCustomer.defaultDiscountPercent / 100);
                }
                return prev.map((i) => i.productId === product._id
                    ? { ...i, qty: newQty, price: +price.toFixed(2), tierPricing: product.tierPricing } : i);
            }

            const tierPrice = getTierPrice(product, 1);
            let price = tierPrice;
            if (selectedCustomer?.defaultDiscountPercent) {
                price = price * (1 - selectedCustomer.defaultDiscountPercent / 100);
            }

            return [...prev, {
                productId: product._id,
                name: product.name,
                code: product.productCode,
                price: +price.toFixed(2),
                qty: 1,
                available,
                isNonStock,
                unitOfMeasure: product.unitOfMeasure,
                tierPricing: product.tierPricing || [],
                basePrice: product.basePrice,
            }];
        });
    };

    // Custom Open Item Added Handler
    const handleCustomItemAdded = (product, requestedQty = 1, customPrice = null) => {
        queryClient.invalidateQueries({ queryKey: ['products'] });
        const basePrice = customPrice !== null ? customPrice : (product.basePrice || 0);
        const pid = product._id;
        setCart((prev) => {
            const existing = prev.find((i) => i.productId === pid);
            if (existing) {
                return prev.map((i) => i.productId === pid ? { ...i, qty: +(i.qty + requestedQty).toFixed(3), price: basePrice } : i);
            }
            return [...prev, {
                productId: pid,
                name: product.name,
                code: product.productCode || product.code || 'OPEN-ITEM',
                price: basePrice,
                qty: requestedQty,
                available: 999999,
                isNonStock: true,
                unitOfMeasure: product.unitOfMeasure || 'pcs',
                tierPricing: product.tierPricing || [],
                basePrice: basePrice,
            }];
        });
    };

    // Helper to add Toffee / Small change items to cart
    const handleAddChangeItem = async (amount, label = 'Toffee') => {
        const toffeeName = `${label} Rs.${amount}`;
        let prod = products.find((p) => p.name.toLowerCase() === toffeeName.toLowerCase());

        if (!prod) {
            try {
                const res = await productsApi.create({
                    name: toffeeName,
                    productType: 'finished_good',
                    basePrice: amount,
                    purchasePrice: +(amount * 0.6).toFixed(2),
                    unitOfMeasure: 'pcs',
                    trackStock: false,
                    canBeSold: true,
                    status: 'active',
                });
                prod = res?.data;
                queryClient.invalidateQueries({ queryKey: ['products'] });
            } catch (err) {
                prod = products[0];
            }
        }

        if (prod) {
            addToCart({
                ...prod,
                name: toffeeName,
                basePrice: amount,
                price: amount,
            });
            toast.success(`Added ${toffeeName} to bill!`);
            const currentCash = parseFloat(calculatorCashReceived) || 0;
            const newTotal = totals.grandTotal + amount;
            setCalculatorChangeReturned(Math.max(0, currentCash - newTotal));
        }
    };

    const updateQty = (productId, delta) => {
        setCart((prev) => prev.map((i) => {
            if (i.productId !== productId) return i;
            const isWeight = i.qty < 1 || (i.unitOfMeasure || '').toLowerCase() === 'kg' || (i.name || '').toLowerCase().includes('bite');
            const step = isWeight && i.qty <= 1 ? (delta > 0 ? 0.05 : -0.05) : delta;
            const newQty = +(i.qty + step).toFixed(3);
            if (newQty <= 0) return null;
            // Recalculate tier price on qty change
            const newPrice = getTierPrice({ basePrice: i.basePrice || i.price, tierPricing: i.tierPricing || [] }, newQty);
            let finalPrice = newPrice;
            if (selectedCustomer?.defaultDiscountPercent) {
                finalPrice = finalPrice * (1 - selectedCustomer.defaultDiscountPercent / 100);
            }
            return { ...i, qty: newQty, price: +finalPrice.toFixed(2) };
        }).filter(Boolean));
    };

    const setQty = (productId, qty) => {
        setCart((prev) => prev.map((i) => {
            if (i.productId !== productId) return i;
            const newQty = Math.max(0, parseFloat(qty) || 0);
            // Recalculate tier price on qty change
            const newPrice = getTierPrice({ basePrice: i.basePrice || i.price, tierPricing: i.tierPricing || [] }, newQty);
            let finalPrice = newPrice;
            if (selectedCustomer?.defaultDiscountPercent) {
                finalPrice = finalPrice * (1 - selectedCustomer.defaultDiscountPercent / 100);
            }
            return { ...i, qty: newQty, price: +finalPrice.toFixed(2) };
        }).filter((i) => i.qty > 0));
    };

    const removeFromCart = (productId) => {
        setCart((prev) => prev.filter((i) => i.productId !== productId));
    };

    const clearCart = () => {
        if (cart.length === 0) return;
        if (window.confirm('Clear all items?')) setCart([]);
    };

    // Totals
    const totals = useMemo(() => {
        let subtotal = 0;
        cart.forEach((item) => {
            subtotal += item.qty * item.price;
        });
        const orderDiscPercentAmount = subtotal * (+orderDiscountPercent || 0) / 100;
        const orderDiscFixed = +orderDiscountAmount || 0;
        const totalDiscount = orderDiscPercentAmount + orderDiscFixed;
        const grandTotal = subtotal - totalDiscount;
        return {
            subtotal: +subtotal.toFixed(2),
            orderDiscount: +totalDiscount.toFixed(2),
            grandTotal: +grandTotal.toFixed(2),
            itemCount: cart.reduce((s, i) => s + i.qty, 0),
        };
    }, [cart, orderDiscountPercent, orderDiscountAmount]);

    const fmt = (n) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(n || 0);

    const syncOfflineOrders = async () => {
        if (offlineQueue.length === 0 || isSyncing) return;
        setIsSyncing(true);
        const toastId = toast.loading(`Syncing ${offlineQueue.length} offline orders...`);
        let syncedCount = 0;
        const currentQueue = [...offlineQueue];
        const remainingQueue = [];

        for (const order of currentQueue) {
            try {
                const { offlineId, cartSummary, total, createdAtLocal, ...orderPayload } = order;
                await createOrder.mutateAsync(orderPayload);
                syncedCount++;
            } catch (err) {
                console.error(`Failed to sync offline order ${order.offlineId}:`, err);
                remainingQueue.push(order);
            }
        }

        setOfflineQueue(remainingQueue);
        localStorage.setItem('pos_offline_orders', JSON.stringify(remainingQueue));
        setIsSyncing(false);

        if (syncedCount > 0) {
            toast.success(`Successfully synced ${syncedCount} offline order(s)!`, { id: toastId });
        } else {
            toast.error(`Sync failed. Please check connection.`, { id: toastId });
        }
    };

    useEffect(() => {
        if (isOnline && offlineQueue.length > 0 && !isSyncing) {
            syncOfflineOrders();
        }
    }, [isOnline]);

    const handleCheckout = async (saveAsDraft = false, method = 'cash', cashAmt = null, changeAmt = null, reference = '', cashSplit = 0) => {
        let finalCustomerId = customerId;

        // Auto-add customer if not selected but name typed
        if (!finalCustomerId && customerSearch) {
            try {
                const newCust = await createCustomer.mutateAsync({
                    displayName: customerSearch,
                    primaryContact: {
                        name: customerSearch,
                        phone: customerPhone || undefined
                    },
                    customerType: 'individual',
                    status: 'active'
                });
                finalCustomerId = newCust.data._id;
            } catch (err) {
                console.error('Auto-create customer error:', err);
                toast.error(err.response?.data?.message || err.message || 'Failed to auto-create customer');
                return;
            }
        }

        if (!finalCustomerId) {
            const walkin = customers.find((c) => c.displayName === 'Walk-in Customer' || c.customerCode === 'CUST-WALKIN');
            if (walkin) finalCustomerId = walkin._id;
        }

        if (!sourceWarehouseId) { toast.error('Select a warehouse'); return; }
        if (cart.length === 0) { toast.error('Cart is empty'); return; }
        if (!activeSession) { toast.error('You must open the cash register first'); setIsSessionModalOpen(true); return; }

        if (!saveAsDraft && cashAmt === null && method === 'cash') {
            setSelectedPaymentMethod('cash');
            setCalculatorCashReceived('');
            setCalculatorChangeReturned(0);
            setIsCalculatorModalOpen(true);
            return;
        }

        const payload = {
            customerId: finalCustomerId,
            sourceWarehouseId,
            source: 'pos',
            items: cart.map((i) => ({
                productId: i.productId,
                orderedQuantity: i.qty,
                unitPrice: i.price,
                discountPercent: 0,
                taxRate: 0,
                taxable: false,
            })),
            orderDiscount: (orderDiscountPercent > 0 || orderDiscountAmount > 0)
                ? { type: 'fixed', value: totals.orderDiscount }
                : undefined,
            status: saveAsDraft ? 'draft' : 'approved',
            paymentMethod: method,
            cashReceived: saveAsDraft ? undefined : (cashAmt !== null ? cashAmt : (method === 'cash' ? totals.grandTotal : undefined)),
            changeReturned: saveAsDraft ? undefined : (changeAmt || 0),
            paymentReference: reference || undefined,
            cashAmount: method === 'split' ? cashSplit : undefined,
        };

        try {
            const result = await createOrder.mutateAsync(payload);
            if (saveAsDraft) {
                toast.success('Order saved as draft');
                navigate(`/sales-orders/${result.data._id}`);
            } else {
                let fetchedInvoiceId = result.invoiceId || result.data?.invoiceId || null;
                if (!fetchedInvoiceId) {
                    try {
                        const invoicesRes = await api.get('/invoices', { params: { salesOrderId: result.data._id } });
                        if (invoicesRes.data?.data?.length > 0) {
                            fetchedInvoiceId = invoicesRes.data.data[0]._id;
                        }
                    } catch (err) {
                        console.error('Could not fetch invoice as fallback', err);
                    }
                }

                toast.success('Sale complete! Receipt generated.');
                setCart([]);
                setCustomerId('');
                setCustomerSearch('');
                setCustomerPhone('');
                setOrderDiscountPercent(0);
                setOrderDiscountAmount(0);

                // Navigate to receipt page - auto-triggers print dialog
                if (fetchedInvoiceId) {
                    navigate(`/receipt/${fetchedInvoiceId}`);
                }
            }
        } catch (err) {
            const isNetworkError = !navigator.onLine || err.message === 'Network Error' || !err.response;
            if (isNetworkError) {
                const offlineId = 'OFF-' + Date.now().toString().slice(-6);
                const offlineOrder = {
                    ...payload,
                    offlineId,
                    createdAtLocal: new Date().toISOString(),
                    cartSummary: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                    total: totals.grandTotal,
                };
                const updatedQueue = [...offlineQueue, offlineOrder];
                setOfflineQueue(updatedQueue);
                localStorage.setItem('pos_offline_orders', JSON.stringify(updatedQueue));

                toast.success(`Offline Sale Saved (#${offlineId})! Will sync when reconnected.`, { duration: 5000 });
                setCart([]);
                setCustomerId('');
                setCustomerSearch('');
                setCustomerPhone('');
                setOrderDiscountPercent(0);
                setOrderDiscountAmount(0);
                return;
            }
            console.error('Checkout failed:', err);
            toast.error(err.response?.data?.message || 'Checkout failed');
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50 -m-4 md:-m-6">
            {/* Top bar */}
            <div className="bg-white border-b px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center justify-between w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate('/sales-orders')}>
                            <ArrowLeft size={14} className="mr-1" /> Back
                        </Button>
                        <h1 className="font-bold text-lg flex items-center gap-2 md:hidden">
                            <ShoppingCart size={20} /> POS
                        </h1>
                    </div>
                    {/* Mobile Register Open/Close button & Sync indicator */}
                    <div className="flex md:hidden items-center gap-1.5">
                        {(!isOnline || offlineQueue.length > 0) && (
                            <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-900 px-2 py-1 rounded text-xs font-semibold">
                                {isOnline ? <Wifi size={12} className="text-emerald-600" /> : <WifiOff size={12} className="text-rose-600 animate-pulse" />}
                                {offlineQueue.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={syncOfflineOrders}
                                        disabled={isSyncing || !isOnline}
                                        className="bg-amber-600 active:bg-amber-700 text-white px-1.5 py-0.5 rounded text-[10px] font-bold"
                                    >
                                        {isSyncing ? '...' : `Sync (${offlineQueue.length})`}
                                    </button>
                                )}
                            </div>
                        )}
                        {activeSession ? (
                            <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 text-xs py-1.5 px-2.5 h-[36px]" onClick={() => setIsCloseRegisterModalOpen(true)}>
                                Close Reg
                            </Button>
                        ) : (
                            <Button variant="primary" size="sm" className="text-xs py-1.5 px-2.5 h-[36px]" onClick={() => setIsSessionModalOpen(true)}>
                                Open Reg
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center w-full">
                    {/* Customer & Phone section */}
                    <div className="flex-1 flex flex-col sm:flex-row gap-2 relative">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="Customer Name (Optional / Walk-in)..."
                                className="w-full px-3 py-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none border-gray-200 shadow-sm transition-all"
                                value={customerId ? selectedCustomer?.displayName : customerSearch}
                                onChange={(e) => {
                                    setCustomerSearch(e.target.value);
                                    setCustomerId('');
                                }}
                            />
                            {(customerId || customerSearch) && (
                                <button
                                    onClick={() => { setCustomerId(''); setCustomerSearch(''); setCustomerPhone(''); setPhoneSearch(''); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                >
                                    <X size={14} />
                                </button>
                            )}

                            {customerSearch && !customerId && customerSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="p-2 text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-gray-50 border-b">Suggested Customers</div>
                                    {customerSuggestions.map(c => (
                                        <button
                                            key={c._id}
                                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-primary-50 transition-colors border-b last:border-0 flex flex-col"
                                            onClick={() => {
                                                setCustomerId(c._id);
                                                setCustomerSearch('');
                                                setCustomerPhone('');
                                            }}
                                        >
                                            <span className="font-bold text-gray-800">{c.displayName}</span>
                                            <span className="text-[10px] text-gray-500 flex items-center gap-2">
                                                {c.customerCode} • {c.primaryContact?.phone || 'No phone'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            <div className="flex-1 sm:w-40 relative">
                                <input
                                    type="text"
                                    placeholder="Phone No..."
                                    className="w-full px-3 py-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none border-gray-200 shadow-sm transition-all"
                                    value={customerId ? (selectedCustomer?.primaryContact?.phone || '') : phoneSearch || customerPhone}
                                    onChange={(e) => {
                                        if (!customerId) {
                                            setPhoneSearch(e.target.value);
                                            setCustomerPhone(e.target.value);
                                            setCustomerId('');
                                        }
                                    }}
                                    readOnly={!!customerId}
                                />
                                {phoneSearch && !customerId && phoneSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200" style={{minWidth:'220px'}}>
                                        <div className="p-2 text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-gray-50 border-b">By Phone</div>
                                        {phoneSuggestions.map(c => (
                                            <button
                                                key={c._id}
                                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-primary-50 transition-colors border-b last:border-0 flex flex-col"
                                                onClick={() => {
                                                    setCustomerId(c._id);
                                                    setCustomerSearch('');
                                                    setPhoneSearch('');
                                                    setCustomerPhone('');
                                                }}
                                            >
                                                <span className="font-bold text-gray-800">{c.displayName}</span>
                                                <span className="text-[10px] text-gray-500">{c.primaryContact?.phone} • {c.customerCode}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Button variant="outline" size="sm" onClick={() => setIsCustomerModalOpen(true)} title={selectedCustomer ? "Edit Customer" : "Advanced Add"} className="h-[42px] px-3 shrink-0">
                                <UserPlus size={16} className={selectedCustomer ? "text-blue-600" : ""} />
                            </Button>
                        </div>
                    </div>

                    <div className="w-full lg:w-56">
                        <Select placeholder="Warehouse"
                            options={warehouses.map((w) => ({ value: w._id, label: w.name }))}
                            value={sourceWarehouseId} onChange={(e) => { setSourceWarehouseId(e.target.value); setCart([]); }} />
                    </div>

                    {selectedCustomer && (
                        <div className="text-xs text-gray-600 self-start lg:self-center shrink-0">
                            <p>Credit: <span className="font-semibold">{fmt(selectedCustomer.creditStatus?.availableCredit || 0)}</span></p>
                            {selectedCustomer.creditStatus?.onCreditHold && (
                                <Badge variant="danger">On Credit Hold</Badge>
                            )}
                        </div>
                    )}
                </div>

                <div className="hidden md:flex gap-2 shrink-0 items-center">
                    {(!isOnline || offlineQueue.length > 0) && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-semibold">
                            {isOnline ? <Wifi size={14} className="text-emerald-600" /> : <WifiOff size={14} className="text-rose-600 animate-pulse" />}
                            <span>{isOnline ? 'Online' : 'Offline'}</span>
                            {offlineQueue.length > 0 && (
                                <button
                                    type="button"
                                    onClick={syncOfflineOrders}
                                    disabled={isSyncing || !isOnline}
                                    className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-2 py-0.5 rounded text-[11px] font-bold shadow-sm transition"
                                >
                                    <RefreshCw size={11} className={isSyncing ? "animate-spin" : ""} />
                                    {isSyncing ? 'Syncing...' : `Sync (${offlineQueue.length})`}
                                </button>
                            )}
                        </div>
                    )}
                    {activeSession ? (
                        <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setIsCloseRegisterModalOpen(true)}>
                            Close Register
                        </Button>
                    ) : (
                        <Button variant="primary" onClick={() => setIsSessionModalOpen(true)}>
                            Open Register
                        </Button>
                    )}
                    <h1 className="font-bold text-lg items-center gap-2 flex ml-4">
                        <ShoppingCart size={20} /> POS
                    </h1>
                </div>
            </div>

            {/* Main 2-column layout */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Backdrop for mobile cart drawer */}
                {showCartOnMobile && (
                    <div 
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity duration-300 lg:hidden"
                        onClick={() => setShowCartOnMobile(false)}
                    />
                )}

                {/* Left: Product catalog */}
                <div className="flex-1 flex flex-col bg-gray-50 p-4 overflow-hidden flex">
                    {/* Search */}
                    <div className="flex flex-wrap sm:flex-nowrap gap-2 mb-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none border-gray-200"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* + Quick Custom / Open Item Button */}
                        <button
                            type="button"
                            onClick={() => {
                                setCustomItemInitialName(searchQuery.trim());
                                setIsCustomItemOpen(true);
                            }}
                            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition whitespace-nowrap shrink-0"
                            title="Sell custom or unlisted food item directly at POS"
                        >
                            <Sparkles size={14} className="text-amber-200" />
                            <span>+ Custom Item</span>
                        </button>

                        {/* Quick Toffee Button */}
                        <button
                            type="button"
                            onClick={() => handleAddChangeItem(10, 'Toffee')}
                            className="px-3 py-2 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap shrink-0 active:scale-95"
                            title="Quickly add Rs. 10 Toffee to bill"
                        >
                            <span>🍬</span>
                            <span className="hidden sm:inline">Toffee Rs.10</span>
                            <span className="sm:hidden">Rs.10</span>
                        </button>

                        {/* View toggle */}
                        <div className="flex bg-gray-150 border border-gray-200 rounded-lg p-0.5 shrink-0 bg-white">
                            <button
                                type="button"
                                onClick={() => toggleViewMode('grid')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                title="Grid View"
                            >
                                <LayoutGrid size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleViewMode('list')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                title="List View"
                            >
                                <List size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Category tabs */}
                    <div className="flex gap-1 mb-3 overflow-x-auto pb-1 no-scrollbar">
                        <button onClick={() => setActiveCategory('all')}
                            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${activeCategory === 'all' ? 'bg-primary-600 text-white' : 'bg-white border hover:bg-gray-100'
                                }`}>
                            All
                        </button>
                        {categories.map((c) => (
                            <button key={c._id} onClick={() => setActiveCategory(c._id)}
                                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${activeCategory === c._id ? 'bg-primary-600 text-white' : 'bg-white border hover:bg-gray-100'
                                    }`}>
                                {c.name}
                            </button>
                        ))}
                    </div>

                    {/* Product Catalog */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-dashed border-amber-300 text-center space-y-3 my-4">
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
                                    <Sparkles size={24} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-800">
                                        {searchQuery ? `"${searchQuery}" not found in system` : 'No products found'}
                                    </p>
                                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                                        Don't let the customer wait! You can sell this item directly in seconds.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCustomItemInitialName(searchQuery.trim());
                                        setIsCustomItemOpen(true);
                                    }}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition"
                                >
                                    <Plus size={15} />
                                    <span>+ Quick Sell "{searchQuery || 'New Food Item'}"</span>
                                </button>
                            </div>
                        ) : viewMode === 'list' ? (
                            <div className="flex flex-col gap-2">
                                {filteredProducts.map((p) => {
                                    const isNonStock = checkIsNonStock(p);
                                    const stock = stockMap.get(p._id);
                                    const available = isNonStock ? 999999 : (stock ? Math.max(0, stock.onHand - stock.reserved) : 0);
                                    const inCart = cart.find((i) => i.productId === p._id)?.qty || 0;
                                    const outOfStock = !isNonStock && available <= 0;

                                    return (
                                        <button
                                            key={p._id}
                                            onClick={() => handleProductClick(p)}
                                            className={`text-left bg-white border rounded-xl p-3 flex items-center justify-between transition-all hover:shadow-md hover:border-gray-300 active:scale-[0.99] ${
                                                outOfStock ? 'border-amber-200 bg-amber-50/20' : ''
                                            } ${inCart > 0 ? 'border-primary-500 bg-primary-50/50 ring-1 ring-primary-500' : ''}`}
                                        >
                                            <div className="min-w-0 flex-1 pr-4">
                                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                    <span className="font-bold text-sm text-gray-800 truncate">{p.name}</span>
                                                    {isWeightProduct(p) && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                                            <Scale size={10} /> By Weight
                                                        </span>
                                                    )}
                                                    {inCart > 0 && (
                                                        <Badge variant="primary" className="px-1.5 py-0 text-[10px] font-bold">
                                                            {inCart < 1 ? `${Math.round(inCart * 1000)}g` : inCart} in cart
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600">{p.productCode}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        Stock: 
                                                        {isNonStock ? (
                                                            <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                                                                Non-Stock (Available)
                                                            </span>
                                                        ) : (
                                                            <span className={`font-bold ${available <= 0 ? 'text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded text-[10px]' : available <= 5 ? 'text-amber-600' : 'text-gray-700'}`}>
                                                                {available <= 0 ? '0 (Sellable)' : `${available} ${p.unitOfMeasure || 'pcs'}`}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-primary-600">{fmt(p.basePrice)}</p>
                                                    {isWeightProduct(p) && <p className="text-[10px] text-amber-700 font-medium">/ 1 KG</p>}
                                                </div>
                                                <Badge variant={outOfStock ? 'warning' : isNonStock ? 'info' : available <= 5 ? 'warning' : 'success'} className="px-2 py-0.5 text-xs font-semibold">
                                                    {outOfStock ? '0 Stock (Sellable)' : isNonStock ? 'Always Available' : 'Available'}
                                                </Badge>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                                {filteredProducts.map((p) => {
                                    const isNonStock = checkIsNonStock(p);
                                    const stock = stockMap.get(p._id);
                                    const available = isNonStock ? 999999 : (stock ? Math.max(0, stock.onHand - stock.reserved) : 0);
                                    const inCart = cart.find((i) => i.productId === p._id)?.qty || 0;
                                    const outOfStock = !isNonStock && available <= 0;

                                    return (
                                        <button
                                            key={p._id}
                                            onClick={() => handleProductClick(p)}
                                            className={`relative text-left bg-white border rounded-xl p-3 flex flex-col justify-between transition-all min-h-[96px] hover:shadow-md active:scale-95 ${
                                                outOfStock ? 'border-amber-200 bg-amber-50/20' : 'hover:border-primary-300'
                                            } ${inCart > 0 ? 'border-primary-500 bg-primary-50/50 ring-1 ring-primary-500' : ''}`}
                                        >
                                            <div>
                                                <p className="text-xs font-bold text-gray-800 line-clamp-2 mb-0.5 leading-snug">{p.name}</p>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] text-gray-400 font-mono">{p.productCode}</p>
                                                    {isWeightProduct(p) && (
                                                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                                            ⚖️ / KG
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                                <div>
                                                    <p className="text-xs font-extrabold text-primary-600">{fmt(p.basePrice)}</p>
                                                    {isWeightProduct(p) && <p className="text-[9px] text-amber-700">per 1 KG</p>}
                                                </div>
                                                <span className={`text-[10px] font-bold ${outOfStock ? 'text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded' : isNonStock ? 'text-blue-600' : available <= 5 ? 'text-amber-500' : 'text-green-600'}`}>
                                                    {outOfStock ? '0 Stock' : isNonStock ? 'Available' : `${available} Left`}
                                                </span>
                                            </div>
                                            {inCart > 0 && (
                                                <div className="absolute top-1.5 right-1.5">
                                                    <span className="bg-primary-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                                                        {inCart < 1 ? `${Math.round(inCart * 1000)}g` : inCart}
                                                    </span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Cart (Fixed width on desktop, sliding drawer on mobile/tablet when active) */}
                <div className={`
                    fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] shadow-2xl flex flex-col bg-white border-l h-full transition-transform duration-300 ease-in-out
                    lg:static lg:w-96 lg:translate-x-0 lg:shadow-none lg:flex
                    ${showCartOnMobile ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
                `}>
                    <div className="p-4 border-b flex items-center justify-between bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setShowCartOnMobile(false)} className="p-2 -ml-2 text-gray-400 lg:hidden" aria-label="Close cart">
                                <ArrowLeft size={20} />
                            </button>
                            <h2 className="font-bold flex items-center gap-2">
                                <ShoppingCart size={18} /> Cart
                                {totals.itemCount > 0 && <Badge>{totals.itemCount}</Badge>}
                            </h2>
                        </div>
                        {cart.length > 0 && (
                            <button onClick={clearCart} className="text-xs text-red-600 font-semibold hover:underline">Clear all</button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {cart.length === 0 ? (
                            <div className="text-center text-gray-500 py-12">
                                <ShoppingCart size={32} className="mx-auto mb-2 text-gray-300" />
                                <p className="text-sm">Cart is empty</p>
                                <button onClick={() => setShowCartOnMobile(false)} className="mt-4 text-primary-600 text-sm font-bold lg:hidden">Browse Products</button>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <div key={item.productId} className="border border-gray-100 rounded-xl p-3 bg-gray-50/30">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <p className="text-sm font-bold text-gray-900 break-words leading-tight">{item.name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] text-gray-500 font-mono">{item.code}</span>
                                                {item.available <= 0 && !item.isNonStock && (
                                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1 py-0.2 rounded">
                                                        0 Stock (Negative)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => removeFromCart(item.productId)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-lg p-0.5 shadow-sm">
                                                <button onClick={() => updateQty(item.productId, -1)}
                                                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 text-gray-500 rounded-md transition-colors">
                                                    <Minus size={13} />
                                                </button>
                                                <input type="number" step="any" min="0.001" value={item.qty}
                                                    onChange={(e) => setQty(item.productId, e.target.value)}
                                                    className="w-12 text-center text-xs font-bold bg-transparent border-0 focus:ring-0 p-0" />
                                                <button onClick={() => updateQty(item.productId, 1)}
                                                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 text-gray-500 rounded-md transition-colors">
                                                    <Plus size={13} />
                                                </button>
                                            </div>

                                            {/* Weight edit button - only for weight-based products */}
                                            {isWeightProduct(item) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setWeightModalProduct(item);
                                                        const curG = Math.round(item.qty * 1000) || 100;
                                                        setSelectedWeightGrams(curG);
                                                        setCustomWeightInput(curG.toString());
                                                    }}
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2 py-1.5 rounded-lg transition"
                                                    title="Change Weight (g)"
                                                >
                                                    <Scale size={12} />
                                                    <span>{item.qty < 1 ? `${Math.round(item.qty * 1000)}g` : `${item.qty} kg`}</span>
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-sm font-black text-gray-900 shrink-0">{fmt(item.qty * item.price)}</p>
                                    </div>
                                    <div className="flex justify-between items-center mt-2 text-[10px] text-gray-400 font-medium">
                                        <span>
                                            {item.qty < 1 ? `${Math.round(item.qty * 1000)}g (${item.qty} kg) @ ` : `${item.qty} @ `}
                                            {fmt(item.price)} {item.unitOfMeasure ? `/ ${item.unitOfMeasure}` : ''}
                                        </span>
                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded-full">{item.isNonStock ? 'Non-Stock' : `${item.available} in stock`}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Summary */}
                    <div className="border-t p-4 space-y-3 bg-gray-50 sticky bottom-0">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-500 font-medium">
                                <span>Subtotal</span><span>{fmt(totals.subtotal)}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex justify-between items-center bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-xs">
                                    <span className="text-[10px] text-gray-500 font-semibold uppercase">Disc %</span>
                                    <input type="number" min="0" max="100" step="0.01"
                                        value={orderDiscountPercent}
                                        onChange={(e) => setOrderDiscountPercent(e.target.value)}
                                        className="w-12 text-right font-bold focus:outline-none text-xs bg-transparent border-0 p-0 focus:ring-0" />
                                </div>
                                <div className="flex justify-between items-center bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-xs">
                                    <span className="text-[10px] text-gray-500 font-semibold uppercase">Disc (Rs)</span>
                                    <input type="number" min="0" step="0.01"
                                        value={orderDiscountAmount}
                                        onChange={(e) => setOrderDiscountAmount(e.target.value)}
                                        className="w-16 text-right font-bold focus:outline-none text-xs bg-transparent border-0 p-0 focus:ring-0" />
                                </div>
                            </div>
                            {totals.orderDiscount > 0 && (
                                <div className="flex justify-between text-xs font-bold text-red-600">
                                    <span>Total Discount</span><span>-{fmt(totals.orderDiscount)}</span>
                                </div>
                            )}

                        </div>

                        <div className="flex justify-between pt-3 border-t border-gray-200">
                            <span className="font-bold text-gray-900">Total Payable</span>
                            <span className="text-xl font-black text-primary-600 leading-none">{fmt(totals.grandTotal)}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleCheckout(true)}
                                disabled={cart.length === 0} 
                                loading={createOrder.isPending}
                                className="py-2.5 text-xs text-slate-600"
                            >
                                <Save size={14} className="mr-1" /> Draft
                            </Button>
                            
                            <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => handleCheckout(false, 'cash', totals.grandTotal, 0)}
                                disabled={cart.length === 0} 
                                loading={createOrder.isPending}
                                className="py-2.5 text-xs font-bold bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                title="Instant 1-click checkout with exact cash"
                            >
                                <Zap size={14} className="mr-1 text-emerald-600 fill-emerald-600" /> Cash (Exact)
                            </Button>

                            <Button 
                                variant="primary" 
                                size="sm"
                                onClick={() => {
                                    setSelectedPaymentMethod('cash');
                                    setCalculatorCashReceived('');
                                    setCalculatorChangeReturned(0);
                                    setCardRefNumber('');
                                    setSplitCashAmount('');
                                    setSplitCardAmount('');
                                    setIsCalculatorModalOpen(true);
                                }}
                                disabled={cart.length === 0} 
                                loading={createOrder.isPending}
                                className="py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                <CreditCard size={14} className="mr-1" /> Pay / Options
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Mobile Cart Toggle Button */}
                {!showCartOnMobile && (
                    <button
                        onClick={() => setShowCartOnMobile(true)}
                        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-95 hover:scale-105 active:scale-90 transition-all duration-200"
                    >
                        <div className="relative">
                            <ShoppingCart size={24} />
                            {totals.itemCount > 0 && (
                                <span className="absolute -top-3 -right-3 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                                    {totals.itemCount}
                                </span>
                            )}
                        </div>
                    </button>
                )}
            </div>

            <QuickCreateCustomerModal
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                onSuccess={(newCustomer) => {
                    setCustomerId(newCustomer._id);
                    setCustomerSearch('');
                }}
                initialData={selectedCustomer || (customerSearch ? { displayName: customerSearch } : null)}
                isPosMode={true}
            />

            <PosSessionModal isOpen={isSessionModalOpen} onClose={() => setIsSessionModalOpen(false)} />
            <CloseRegisterModal isOpen={isCloseRegisterModalOpen} onClose={() => setIsCloseRegisterModalOpen(false)} session={activeSession} />

            {/* POS Payment Methods & Checkout Modal */}
            <Modal
                isOpen={isCalculatorModalOpen}
                onClose={() => setIsCalculatorModalOpen(false)}
                title="Select Payment Method & Settle Bill"
                size="lg"
            >
                <div className="p-6 space-y-5">
                    {/* Grand Total Display */}
                    <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-4 flex justify-between items-center shadow-md">
                        <div>
                            <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Bill Total Payable</p>
                            <p className="text-3xl font-black mt-0.5 tracking-tight">{fmt(totals.grandTotal)}</p>
                            {selectedCustomer && (
                                <p className="text-xs text-slate-300 mt-1">Customer: <span className="font-bold text-white">{selectedCustomer.displayName}</span></p>
                            )}
                        </div>
                        <div className="bg-white/10 text-white rounded-xl p-3 backdrop-blur-xs">
                            <Wallet size={32} />
                        </div>
                    </div>

                    {/* Payment Method Tabs */}
                    <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setSelectedPaymentMethod('cash')}
                            className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition ${
                                selectedPaymentMethod === 'cash'
                                    ? 'bg-white text-emerald-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Banknote size={16} />
                            <span>Cash</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelectedPaymentMethod('card')}
                            className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition ${
                                selectedPaymentMethod === 'card'
                                    ? 'bg-white text-blue-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <CreditCard size={16} />
                            <span>Card / POS</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelectedPaymentMethod('qr')}
                            className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition ${
                                selectedPaymentMethod === 'qr'
                                    ? 'bg-white text-purple-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <QrCode size={16} />
                            <span>QR / Online</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelectedPaymentMethod('credit')}
                            className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition ${
                                selectedPaymentMethod === 'credit'
                                    ? 'bg-white text-amber-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <FileText size={16} />
                            <span>Credit / Later</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setSelectedPaymentMethod('split');
                                setSplitCashAmount((totals.grandTotal / 2).toFixed(2));
                                setSplitCardAmount((totals.grandTotal / 2).toFixed(2));
                            }}
                            className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition ${
                                selectedPaymentMethod === 'split'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Split size={16} />
                            <span>Split Pay</span>
                        </button>
                    </div>

                    {/* METHOD 1: CASH */}
                    {selectedPaymentMethod === 'cash' && (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Cash Tendered / Received (Rs.)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">Rs.</span>
                                    <input
                                        type="number"
                                        step="any"
                                        autoFocus
                                        placeholder="0.00"
                                        value={calculatorCashReceived}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setCalculatorCashReceived(val);
                                            const parsed = parseFloat(val) || 0;
                                            setCalculatorChangeReturned(Math.max(0, parsed - totals.grandTotal));
                                        }}
                                        className="w-full bg-white border-2 border-emerald-300 rounded-xl py-3 pl-12 pr-4 text-2xl font-bold font-mono text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                                    />
                                </div>
                            </div>

                            {/* Shortcuts */}
                            <div className="grid grid-cols-5 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCalculatorCashReceived(totals.grandTotal.toString());
                                        setCalculatorChangeReturned(0);
                                    }}
                                    className="py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition active:scale-95 border border-slate-200"
                                >
                                    Exact Cash
                                </button>
                                {[1000, 2000, 5000, 10000].map((denom) => (
                                    <button
                                        key={denom}
                                        type="button"
                                        onClick={() => {
                                            setCalculatorCashReceived(denom.toString());
                                            setCalculatorChangeReturned(Math.max(0, denom - totals.grandTotal));
                                        }}
                                        className="py-2 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg transition active:scale-95 border border-emerald-200"
                                    >
                                        Rs. {denom.toLocaleString('en-LK')}
                                    </button>
                                ))}
                            </div>

                            {/* Change Returned Display */}
                            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Change to Return to Customer</p>
                                    <p className="text-3xl font-extrabold text-emerald-950 mt-0.5">{fmt(calculatorChangeReturned)}</p>
                                </div>
                                <div className="bg-emerald-600 text-white rounded-xl p-2.5 shadow-sm">
                                    <CheckCircle size={26} />
                                </div>
                            </div>

                            {/* Toffee as Change Options */}
                            {calculatorChangeReturned > 0 && (
                                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-lg">🍬</span>
                                            <span className="text-xs font-bold text-amber-900">No Coins? Give Toffee as Change:</span>
                                        </div>
                                        <span className="text-[11px] font-medium text-amber-700">Auto-updates bill & stock</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {calculatorChangeReturned >= 10 && (
                                            <button
                                                type="button"
                                                onClick={() => handleAddChangeItem(10, 'Toffee')}
                                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-2xs transition active:scale-95 flex items-center gap-1"
                                            >
                                                <span>🍬</span>
                                                <span>Give Rs. 10 Toffee</span>
                                            </button>
                                        )}
                                        {calculatorChangeReturned >= 5 && (
                                            <button
                                                type="button"
                                                onClick={() => handleAddChangeItem(5, 'Toffee')}
                                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-2xs transition active:scale-95 flex items-center gap-1"
                                            >
                                                <span>🍬</span>
                                                <span>Give Rs. 5 Toffee</span>
                                            </button>
                                        )}
                                        {calculatorChangeReturned > 0 && calculatorChangeReturned !== 10 && calculatorChangeReturned !== 5 && (
                                            <button
                                                type="button"
                                                onClick={() => handleAddChangeItem(calculatorChangeReturned, 'Toffee/Sweet')}
                                                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg shadow-2xs transition active:scale-95 flex items-center gap-1"
                                            >
                                                <span>🍬</span>
                                                <span>Give Rs. {calculatorChangeReturned} Item</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Insufficient Cash Warning */}
                            {calculatorCashReceived && (parseFloat(calculatorCashReceived) || 0) < totals.grandTotal && (
                                <div className="flex items-center gap-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                                    <AlertCircle size={16} />
                                    <span>Cash received is less than total payable!</span>
                                </div>
                            )}

                            {/* Submit Cash Button */}
                            <Button
                                variant="primary"
                                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2"
                                disabled={!calculatorCashReceived || (parseFloat(calculatorCashReceived) || 0) < totals.grandTotal || createOrder.isPending}
                                onClick={async () => {
                                    setIsCalculatorModalOpen(false);
                                    await handleCheckout(false, 'cash', parseFloat(calculatorCashReceived), calculatorChangeReturned);
                                }}
                            >
                                {createOrder.isPending ? 'Processing Sale...' : `Confirm Cash Payment (${fmt(totals.grandTotal)})`}
                            </Button>
                        </div>
                    )}

                    {/* METHOD 2: CARD / POS MACHINE */}
                    {selectedPaymentMethod === 'card' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-blue-900 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-sm">
                                    <CreditCard size={18} className="text-blue-600" />
                                    <span>Card Payment / Bank POS Terminal</span>
                                </div>
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    Swipe, tap or insert Visa / Master / Debit card on the card machine for <strong>{fmt(totals.grandTotal)}</strong>.
                                </p>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-700 uppercase">
                                    Card Approval Code / Slip Ref # (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. AUTH-482910 / Slip # 1042"
                                    value={cardRefNumber}
                                    onChange={(e) => setCardRefNumber(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white font-mono"
                                />
                            </div>

                            <Button
                                variant="primary"
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2"
                                disabled={createOrder.isPending}
                                onClick={async () => {
                                    setIsCalculatorModalOpen(false);
                                    await handleCheckout(false, 'card', totals.grandTotal, 0, cardRefNumber);
                                }}
                            >
                                {createOrder.isPending ? 'Processing...' : `Confirm Card Payment (${fmt(totals.grandTotal)})`}
                            </Button>
                        </div>
                    )}

                    {/* METHOD 3: QR / ONLINE */}
                    {selectedPaymentMethod === 'qr' && (
                        <div className="space-y-4">
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 text-purple-950 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-sm text-purple-800">
                                    <QrCode size={18} className="text-purple-600" />
                                    <span>LankaPay QR / Online Bank App Transfer</span>
                                </div>
                                <p className="text-xs text-purple-700 leading-relaxed">
                                    Customer scans the store LankaQR code or sends online bank transfer of <strong>{fmt(totals.grandTotal)}</strong>.
                                </p>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-700 uppercase">
                                    QR Transaction Reference # (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. TXN-998823 / Reference"
                                    value={cardRefNumber}
                                    onChange={(e) => setCardRefNumber(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white font-mono"
                                />
                            </div>

                            <Button
                                variant="primary"
                                className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2"
                                disabled={createOrder.isPending}
                                onClick={async () => {
                                    setIsCalculatorModalOpen(false);
                                    await handleCheckout(false, 'qr', totals.grandTotal, 0, cardRefNumber);
                                }}
                            >
                                {createOrder.isPending ? 'Processing...' : `Confirm QR / Online Transfer (${fmt(totals.grandTotal)})`}
                            </Button>
                        </div>
                    )}

                    {/* METHOD 4: CREDIT / PAY LATER */}
                    {selectedPaymentMethod === 'credit' && (
                        <div className="space-y-4">
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-950 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
                                    <FileText size={18} className="text-amber-600" />
                                    <span>Customer Account Credit (Pay Later)</span>
                                </div>
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    This bill of <strong>{fmt(totals.grandTotal)}</strong> will be charged to the customer's credit ledger.
                                </p>
                            </div>

                            {(!customerId && !customerSearch) && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-700">
                                    ⚠️ Please select or type a Customer Name before completing a credit sale!
                                </div>
                            )}

                            <Button
                                variant="primary"
                                className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2"
                                disabled={(!customerId && !customerSearch) || createOrder.isPending}
                                onClick={async () => {
                                    setIsCalculatorModalOpen(false);
                                    await handleCheckout(false, 'credit', 0, 0);
                                }}
                            >
                                {createOrder.isPending ? 'Processing...' : `Confirm Credit Sale (${fmt(totals.grandTotal)})`}
                            </Button>
                        </div>
                    )}

                    {/* METHOD 5: SPLIT PAYMENT */}
                    {selectedPaymentMethod === 'split' && (
                        <div className="space-y-4">
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 text-indigo-950 text-xs">
                                Split total payable across <strong>Cash</strong> and <strong>Card/Online</strong>:
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Cash Portion (Rs.)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="0.00"
                                        value={splitCashAmount}
                                        onChange={(e) => {
                                            const cash = parseFloat(e.target.value) || 0;
                                            setSplitCashAmount(e.target.value);
                                            setSplitCardAmount(Math.max(0, +(totals.grandTotal - cash).toFixed(2)).toString());
                                        }}
                                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base font-bold font-mono text-emerald-800 bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Card / Other Portion (Rs.)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="0.00"
                                        value={splitCardAmount}
                                        onChange={(e) => {
                                            const card = parseFloat(e.target.value) || 0;
                                            setSplitCardAmount(e.target.value);
                                            setSplitCashAmount(Math.max(0, +(totals.grandTotal - card).toFixed(2)).toString());
                                        }}
                                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base font-bold font-mono text-blue-800 bg-white"
                                    />
                                </div>
                            </div>

                            {/* Split Balance Verification */}
                            {((parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0) !== totals.grandTotal) && (
                                <div className="text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded border border-rose-200">
                                    Split sum must equal exactly {fmt(totals.grandTotal)}!
                                </div>
                            )}

                            <Button
                                variant="primary"
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2"
                                disabled={
                                    ((parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0) !== totals.grandTotal) ||
                                    createOrder.isPending
                                }
                                onClick={async () => {
                                    setIsCalculatorModalOpen(false);
                                    await handleCheckout(
                                        false,
                                        'split',
                                        totals.grandTotal,
                                        0,
                                        `Split: Cash Rs. ${splitCashAmount} + Card Rs. ${splitCardAmount}`,
                                        parseFloat(splitCashAmount) || 0
                                    );
                                }}
                            >
                                {createOrder.isPending ? 'Processing...' : `Confirm Split Payment (${fmt(totals.grandTotal)})`}
                            </Button>
                        </div>
                    )}

                    {/* Modal Cancel Button */}
                    <div className="pt-2 border-t">
                        <Button
                            variant="outline"
                            className="w-full py-2.5 text-xs text-slate-500"
                            onClick={() => setIsCalculatorModalOpen(false)}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Weight & Grams Selection Modal for Bites / Per-KG items */}
            <Modal
                isOpen={!!weightModalProduct}
                onClose={() => setWeightModalProduct(null)}
                title={`⚖️ Select Weight — ${weightModalProduct?.name || ''}`}
                size="md"
            >
                {weightModalProduct && (
                    <div className="p-5 space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-sm text-amber-950">{weightModalProduct.name}</h3>
                                <p className="text-xs text-amber-700 font-mono mt-0.5">
                                    Base Price: {fmt(weightModalProduct.basePrice || weightModalProduct.price)} / 1 KG
                                </p>
                            </div>
                            <div className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">
                                Sold by Weight
                            </div>
                        </div>

                        {/* Quick Grams Chips */}
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-2">Quick Grams Selection:</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: '50g', grams: 50 },
                                    { label: '100g', grams: 100 },
                                    { label: '150g', grams: 150 },
                                    { label: '200g', grams: 200 },
                                    { label: '250g', grams: 250 },
                                    { label: '500g (½ kg)', grams: 500 },
                                    { label: '750g', grams: 750 },
                                    { label: '1000g (1 kg)', grams: 1000 },
                                ].map((chip) => {
                                    const isSelected = selectedWeightGrams === chip.grams;
                                    return (
                                        <button
                                            key={chip.grams}
                                            type="button"
                                            onClick={() => {
                                                setSelectedWeightGrams(chip.grams);
                                                setCustomWeightInput(chip.grams.toString());
                                            }}
                                            className={`py-2 px-1 text-xs font-bold rounded-lg border transition text-center ${
                                                isSelected
                                                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                                    : 'bg-white hover:bg-amber-50 text-gray-700 border-gray-200'
                                            }`}
                                        >
                                            {chip.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Custom Grams Input */}
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">Custom Weight (in Grams):</label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newG = Math.max(10, selectedWeightGrams - 50);
                                        setSelectedWeightGrams(newG);
                                        setCustomWeightInput(newG.toString());
                                    }}
                                    className="w-11 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-700 text-xs"
                                >
                                    -50g
                                </button>
                                <div className="relative flex-1">
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        placeholder="e.g. 100"
                                        value={customWeightInput}
                                        onChange={(e) => {
                                            setCustomWeightInput(e.target.value);
                                            const val = parseFloat(e.target.value);
                                            if (!isNaN(val) && val > 0) setSelectedWeightGrams(val);
                                        }}
                                        className="w-full px-3 py-2 text-center text-lg font-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">grams</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newG = selectedWeightGrams + 50;
                                        setSelectedWeightGrams(newG);
                                        setCustomWeightInput(newG.toString());
                                    }}
                                    className="w-11 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-700 text-xs"
                                >
                                    +50g
                                </button>
                            </div>
                        </div>

                        {/* Live Price Calculation Box */}
                        <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between shadow-inner">
                            <div>
                                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Calculated Total</p>
                                <p className="text-xs text-amber-400 font-medium mt-0.5">
                                    {selectedWeightGrams}g ({((selectedWeightGrams || 0) / 1000).toFixed(3)} KG)
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black text-white">
                                    {fmt(((selectedWeightGrams || 0) / 1000) * (weightModalProduct.basePrice || weightModalProduct.price || 0))}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setWeightModalProduct(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                                onClick={() => confirmWeight(weightModalProduct, selectedWeightGrams)}
                            >
                                Confirm {selectedWeightGrams}g
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Quick Custom / Open Item Modal */}
            <QuickCustomItemModal
                isOpen={isCustomItemOpen}
                onClose={() => {
                    setIsCustomItemOpen(false);
                    setCustomItemInitialName('');
                }}
                initialName={customItemInitialName}
                onItemAdded={handleCustomItemAdded}
            />

            <style dangerouslySetInnerHTML={{
                __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </div>
    );
}