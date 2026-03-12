import mongoose from 'mongoose';
import dns from 'dns';

// Configure DNS to use Google's public DNS servers to bypass institutional blocking
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

// Use environment variable if available, otherwise fallback to the URL provided
const URL = process.env.MONGODB_URI
const dbConnect = async () => {
    // Check if we have a connection to the database or if it's currently
    // connecting or disconnecting (readyState 1, 2 and 3)
    if (mongoose.connection.readyState >= 1) {
        return;
    }

    try {
        await mongoose.connect(URL!);
        console.log("MongoDB Connected Successfully");
    } catch (error) {
        console.error("MongoDB Connection Failed:", error);
        throw error;
    }
};

export default dbConnect;
