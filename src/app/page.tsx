import React from 'react';
import  Link  from "next/link";

const LandingPage = () => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 selection:bg-teal-500/20 font-sans text-slate-900">
      
      {/* Background Glow Orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] opacity-50"></div>
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-teal-500/5 rounded-full blur-[100px] opacity-30"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-teal-700 bg-clip-text text-transparent">Finance Bot</span>
          </div>
          <div className="hidden md:flex gap-8 font-medium text-slate-600">
            <a href="#how-it-works" className="hover:text-blue-600">Process</a>
            <a href="#features" className="hover:text-blue-600">Features</a>
            <a href="#reviews" className="hover:text-blue-600">Reviews</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href ="/login">
            <button className="text-sm font-medium text-slate-600 px-4">Log In</button>
            </Link>
            <Link href ="/signup">
            <button className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95">Get Started</button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 lg:pt-48 lg:pb-32 text-center lg:text-left">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-8">
              <div className="inline-flex items-center gap-2 bg-white border border-blue-100 px-4 py-1.5 rounded-full text-sm font-medium text-blue-600 shadow-sm">
                <span>✨ Smart Banking Assistant</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] text-slate-900">
                Get Your Loan Approved<br />
                <span className="bg-gradient-to-r from-blue-600 via-teal-500 to-blue-600 bg-clip-text text-transparent">In Minutes, Not Days</span>
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0">
                Our AI-powered bot analyzes your eligibility and connects you with the best loan offers instantly. Secure, fast, and completely automated.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                <button className="bg-blue-600 text-white w-full sm:w-auto text-lg h-14 px-10 rounded-2xl shadow-xl shadow-blue-600/30 font-bold hover:scale-105 transition-all">
                  Apply Now
                </button>
                <button className="bg-white border border-slate-200 text-slate-700 w-full sm:w-auto text-lg h-14 px-10 rounded-2xl font-bold hover:bg-slate-50 transition-all">
                  View Rates
                </button>
              </div>
            </div>
            
            {/* Visual Element (Chat Mockup) */}
            <div className="flex-1 w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 hidden lg:block">
              <div className="space-y-4">
                <div className="bg-slate-100 p-3 rounded-2xl rounded-bl-none text-sm max-w-[80%] text-slate-700">Hi! I need a personal loan of 5 Lakhs.</div>
                <div className="bg-blue-600 p-3 rounded-2xl rounded-br-none text-sm max-w-[80%] ml-auto text-white">Analyzing your PAN and score... I found 3 matches with low interest!</div>
                <div className="h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400">
                  Loan Calculation Result
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NEW: How it Works Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">How it Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto">1</div>
              <h3 className="text-xl font-bold">Chat with Bot</h3>
              <p className="text-slate-600">Provide basic details like PAN and Income to our smart AI assistant.</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto">2</div>
              <h3 className="text-xl font-bold">Get Match</h3>
              <p className="text-slate-600">We instantly compare rates from 20+ banks to find the lowest EMI.</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto">3</div>
              <h3 className="text-xl font-bold">Instant Payout</h3>
              <p className="text-slate-600">Once approved, the funds are transferred directly to your bank.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Updated Features Section */}
      <section id="features" className="py-24 px-4 bg-slate-900 text-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Secure & Simple</h2>
          <p className="text-slate-400 mb-12">Your financial security is our top priority.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 hover:-translate-y-2 transition-all duration-300">
              <div className="text-blue-400 text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold mb-4">Fast Process</h3>
              <div className="text-slate-400">Skip the paperwork. Complete your application in under 5 minutes.</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 hover:-translate-y-2 transition-all duration-300">
              <div className="text-teal-400 text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-bold mb-4">AI Driven</h3>
              <div className="text-slate-400">Smart algorithms that ensure you never get rejected for small errors.</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 hover:-translate-y-2 transition-all duration-300">
              <div className="text-blue-400 text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-bold mb-4">256-bit Security</h3>
              <div className="text-slate-400">Bank-grade encryption to keep your Aadhar and PAN details safe.</div>
            </div>
          </div>
        </div>
      </section>

      {/* NEW: Reviews Section */}
      <section id="reviews" className="py-24 bg-slate-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-16">Trusted by 10,000+ Users</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-left">
              <p className="italic text-slate-600 mb-4">"I never knew taking a loan could be as easy as chatting on WhatsApp. The bot found me a rate 2% lower than my local bank!"</p>
              <p className="font-bold text-slate-900">- Athul Raj</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-left">
              <p className="italic text-slate-600 mb-4">"The instant calculation for loan eligibility saved me so much time. Very secure and highly recommended!"</p>
              <p className="font-bold text-slate-900">- Kiran Roy</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 bg-white">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            <span className="font-bold text-slate-900 text-xl">Finance Bot</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 Finance Bot. All Rights Reserved.</p>
          <div className="flex gap-6 text-sm font-medium text-slate-500">
            <span className="hover:text-blue-600 cursor-pointer">Privacy</span>
            <span className="hover:text-blue-600 cursor-pointer">Terms</span>
            <span className="hover:text-blue-600 cursor-pointer">Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;