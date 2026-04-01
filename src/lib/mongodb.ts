import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in environment variables');
}

type MongooseCache = {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = global as typeof globalThis & {
    mongooseCache?: MongooseCache;
};

const cached: MongooseCache = globalWithMongoose.mongooseCache ?? {
    conn: null,
    promise: null,
};

globalWithMongoose.mongooseCache = cached;

const dbConnect = async () => {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI, {
            bufferCommands: false,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
    }

    try {
        cached.conn = await cached.promise;
        return cached.conn;
    } catch (error) {
        cached.promise = null;
        throw error;
    }
};

export default dbConnect;
