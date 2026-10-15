import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const products = await mongoose.connection.db.collection('products').find({}).sort({ createdAt: -1 }).limit(20).toArray();
    console.log('Latest 20 products:');
    for (const p of products) {
        console.log({
            id: p._id,
            name: p.name,
            code: p.productCode,
            type: p.productType,
            trackStock: p.trackStock,
            canBeSold: p.canBeSold,
            status: p.status,
            unitOfMeasure: p.unitOfMeasure,
            basePrice: p.basePrice,
            createdAt: p.createdAt
        });
    }
    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
