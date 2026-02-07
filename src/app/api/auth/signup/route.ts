import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { signJWT } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        await dbConnect();

        const { name, email, password } = await req.json();

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return NextResponse.json({ error: 'User already exists' }, { status: 400 });
        }

        const user = await User.create({ name, email, password });

        const token = await signJWT({ userId: user._id, name: user.name, email: user.email });

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
