import mongoose from 'mongoose';
import dns from 'dns';

// Configure DNS to use Google's public DNS servers to bypass institutional blocking
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables manually
dotenv.config({ path: path.join(process.cwd(), '.env') });

import Credit from '../models/Credit';
import KYC from '../models/KYC';
import Loan from '../models/Loan';

async function seed() {
    console.log('Starting execution of seed script...');

    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        console.error('Please define the MONGODB_URI environment variable inside .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data (optional, but good for idempotency)
        await Credit.deleteMany({});
        await KYC.deleteMany({});
        await Loan.deleteMany({});
        console.log('Cleared existing collections');

        // Read data files
        const creditPath = path.join(process.cwd(), 'src', 'mastra', 'data', 'credit.json');
        const kycPath = path.join(process.cwd(), 'src', 'mastra', 'data', 'kyc.json');
        const loansPath = path.join(process.cwd(), 'src', 'mastra', 'data', 'loans.json');

        const creditData = JSON.parse(fs.readFileSync(creditPath, 'utf8'));
        const kycData = JSON.parse(fs.readFileSync(kycPath, 'utf8'));
        const loansData = JSON.parse(fs.readFileSync(loansPath, 'utf8'));

        // Seed Credit
        if (creditData.length > 0) {
            await Credit.insertMany(creditData);
            console.log(`Successfully seeded ${creditData.length} Credit records.`);
        }

        // Seed KYC
        if (kycData.length > 0) {
            await KYC.insertMany(kycData);
            console.log(`Successfully seeded ${kycData.length} KYC records.`);
        }

        // Seed Loans
        if (loansData.length > 0) {
            await Loan.insertMany(loansData);
            console.log(`Successfully seeded ${loansData.length} Loan records.`);
        }

        console.log('Database seeding complete!');
    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

seed();
