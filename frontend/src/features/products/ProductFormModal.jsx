import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Package, Tag, Barcode, DollarSign, Scale, Layers } from 'lucide-react';

import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { productFormSchema } from './productSchemas';
import { useBrands, useUoms, useCategories, useCreateProduct, useUpdateProduct } from './useProducts';

export default function ProductFormModal({ isOpen, onClose, product = null }) {
    const isEdit = !!product;

    const { data: brandsData } = useBrands();
    const { data: uomsData } = useUoms();
    const { data: categoriesData } = useCategories();
    const createProduct = useCreateProduct();
    const updateProduct = useUpdateProduct();

    const defaultUoms = [
        { value: 'pcs', label: 'Pieces (pcs)' },
        { value: 'kg', label: 'Kilograms (kg)' },
        { value: 'g', label: 'Grams (g)' },
        { value: 'pkt', label: 'Packets (pkt)' },
        { value: 'box', label: 'Boxes (box)' },
        { value: 'bottle', label: 'Bottles (bottle)' },
        { value: 'can', label: 'Cans (can)' },
        { value: 'portion', label: 'Portions (portion)' },
        { value: 'cup', label: 'Cups (cup)' },
        { value: 'ltr', label: 'Liters (ltr)' },
        { value: 'ml', label: 'Milliliters (ml)' },
    ];

    const uomOptions = (uomsData?.data && uomsData.data.length > 0)
        ? uomsData.data.map((u) => ({ value: u.symbol || u.code, label: `${u.name} (${u.symbol || u.code})` }))
        : defaultUoms;

    const brandOptions = [
        { value: '', label: '-- None / No Brand --' },
        ...(brandsData?.data || []).map((b) => ({ value: b._id, label: b.name })),
    ];

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(productFormSchema),
        defaultValues: {
            name: '',
            barcode: '',
            brandId: '',
            unitOfMeasure: 'pcs',
            buyingPrice: 0,
            basePrice: 0,
            status: 'active',
        },
    });

    const buyPrice = watch('buyingPrice') || 0;
    const sellPrice = watch('basePrice') || 0;
    const profit = sellPrice > 0 ? (sellPrice - buyPrice).toFixed(2) : 0;
    const margin = sellPrice > 0 ? (((sellPrice - buyPrice) / sellPrice) * 100).toFixed(1) : 0;

    useEffect(() => {
        if (isOpen && product) {
            reset({
                name: product.name || '',
                barcode: product.barcode || '',
                brandId: product.brandId?._id || product.brandId || '',
                unitOfMeasure: product.unitOfMeasure || 'pcs',
                buyingPrice: product.purchasePrice ?? product.costs?.standardCost ?? 0,
                basePrice: product.basePrice || 0,
                status: product.status || 'active',
                categoryId: product.categoryId?._id || product.categoryId || '',
            });
        } else if (isOpen && !product) {
            reset({
                name: '',
                barcode: '',
                brandId: '',
                unitOfMeasure: 'pcs',
                buyingPrice: 0,
                basePrice: 0,
                status: 'active',
                categoryId: categoriesData?.data?.[0]?._id || '',
            });
        }
    }, [isOpen, product, reset, categoriesData]);

    const onSubmit = async (data) => {
        const payload = {
            name: data.name.trim(),
            barcode: data.barcode?.trim() || undefined,
            brandId: data.brandId || undefined,
            unitOfMeasure: data.unitOfMeasure || 'pcs',
            basePrice: Number(data.basePrice) || 0,
            purchasePrice: Number(data.buyingPrice) || 0,
            costs: {
                ...(product?.costs || {}),
                standardCost: Number(data.buyingPrice) || 0,
            },
            categoryId: product?.categoryId?._id || product?.categoryId || categoriesData?.data?.[0]?._id,
            productType: product?.productType || 'finished_good',
            type: product?.type || 'trading',
            status: product?.status || 'active',
            trackStock: product?.trackStock !== undefined ? product.trackStock : true,
            canBeSold: true,
            canBePurchased: true,
        };

        if (isEdit) {
            await updateProduct.mutateAsync({ id: product._id, data: payload });
        } else {
            await createProduct.mutateAsync(payload);
        }
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? 'Edit Product' : 'Add New Product'}
            size="md"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                {/* Product Name */}
                <div>
                    <Input
                        label="Product Name"
                        required
                        placeholder="e.g. Fish Bun / Milo 180ml / Sugar 1kg"
                        {...register('name')}
                        error={errors.name?.message}
                    />
                </div>

                {/* Barcode & Brand */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Input
                            label="Barcode Number"
                            placeholder="e.g. 4791234567890"
                            {...register('barcode')}
                            error={errors.barcode?.message}
                        />
                    </div>

                    <div>
                        <Select
                            label="Brand"
                            options={brandOptions}
                            {...register('brandId')}
                            error={errors.brandId?.message}
                        />
                    </div>
                </div>

                {/* Unit of Measure (UOM) */}
                <div>
                    <Select
                        label="Unit of Measure (UOM)"
                        required
                        options={uomOptions}
                        {...register('unitOfMeasure')}
                        error={errors.unitOfMeasure?.message}
                    />
                </div>

                {/* Buy Price & Sell Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Input
                            label="Buy Price (Rs.)"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...register('buyingPrice')}
                            error={errors.buyingPrice?.message}
                        />
                    </div>

                    <div>
                        <Input
                            label="Sell Price (Rs.)"
                            required
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...register('basePrice')}
                            error={errors.basePrice?.message}
                        />
                    </div>
                </div>

                {/* Real-time Profit / Margin Preview */}
                {(Number(buyPrice) > 0 || Number(sellPrice) > 0) && (
                    <div className="flex items-center justify-between p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs">
                        <span className="text-slate-600 font-medium">Profit Calculation:</span>
                        <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                                profit > 0 ? 'bg-emerald-100 text-emerald-800' : profit < 0 ? 'bg-rose-100 text-rose-800' : 'text-slate-500'
                            }`}>
                                Profit: Rs. {profit}
                            </span>
                            <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                                margin >= 25 ? 'bg-emerald-100 text-emerald-800' : margin > 0 ? 'bg-amber-100 text-amber-800' : 'text-slate-500'
                            }`}>
                                Margin: {margin}%
                            </span>
                        </div>
                    </div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <Button variant="outline" type="button" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        loading={createProduct.isPending || updateProduct.isPending}
                    >
                        {isEdit ? 'Update Product' : 'Save Product'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}