import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const defaultUoms = [
    { name: 'Pieces', symbol: 'pcs', type: 'count', isActive: true },
    { name: 'Kilograms', symbol: 'kg', type: 'weight', isActive: true },
    { name: 'Grams', symbol: 'g', type: 'weight', isActive: true },
    { name: 'Packets', symbol: 'pkt', type: 'count', isActive: true },
    { name: 'Boxes', symbol: 'box', type: 'count', isActive: true },
    { name: 'Bottles', symbol: 'bottle', type: 'count', isActive: true },
    { name: 'Cans', symbol: 'can', type: 'count', isActive: true },
    { name: 'Portion', symbol: 'portion', type: 'count', isActive: true },
    { name: 'Cups', symbol: 'cup', type: 'volume', isActive: true },
    { name: 'Liters', symbol: 'ltr', type: 'volume', isActive: true },
    { name: 'Milliliters', symbol: 'ml', type: 'volume', isActive: true },
];

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    for (const u of defaultUoms) {
        await mongoose.connection.db.collection('uoms').updateOne(
            { symbol: u.symbol },
            { $set: u },
            { upsert: true }
        );
    }
    console.log('Seeded UOMs successfully!');
    process.exit(0);
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
