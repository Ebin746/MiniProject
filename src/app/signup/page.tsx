"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    age: "",
    password: "",
    confirmPassword: "",
    Aadhar: "",
    pan_no: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError("Error: Passwords do not match!");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      router.push('/chat');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (

    <div className="flex min-h-screen relative overflow-hidden items-center justify-center bg-slate-50 px-4 py-12 font-sans">
      
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] opacity-60"></div>
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-teal-500/5 rounded-full blur-[100px] opacity-40"></div>
      </div>

      <div className="absolute top-0 w-full p-6">
        <div className="mx-auto flex max-w-7xl items-center justify-center md:justify-start gap-2">
           <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <div className="w-5 h-5 bg-white rounded-sm"></div>
           </div>
           <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-teal-700 bg-clip-text text-transparent">
             Finance Bot
           </span>
        </div>
      </div>

      <div className="w-full max-w-2xl space-y-8 rounded-[2.5rem] bg-white p-10 shadow-2xl shadow-slate-200/50 border border-slate-200 mt-20 relative z-10">
        <div className="text-center space-y-2">
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-800">
            Sign Up
          </h2>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100" />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm animate-shake">
            {error}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-5">
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-slate-600 ml-1">
                  Full Name
                </label>
                <div className="mt-2">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    placeholder="Ebin Amson"
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-slate-600 ml-1">
                  Phone Number
                </label>
                <div className="mt-2">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    placeholder="+91 1234567890"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-600 ml-1">
                Email address
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-600 ml-1">
                  Password
                </label>
                <div className="mt-2">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-600 ml-1">
                  Confirm Password
                </label>
                <div className="mt-2">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Create Account"}
          </button>
        </form>

        <div className="flex flex-col items-center justify-center">
          <div className="mt-2 text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="login" className="font-bold text-blue-600 hover:text-teal-600 transition-colors">
              Log In
            </Link>
          </div>
          <div className="flex items-center justify-center mt-2 text-sm text-slate-500">
             <Link href="/" className="font-bold text-blue-600 hover:text-teal-600 transition-colors">
              Home 
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
}