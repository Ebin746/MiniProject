'use client';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { useState, useEffect, useRef } from 'react';
import { LogOut, User as UserIcon, ImagePlus, Loader2, Moon, Send, Sun } from 'lucide-react';
import { clearAuthMeCache, getAuthMe, type AuthMeUser } from '@/lib/client-auth';
import { useTheme } from 'next-themes';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ocrPreview?: OCRPreview;
}

interface OCRPreview {
  fileName: string;
  imageUrl: string;
}

function normalizePdfHref(rawHref: string): string {
  if (!rawHref) return rawHref;

  try {
    const url = rawHref.startsWith('http')
      ? new URL(rawHref)
      : new URL(rawHref, window.location.origin);

    if (url.pathname === '/pdfs/loan_done') {
      const fullUrl = url.searchParams.get('fullUrl');
      if (fullUrl) {
        return decodeURIComponent(fullUrl);
      }
    }

    if (rawHref.startsWith('/pdfs/')) {
      return `${window.location.origin}${rawHref}`;
    }

    return rawHref;
  } catch {
    return rawHref;
  }
}

export default function Home() {
  const MIN_RESPONSE_DELAY_MS = 900;
  const { resolvedTheme, setTheme } = useTheme();
  const [user, setUser] = useState<AuthMeUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<'sales' | 'kyc' | 'credit' | 'loan_selection' | 'docs' | 'done'>('sales');
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const mounted = resolvedTheme !== undefined;
  const isDark = resolvedTheme === 'dark';
  const demoBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const demoDownloadBase = demoBaseUrl ? `${demoBaseUrl}/loanPassing` : '/loanPassing';

  const createMessageId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  useEffect(() => {
    checkAuth();
    setSessionId(`session_${Math.random().toString(36).substring(7)}`);
  }, []);

  const checkAuth = async () => {
    try {
      const result = await getAuthMe();
      setUser(result.user);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      clearAuthMeCache();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
    };
  }, []);

  const sendMessage = async (overrideMessage?: string, options?: { hideUserEcho?: boolean }) => {
    const userMessage = overrideMessage || input.trim();
    if (!userMessage || loading) return;
    const requestStartedAt = Date.now();

    if (!overrideMessage) setInput('');
    if (!options?.hideUserEcho) {
      setMessages((prev) => [...prev, { id: createMessageId(), role: 'user', content: userMessage }]);
    }
    setLoading(true);
    setIsThinking(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMessage }),
      });

      const data = await response.json();
      const elapsed = Date.now() - requestStartedAt;
      if (elapsed < MIN_RESPONSE_DELAY_MS) {
        await wait(MIN_RESPONSE_DELAY_MS - elapsed);
      }

      console.log(data);
      if (data.error) {
        setMessages((prev) => [...prev, { id: createMessageId(), role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
        setMessages((prev) => [...prev, { id: createMessageId(), role: 'assistant', content: data.response }]);
        setStage(data.session.stage);
        if (data.pdfPath) {
          setPdfPath(data.pdfPath);
        }
      }
    } catch {
      const elapsed = Date.now() - requestStartedAt;
      if (elapsed < MIN_RESPONSE_DELAY_MS) {
        await wait(MIN_RESPONSE_DELAY_MS - elapsed);
      }
      setMessages((prev) => [...prev, { id: createMessageId(), role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setIsThinking(false);
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const imageUrl = URL.createObjectURL(file);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Send to OCR Upload API
      const res = await fetch('/api/ocr/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.text) {
        // 2. Insert OCR preview as a normal chat message so timeline order stays intact
        previewUrlsRef.current.push(imageUrl);
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: 'user',
            content: '',
            ocrPreview: {
              fileName: file.name,
              imageUrl,
            },
          },
        ]);
        sendMessage(`EXTRACTED_DOC_DATA: ${data.text}`, { hideUserEcho: true });
      } else {
        URL.revokeObjectURL(imageUrl);
        alert('OCR failed to extract text. Please try or type manually.');
      }
    } catch (error) {
      URL.revokeObjectURL(imageUrl);
      console.error('File upload error:', error);
      alert('Error uploading file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!authChecking && !user) {
      window.location.href = '/login';
    }
  }, [authChecking, user]);

  if (!mounted || authChecking) {
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className={`relative flex h-screen flex-col overflow-hidden font-sans transition-colors duration-300 ${
      isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
    }`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan-200/30 blur-3xl dark:bg-cyan-500/10" />
        <div className="absolute -right-20 top-24 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-500/10" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/20 blur-3xl dark:bg-emerald-500/10" />
      </div>
      {/* Header */}
      <header className={`sticky top-0 z-20 border-b px-3 py-2.5 shadow-sm backdrop-blur-sm transition-colors duration-300 sm:px-6 sm:py-4 ${
        isDark ? 'border-zinc-800 bg-zinc-900/95' : 'border-zinc-200 bg-white/95'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-600 text-sm font-bold text-white shadow-lg ring-2 ring-indigo-500/20 flex items-center justify-center sm:h-10 sm:w-10 sm:text-xl">
              A
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className={`truncate text-sm font-bold tracking-tight sm:text-lg ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>loanCopilot</h1>
                <div className={`hidden items-center gap-1.5 text-xs sm:flex ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  <span className={isDark ? 'text-zinc-700' : 'text-zinc-300'}>|</span>
                  <UserIcon size={12} />
                  <span className="max-w-55 truncate">{user.name}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`hidden rounded-full px-3 py-1 text-[10px] font-mono lg:block ${
              isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-100 text-zinc-500'
            }`}>
              ID: {sessionId}
            </div>
            <button
              onClick={toggleTheme}
              className={`relative h-7 w-12 rounded-full p-1 shadow-inner transition-colors duration-300 focus:outline-none sm:h-8 sm:w-14 ${
                isDark ? 'bg-zinc-800' : 'bg-zinc-200'
              }`}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full shadow-md transform transition-transform duration-500 sm:h-6 sm:w-6 ${
                  isDark ? 'translate-x-5 sm:translate-x-6 bg-zinc-900' : 'translate-x-0 bg-white'
                }`}
              >
                {isDark ? (
                  <Moon size={12} className="text-blue-400 fill-blue-400 sm:h-3.5 sm:w-3.5" />
                ) : (
                  <Sun size={12} className="text-yellow-500 fill-yellow-500 sm:h-3.5 sm:w-3.5" />
                )}
              </div>
            </button>
            <button
              onClick={handleLogout}
              className={`rounded-lg p-2 text-zinc-500 transition-colors ${
                isDark ? 'hover:bg-red-900/10 hover:text-red-400' : 'hover:bg-red-50 hover:text-red-500'
              }`}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <div className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium capitalize sm:mt-1 sm:text-xs ${
          isDark ? 'text-zinc-400' : 'text-zinc-500'
        }`}>
          <span className={`w-2 h-2 rounded-full ${stage === 'done' ? 'bg-green-500' : stage === 'kyc' || stage === 'credit' ? 'bg-amber-500' : 'bg-indigo-500'} animate-pulse`} />
          Stage: {stage}
          {pdfPath && (
            <a
              href={pdfPath.startsWith('/pdfs/') ? `${typeof window !== 'undefined' ? window.location.origin : ''}${pdfPath}` : pdfPath}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 hover:text-indigo-400 underline"
            >
              View PDF
            </a>
          )}
        </div>
      </header>

      {/* Chat History */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 space-y-6 overflow-y-auto p-4 scroll-smooth sm:p-6"
      >
        {messages.length === 0 && (
          <div className={`mx-auto flex h-full max-w-sm animate-in flex-col items-center justify-center space-y-4 rounded-3xl border p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] fade-in slide-in-from-bottom-4 duration-1000 backdrop-blur-xl ${
            isDark ? 'border-zinc-700/60 bg-zinc-900/70' : 'border-white/70 bg-white/80'
          }`}>
            <div className={`mb-2 flex h-16 w-16 items-center justify-center rounded-3xl text-3xl shadow-inner ${
              isDark ? 'bg-indigo-950/30' : 'bg-indigo-50'
            }`}>Hi</div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>Hello {(user.name || 'User').split(' ')[0]}!</h2>
            <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              I&apos;m your loanCopilot. I can help you check your loan eligibility in minutes. Let&apos;s start with your basic details.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mx-auto flex w-full max-w-4xl ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            {msg.ocrPreview ? (
              <div className="w-65 shrink-0 rounded-3xl border border-zinc-200/70 bg-linear-to-br from-white via-zinc-100/90 to-zinc-200/80 p-3 shadow-[0_16px_38px_rgba(15,23,42,0.16)] dark:border-zinc-700/70 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
                <div className="relative overflow-hidden rounded-2xl border border-white/50 bg-zinc-100 shadow-inner dark:border-zinc-700/60 dark:bg-zinc-800">
                  <Image
                    src={msg.ocrPreview.imageUrl}
                    alt={msg.ocrPreview.fileName}
                    width={260}
                    height={144}
                    unoptimized
                    className="h-36 w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-zinc-950/45 via-zinc-900/10 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 text-[10px] font-semibold tracking-wide text-white/95 truncate">
                    {msg.ocrPreview.fileName}
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-[11px] text-zinc-700 shadow-sm backdrop-blur-sm dark:border-zinc-700/70 dark:bg-zinc-900/70 dark:text-zinc-300">
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Document preview</p>
                  <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">Image captured and queued for secure verification.</p>
                </div>
              </div>
            ) : (
              <div className={`flex max-w-[88%] items-end gap-2 sm:max-w-[82%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[11px] font-bold ${msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
                    }`}
                >
                  {msg.role === 'user' ? 'You' : 'AI'}
                </div>
                <div
                  className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                    ? 'rounded-tr-none bg-indigo-600 text-white shadow-indigo-600/25'
                    : isDark
                      ? 'rounded-tl-none border border-zinc-800/80 bg-zinc-900/90 text-zinc-200 backdrop-blur-sm'
                      : 'rounded-tl-none border border-zinc-200/80 bg-white/90 text-zinc-800 backdrop-blur-sm'
                    }`}
                >
                  <div className="max-w-none whitespace-pre-wrap">
                  <ReactMarkdown
                    components={{
                      a: ({ ...props }) => {
                        const href = props.href || '';
                        const fullHref = normalizePdfHref(href);

                        return (
                          <a
                            {...props}
                            href={fullHref}
                            className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="mx-auto flex w-full max-w-4xl justify-start animate-in fade-in duration-200">
            <div className="flex max-w-[88%] items-end gap-2 sm:max-w-[82%]">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[11px] font-bold ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
              }`}>
                AI
              </div>
              <div className={`rounded-2xl rounded-tl-none border px-5 py-3.5 shadow-sm backdrop-blur-sm ${
                isDark ? 'border-zinc-800/80 bg-zinc-900/90' : 'border-zinc-200/80 bg-white/90'
              }`}>
                <div className={`mb-2 h-2 w-28 animate-pulse rounded-full ${isDark ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                <div className={`mb-2 h-2 w-44 animate-pulse rounded-full [animation-delay:120ms] ${isDark ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                <div className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s] ${isDark ? 'bg-zinc-600' : 'bg-zinc-400'}`} />
                  <div className={`h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s] ${isDark ? 'bg-zinc-600' : 'bg-zinc-400'}`} />
                  <div className={`h-1.5 w-1.5 animate-bounce rounded-full ${isDark ? 'bg-zinc-600' : 'bg-zinc-400'}`} />
                  <span className={`ml-1 text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Crafting a response...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={`relative z-10 border-t p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] backdrop-blur-xl sm:p-6 ${
        isDark ? 'border-zinc-800 bg-zinc-900/90' : 'border-zinc-200 bg-white/90'
      }`}>
        <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-2 sm:gap-3">
          <div className="flex w-full items-center gap-2 sm:gap-3">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileUpload}
          />
          <button
            className={`flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-xl text-zinc-500 transition-all sm:h-auto sm:w-auto sm:rounded-2xl sm:p-4 ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
            }`}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            title="Upload Document (ID or Salary Slip)"
          >
            {uploading ? <Loader2 className="animate-spin" size={20} /> : <div className="flex items-center gap-1"><ImagePlus size={20} /><span className="hidden text-[10px] font-bold sm:inline">UPLOAD DOC</span></div>}
          </button>
          <input
            className={`min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm transition-all placeholder-zinc-400 focus:ring-2 focus:ring-indigo-500/20 sm:rounded-2xl sm:px-5 sm:py-4 ${
              isDark
                ? 'border-zinc-700/80 bg-zinc-800 text-zinc-100 placeholder-zinc-600'
                : 'border-zinc-200/80 bg-zinc-50 text-zinc-900'
            }`}
            placeholder="Ask anything about your loan journey..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            className={`h-11 shrink-0 rounded-xl px-3 text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:h-auto sm:rounded-2xl sm:px-6 sm:py-2 ${loading
              ? isDark
                ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-600/20'
              }`}
            onClick={() => sendMessage()}
            disabled={loading}
          >
            <Send size={16} className="sm:hidden" />
            <span className="hidden sm:inline">Send</span>
          </button>
          </div>
          <div className={`flex flex-wrap items-center gap-2 text-[11px] ${
            isDark ? 'text-zinc-400' : 'text-zinc-500'
          }`}>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-[0_0_12px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/30 motion-safe:animate-pulse ${
              isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
            }`}>
              Demo data
            </span>
            <a
              href={`${demoDownloadBase}/aadhaar.png`}
              className="text-indigo-500 hover:text-indigo-400 underline"
              download
            >
              Aadhaar
            </a>
            <span className={isDark ? 'text-zinc-600' : 'text-zinc-300'}>|</span>
            <a
              href={`${demoDownloadBase}/pan.png`}
              className="text-indigo-500 hover:text-indigo-400 underline"
              download
            >
              PAN
            </a>
            <span className={isDark ? 'text-zinc-600' : 'text-zinc-300'}>|</span>
            <a
              href={`${demoDownloadBase}/salary.png`}
              className="text-indigo-500 hover:text-indigo-400 underline"
              download
            >
              Salary slip
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
