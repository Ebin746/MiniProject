import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { signJWT } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { name, email, password } = await req.json();
        const normalizedEmail = String(email).toLowerCase().trim();

        // Validate inputs before DB query
        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        try {
            const user = await User.create({ name, email: normalizedEmail, password });

            const token = await signJWT({ userId: user._id, name: user.name, email: user.email });
            const response = NextResponse.json({ success: true, user: { name: user.name, email: user.email } });
            response.cookies.set('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24, // 1 day
            });
            return response;
        } catch (err: any) {
            // Handle duplicate email error from MongoDB unique constraint
            if (err.code === 11000 || err.message.includes('duplicate')) {
                return NextResponse.json({ error: 'User already exists' }, { status: 400 });
            }
            throw err;
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
