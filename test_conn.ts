import dbConnect from './src/lib/mongodb';

async function testConnection() {
    try {
        await dbConnect();
        console.log("Connection successful!");
    } catch (error) {
        console.error("Connection failed:", error);
    }
    process.exit(0);
}

testConnection();
