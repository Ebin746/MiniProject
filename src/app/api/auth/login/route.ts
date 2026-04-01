import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { signJWT } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { email, password } = await req.json();
        const normalizedEmail = String(email).toLowerCase().trim();

        // Validate inputs
        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
        }

        const user = await User.findOne({ email: normalizedEmail }).select('+password');
        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
        }

        const token = await signJWT({ userId: String(user._id), name: user.name, email: user.email });
        const response = NextResponse.json({ success: true, user: { name: user.name, email: user.email } });

        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 1 day
        });

        return response;
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
