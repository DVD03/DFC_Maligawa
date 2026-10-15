import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../models/User.js';
import Product from '../models/Product.js';
import StockItem from '../models/StockItem.js';
import StockMovement from '../models/StockMovement.js';
import Warehouse from '../models/Warehouse.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import { getNextSequence } from '../models/Counter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function importStock() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        // Load items
        const jsonPath = path.join(__dirname, 'shop_stock_items.json');
        const items = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        console.log(`Loaded ${items.length} items from shop_stock_items.json`);

        // Find Admin user
        const adminUser = await User.findOne({ role: 'admin' }) || await User.findOne();
        if (!adminUser) throw new Error('No admin user found!');
        console.log(`Using admin user: ${adminUser.email} (${adminUser._id})`);

        // Find Default Warehouse
        const mainWarehouse = await Warehouse.findOne({ isDefault: true }) || await Warehouse.findOne();
        if (!mainWarehouse) throw new Error('No default warehouse found!');
        console.log(`Using warehouse: ${mainWarehouse.name} (${mainWarehouse._id})`);

        // Categories map
        const categoryMap = {};
        const uniqueCategories = [...new Set(items.map((i) => i.category))];
        for (const catName of uniqueCategories) {
            let cat = await Category.findOne({ name: catName });
            if (!cat) {
                const code = catName.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '') || 'CAT';
                cat = await Category.create({
                    name: catName,
                    code: `${code}-${Date.now().toString().slice(-4)}`,
                    description: `${catName} category`,
                    type: 'product',
                    isActive: true,
                    createdBy: adminUser._id,
                });
                console.log(`Created category: ${cat.name} (${cat._id})`);
            }
            categoryMap[catName] = cat;
        }

        // Brands map
        const brandMap = {};
        const uniqueBrands = [...new Set(items.map((i) => i.brand).filter(Boolean))];
        for (const brandName of uniqueBrands) {
            let brand = await Brand.findOne({ name: brandName });
            if (!brand) {
                const code = brandName.slice(0, 5).toUpperCase().replace(/[^A-Z]/g, '') || 'BRD';
                brand = await Brand.create({
                    name: brandName,
                    code: `${code}-${Date.now().toString().slice(-4)}`,
                    description: `${brandName} brand`,
                    isActive: true,
                    createdBy: adminUser._id,
                });
                console.log(`Created brand: ${brand.name} (${brand._id})`);
            }
            brandMap[brandName] = brand;
        }

        let importedProducts = 0;
        let createdStockItems = 0;
        let totalQtyImported = 0;

        for (const item of items) {
            // Check if product exists by SKU or name
            let product = await Product.findOne({
                $or: [
                    { sku: item.sku },
                    { name: item.name },
                ],
            });

            const cat = categoryMap[item.category];
            const brand = item.brand ? brandMap[item.brand] : null;

            if (!product) {
                const seq = await getNextSequence('product');
                const productCode = `PRD-${seq}`;

                product = await Product.create({
                    productCode,
                    sku: item.sku,
                    name: item.name,
                    categoryId: cat._id,
                    brandId: brand?._id || undefined,
                    productType: 'finished_good',
                    type: 'trading',
                    unitOfMeasure: 'pcs',
                    basePrice: item.sellPrice || 0,
                    purchasePrice: item.buyPrice || 0,
                    trackStock: true,
                    canBeSold: true,
                    canBePurchased: true,
                    canBeManufactured: false,
                    status: 'active',
                    costs: {
                        standardCost: item.buyPrice || 0,
                        averageCost: item.buyPrice || 0,
                        lastPurchaseCost: item.buyPrice || 0,
                    },
                    tax: { taxable: false, taxRate: 0 },
                    stockLevels: {
                        minimumLevel: 0,
                        reorderLevel: 5,
                        maximumLevel: 100,
                    },
                    createdBy: adminUser._id,
                    updatedBy: adminUser._id,
                });
                importedProducts++;
            } else {
                // Update pricing and category if needed
                product.basePrice = item.sellPrice || product.basePrice;
                if (item.buyPrice) product.purchasePrice = item.buyPrice;
                product.trackStock = true;
                await product.save();
            }

            // Create or update StockItem
            let stockItem = await StockItem.findOne({
                productId: product._id,
                warehouseId: mainWarehouse._id,
                batchNumber: null,
            });

            const qty = item.qty || 0;
            const cost = item.buyPrice || 0;

            if (!stockItem) {
                stockItem = await StockItem.create({
                    productId: product._id,
                    productCode: product.productCode,
                    productName: product.name,
                    warehouseId: mainWarehouse._id,
                    unitOfMeasure: product.unitOfMeasure,
                    costPerUnit: cost,
                    quantities: {
                        onHand: qty,
                        reserved: 0,
                        available: qty,
                    },
                    totalValue: qty * cost,
                    lastMovementDate: new Date(),
                    lastCountDate: new Date(),
                });
                createdStockItems++;
            } else {
                stockItem.quantities.onHand = qty;
                stockItem.quantities.available = Math.max(0, qty - (stockItem.quantities.reserved || 0));
                stockItem.costPerUnit = cost;
                stockItem.totalValue = qty * cost;
                await stockItem.save();
            }

            // Create StockMovement audit record if qty > 0
            if (qty > 0) {
                await StockMovement.create({
                    productId: product._id,
                    productCode: product.productCode,
                    productName: product.name,
                    warehouseId: mainWarehouse._id,
                    direction: 'in',
                    quantity: qty,
                    unitOfMeasure: product.unitOfMeasure || 'pcs',
                    balanceBefore: 0,
                    balanceAfter: qty,
                    costPerUnit: cost,
                    totalCost: qty * cost,
                    movementType: 'opening_stock',
                    sourceDocument: {
                        type: 'opening_stock',
                        number: 'INIT-EXCEL',
                    },
                    reason: 'Complete Shop Stock Import from Excel',
                    userId: adminUser._id,
                });
            }

            totalQtyImported += qty;
        }

        console.log('----------------------------------------------------');
        console.log('SUCCESSFULLY IMPORTED COMPLETE SHOP STOCK!');
        console.log(`Products Processed: ${items.length}`);
        console.log(`New Products Created: ${importedProducts}`);
        console.log(`Stock Records Created/Updated: ${items.length}`);
        console.log(`Total Units On-Hand: ${totalQtyImported}`);
        console.log('----------------------------------------------------');

        process.exit(0);
    } catch (err) {
        console.error('Import failed:', err);
        process.exit(1);
    }
}

importStock();
