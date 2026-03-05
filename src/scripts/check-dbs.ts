import mongoose from 'mongoose';
import dns from 'dns';

// Configure DNS to use Google's public DNS servers to bypass institutional blocking
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function checkDatabases() {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        fs.writeFileSync('db_check_results.json', JSON.stringify({ error: 'No URI' }));
        process.exit(1);
    }

    const report: any = { error: null, dbs: [] };

    try {
        await mongoose.connect(MONGODB_URI);

        const adminDb = mongoose.connection.db!.admin();
        const dbs = await adminDb.listDatabases();

        for (const dbInfo of dbs.databases) {
            const dbName = dbInfo.name;
            const db = mongoose.connection.client.db(dbName);
            const collectionsObj = await db.listCollections().toArray();
            const collections = collectionsObj.map(c => c.name);
            report.dbs.push({ database: dbName, collections });
        }
    } catch (error: any) {
        report.error = error.message;
    } finally {
        await mongoose.disconnect();
    }

    fs.writeFileSync('db_check_results.json', JSON.stringify(report, null, 2));
}

checkDatabases();
