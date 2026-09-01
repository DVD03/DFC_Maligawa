import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
   
dotenv.config();

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({ email: 'admin@admin.com' });
        if (user) {
            console.log('User found:', user.email);
            console.log('Is Active:', user.isActive);
            console.log('Role:', user.role);
        } else {
            console.log('User not found');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

check();
