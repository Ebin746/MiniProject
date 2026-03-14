"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sun, Moon, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [isDark, setIsDark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const toggleTheme = () => setIsDark(!isDark);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      router.push('/chat');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex min-h-screen relative overflow-hidden items-center justify-center px-4 py-12 font-sans transition-colors duration-500 ${
      isDark ? "bg-slate-950" : "bg-slate-50"
    }`}>
      
      {/* Background Glow Orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full blur-[120px] transition-colors duration-700 ${
          isDark ? "bg-blue-900/20" : "bg-blue-600/5"
        }`}></div>
        <div className={`absolute bottom-0 right-0 w-[800px] h-[600px] rounded-full blur-[100px] transition-colors duration-700 ${
          isDark ? "bg-teal-900/20" : "bg-teal-500/5"
        }`}></div>
      </div>

      {/* Header Section */}
      <div className="absolute top-0 w-full p-6 flex items-center justify-between px-8">
        <div className="flex items-center gap-2">
           <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <div className="w-5 h-5 bg-white rounded-sm"></div>
           </div>
           <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-teal-700 bg-clip-text text-transparent">
             Finance Bot
           </span>
        </div>

        {/* Animated Theme Slider */}
        <button 
          onClick={toggleTheme}
          className={`relative w-14 h-8 rounded-full p-1 transition-colors duration-300 focus:outline-none shadow-inner ${
            isDark ? "bg-slate-800" : "bg-slate-200"
          }`}
        >
          <div className={`w-6 h-6 rounded-full shadow-md transform transition-transform duration-500 flex items-center justify-center ${
            isDark ? "translate-x-6 bg-slate-900" : "translate-x-0 bg-white"
          }`}>
            {isDark ? (
              <Moon size={14} className="text-blue-400 fill-blue-400" />
            ) : (
              <Sun size={14} className="text-yellow-500 fill-yellow-500" />
            )}
          </div>
        </button>
      </div>

      <div className={`w-full max-w-md space-y-8 rounded-[2.5rem] p-10 shadow-2xl transition-all duration-500 border relative z-10 ${
        isDark 
          ? "bg-slate-900 border-slate-800 shadow-black/40" 
          : "bg-white border-slate-200 shadow-slate-200/50"
      }`}>
        
        <div className="text-center space-y-2">
          <h2 className={`text-3xl font-bold tracking-tight transition-colors ${isDark ? "text-white" : "text-slate-800"}`}>
            Welcome Back
          </h2>
          <p className={`text-sm font-medium transition-colors ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Enter your details to access your account
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className={`w-full border-t ${isDark ? "border-slate-800" : "border-slate-100"}`} />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm animate-shake">
            {error}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div>
              <label className={`block text-sm font-semibold ml-1 transition-colors ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Full Name
              </label>
              <div className="mt-2">
                <input
                  name="name"
                  type="text"
                  required
                  className={`block w-full rounded-2xl border px-4 py-3 outline-none transition-all ${
                    isDark 
                      ? "bg-slate-800 border-slate-700 text-white focus:bg-slate-950 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" 
                      : "bg-slate-50/50 border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  }`}
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-semibold ml-1 transition-colors ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Email address
              </label>
              <div className="mt-2">
                <input
                  name="email"
                  type="email"
                  required
                  className={`block w-full rounded-2xl border px-4 py-3 outline-none transition-all ${
                    isDark 
                      ? "bg-slate-800 border-slate-700 text-white focus:bg-slate-950 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" 
                      : "bg-slate-50/50 border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  }`}
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-semibold ml-1 transition-colors ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Password
              </label>
              <div className="mt-2">
                <input
                  name="password"
                  type="password"
                  required
                  className={`block w-full rounded-2xl border px-4 py-3 outline-none transition-all ${
                    isDark 
                      ? "bg-slate-800 border-slate-700 text-white focus:bg-slate-950 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" 
                      : "bg-slate-50/50 border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  }`}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Log in"}
          </button>
        </form>

        <div className="text-center space-y-3">
          <p className={`text-sm transition-colors ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            New User?{" "}
            <Link href="/signup" className="font-bold text-blue-600 hover:text-teal-600 transition-colors">
              Sign Up
            </Link>
          </p>
          <Link href="/" className="inline-block font-bold text-blue-600 hover:text-teal-600 transition-colors text-sm">
            Home 
          </Link>
        </div>
      </div>
    </div>
  );
}