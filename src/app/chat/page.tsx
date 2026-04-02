'use client';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { useState, useEffect, useRef } from 'react';
import { LogOut, User as UserIcon, ImagePlus, Loader2 } from 'lucide-react';
import { clearAuthMeCache, getAuthMe, type AuthMeUser } from '@/lib/client-auth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ocrPreview?: OCRPreview;
}

interface OCRPreview {
  fileName: string;
  imageUrl: string;
  fields: Array<{ label: string; value: string }>;
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

function parseExtractedFields(text: string): Array<{ label: string; value: string }> {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = lines
    .map((line) => {
      const match = line.match(/^[-*•\d.)\s]*(.+?)\s*:\s*(.+)$/);
      if (!match) return null;
      return { label: match[1].trim(), value: match[2].trim() };
    })
    .filter((item): item is { label: string; value: string } => Boolean(item));

  return parsed.slice(0, 6);
}

export default function Home() {
  const [user, setUser] = useState<AuthMeUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<'sales' | 'kyc' | 'credit' | 'loan_selection' | 'docs' | 'done'>('sales');
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  const createMessageId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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

    if (!overrideMessage) setInput('');
    if (!options?.hideUserEcho) {
      setMessages((prev) => [...prev, { id: createMessageId(), role: 'user', content: userMessage }]);
    }
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMessage }),
      });

      const data = await response.json();
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
      setMessages((prev) => [...prev, { id: createMessageId(), role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
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
              fields: parseExtractedFields(data.text),
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

  if (authChecking) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-indigo-500/20">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Loan Assistant</h1>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <UserIcon size={12} />
                <span>{user.name}</span>
              </div>
            </div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 capitalize flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${stage === 'done' ? 'bg-green-500' : stage === 'kyc' || stage === 'credit' ? 'bg-amber-500' : 'bg-indigo-500'} animate-pulse`} />
              Stage: {stage}
              {pdfPath && (
                <a
                  href={pdfPath.startsWith('/pdfs/') ? `${typeof window !== 'undefined' ? window.location.origin : ''}${pdfPath}` : pdfPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-indigo-400 hover:text-indigo-300 underline"
                >
                  View PDF
                </a>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[10px] font-mono text-zinc-500 dark:text-zinc-500">
            ID: {sessionId}
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Chat History */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-3xl mb-2 shadow-inner">👋</div>
            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">Hello {(user.name || 'User').split(' ')[0]}!</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
              I&apos;m your Loan Assistant. I can help you check your loan eligibility in minutes. Let&apos;s start with your basic details.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            {msg.ocrPreview ? (
              <div className="w-64 rounded-2xl border border-zinc-200/80 bg-white/90 p-2 shadow-md shrink-0">
                <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                  <Image
                    src={msg.ocrPreview.imageUrl}
                    alt={msg.ocrPreview.fileName}
                    width={256}
                    height={96}
                    unoptimized
                    className="h-24 w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-zinc-900/35 via-zinc-900/10 to-transparent" />
                  <div className="absolute bottom-1 left-2 right-2 text-[10px] font-medium text-white truncate">
                    {msg.ocrPreview.fileName}
                  </div>
                </div>
                <div className="mt-2 max-h-24 overflow-y-auto space-y-1.5 rounded-lg bg-zinc-50 p-2">
                  {msg.ocrPreview.fields.length > 0 ? (
                    msg.ocrPreview.fields.map((field, idx) => (
                      <div key={`${field.label}-${idx}`} className="grid grid-cols-[80px_1fr] gap-2 text-[11px] leading-snug text-zinc-700">
                        <span className="font-semibold text-zinc-500 truncate">{field.label}</span>
                        <span className="text-zinc-800 wrap-break-word">{field.value}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-zinc-500">Document captured and sent for verification.</p>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`max-w-[85%] px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-tl-none'
                  }`}
              >
                <div className="whitespace-pre-wrap max-w-none">
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
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-5 py-3.5 rounded-2xl rounded-tl-none shadow-sm flex gap-1.5 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce" />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
        <div className="max-w-4xl mx-auto flex gap-3 relative">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileUpload}
          />
          <button
            className="p-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            title="Upload Document (ID or Salary Slip)"
          >
            {uploading ? <Loader2 className="animate-spin" size={20} /> : <div className="flex items-center gap-1"><ImagePlus size={20} /><span className="text-[10px] font-bold">UPLOAD DOC</span></div>}
          </button>
          <input
            className="flex-1 px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 text-sm transition-all"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            className={`px-6 py-2 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${loading
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-600/20'
              }`}
            onClick={() => sendMessage()}
            disabled={loading}
          >
            Send
          </button>
        </div>

      </div>
    </div>
  );
}