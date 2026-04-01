import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-fallback-secret-key-change-this'
);

// Simple in-memory cache for JWT verification (can be replaced with Redis for production)
const jwtCache = new Map<string, { payload: any; expiresAt: number }>();

export async function signJWT(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);
}

export async function verifyJWT(token: string) {
    try {
        // Check cache first
        const cached = jwtCache.get(token);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.payload;
        }

        const { payload } = await jwtVerify(token, secret);
        
        // Cache for 30 seconds to reduce verification overhead
        const expiresAt = Date.now() + 30000;
        jwtCache.set(token, { payload, expiresAt });
        
        // Cleanup old cache entries
        for (const [key, value] of jwtCache.entries()) {
            if (value.expiresAt < Date.now()) {
                jwtCache.delete(key);
            }
        }
        
        return payload;
    } catch (error) {
        return null;
    }
}

export async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    return await verifyJWT(token);
}
