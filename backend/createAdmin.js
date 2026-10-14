import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import { seedDefaults } from './src/utils/seedDefaults.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const createLogins = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // 1. Admin User
        let adminUser = await User.findOne({ email: 'admin@admin.com' });
        if (adminUser) {
            console.log('Admin user exists. Updating password and ensuring active status...');
            adminUser.password = 'password123';
            adminUser.role = 'admin';
            adminUser.isActive = true;
            await adminUser.save();
        } else {
            console.log('Creating new admin user...');
            adminUser = new User({
                firstName: 'Super',
                lastName: 'Admin',
                email: 'admin@admin.com',
                password: 'password123',
                role: 'admin',
                isActive: true
            });
            await adminUser.save();
        }

        // 2. Cashier User
        let cashierUser = await User.findOne({ email: 'cashier@admin.com' });
        if (cashierUser) {
            console.log('Cashier user exists. Updating password and ensuring active status...');
            cashierUser.password = 'password123';
            cashierUser.role = 'cashier';
            cashierUser.isActive = true;
            await cashierUser.save();
        } else {
            console.log('Creating new cashier user...');
            cashierUser = new User({
                firstName: 'POS',
                lastName: 'Cashier',
                email: 'cashier@admin.com',
                password: 'password123',
                role: 'cashier',
                isActive: true
            });
            await cashierUser.save();
        }

        // 3. Seed essential baseline data (Warehouses, Walk-in Customer, UOMs, Categories)
        console.log('Seeding baseline defaults...');
        await seedDefaults();

        console.log('\n=======================================');
        console.log('✓ Admin and Cashier accounts created:');
        console.log('---------------------------------------');
        console.log('ADMIN:');
        console.log('  Email:    admin@admin.com');
        console.log('  Password: password123');
        console.log('  Role:     admin');
        console.log('---------------------------------------');
        console.log('CASHIER:');
        console.log('  Email:    cashier@admin.com');
        console.log('  Password: password123');
        console.log('  Role:     cashier');
        console.log('=======================================\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error creating users:', error);
        process.exit(1);
    }
};

createLogins();
