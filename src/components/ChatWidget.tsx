'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTimeout?: boolean;
}

// ---------------------------------------------------------------------------
// Rate Limit Constants
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_COOLDOWN_S = 60;

// ---------------------------------------------------------------------------
// Session Storage Keys
// ---------------------------------------------------------------------------

const SESSION_ID_KEY = 'la_la_sweett_chat_session';
const MESSAGES_KEY = 'la_la_sweett_chat_messages';

// ---------------------------------------------------------------------------
// Session ID helper
// ---------------------------------------------------------------------------

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

// ---------------------------------------------------------------------------
// Session message persistence helpers
// ---------------------------------------------------------------------------

function loadMessagesFromSession(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = sessionStorage.getItem(MESSAGES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return parsed.map((msg: ChatMessage & { timestamp: string }) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch {
    return [];
  }
}

function saveMessagesToSession(messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  } catch {
    // sessionStorage quota exceeded or unavailable — silently ignore
  }
}

// ---------------------------------------------------------------------------
// ChatWidget Component
// ---------------------------------------------------------------------------

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const messageTimestamps = useRef<number[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cooldownInterval = useRef<NodeJS.Timeout | null>(null);

  const sessionId = useRef<string>('');

  useEffect(() => {
    sessionId.current = getOrCreateSessionId();
    const restoredMessages = loadMessagesFromSession();
    if (restoredMessages.length > 0) {
      setMessages(restoredMessages);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      saveMessagesToSession(messages);
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isRateLimited) {
      inputRef.current?.focus();
    }
  }, [isOpen, isRateLimited]);

  useEffect(() => {
    return () => {
      if (cooldownInterval.current) {
        clearInterval(cooldownInterval.current);
      }
    };
  }, []);

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    messageTimestamps.current = messageTimestamps.current.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );
    return messageTimestamps.current.length >= RATE_LIMIT_MAX;
  }, []);

  const startCooldown = useCallback(() => {
    setIsRateLimited(true);
    setCooldownSeconds(RATE_LIMIT_COOLDOWN_S);

    cooldownInterval.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          setIsRateLimited(false);
          if (cooldownInterval.current) {
            clearInterval(cooldownInterval.current);
            cooldownInterval.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading || isRateLimited) return;

    if (checkRateLimit()) {
      startCooldown();
      return;
    }

    messageTimestamps.current.push(Date.now());

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId.current,
          message: trimmedInput,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content: data.content || 'Sorry, I could not process your message.',
          timestamp: new Date(),
          isTimeout: data.timeout === true,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else if (response.status === 429) {
        startCooldown();
      } else {
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content:
            'I apologize, but I am temporarily unavailable. Please try again in a moment or use our order inquiry form.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch {
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content:
          'I apologize, but I am temporarily unavailable. Please try again in a moment or use our order inquiry form.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, isRateLimited, checkRateLimit, startCooldown]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleChat = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {/* Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Chat with La La Sweett"
          aria-modal="false"
          className="flex h-[500px] w-full flex-col overflow-hidden rounded-2xl border border-brand-rose/20 bg-white shadow-2xl sm:w-[380px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-brand-rose/10 bg-brand-cream/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full bg-green-500"
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold text-brand-brown">
                La La Sweett Assistant
              </h2>
            </div>
            <button
              onClick={toggleChat}
              aria-label="Close chat"
              className="rounded-full p-1 text-brand-taupe transition-colors hover:bg-brand-rose/10 hover:text-brand-rose"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages area */}
          <div
            className="flex-1 overflow-y-auto bg-white px-4 py-3"
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-center">
                <p className="text-sm text-brand-taupe">
                  Hi! I&apos;m the La La Sweett assistant. Ask me about our
                  cakes, pricing, flavors, or place an order!
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-brand-rose text-white'
                      : 'border border-brand-blush bg-brand-blush/30 text-brand-espresso'
                  }`}
                >
                  {msg.isTimeout ? (
                    <span>
                      Our assistant is temporarily unavailable. Please submit
                      your inquiry through our{' '}
                      <Link
                        href="/order"
                        className="font-semibold text-brand-rose underline hover:text-brand-rose/80"
                      >
                        order form
                      </Link>{' '}
                      and we will get back to you shortly!
                    </span>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="mb-3 flex justify-start">
                <div className="rounded-xl border border-brand-blush bg-brand-blush/30 px-3 py-2 text-sm text-brand-taupe">
                  <span className="inline-flex gap-1" aria-label="Typing">
                    <span className="animate-bounce">·</span>
                    <span className="animate-bounce [animation-delay:0.1s]">
                      ·
                    </span>
                    <span className="animate-bounce [animation-delay:0.2s]">
                      ·
                    </span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Rate limit notice */}
          {isRateLimited && (
            <div
              className="border-t border-brand-rose/10 bg-brand-cream/60 px-4 py-2 text-center text-xs text-brand-rose"
              role="alert"
              aria-live="assertive"
            >
              Rate limit reached. You can send messages again in{' '}
              <span className="font-bold">{cooldownSeconds}s</span>
            </div>
          )}

          {/* Input area */}
          <div className="border-t border-brand-rose/10 bg-brand-cream/60 p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isRateLimited || isLoading}
                placeholder={
                  isRateLimited
                    ? `Please wait ${cooldownSeconds}s...`
                    : 'Type your message...'
                }
                aria-label="Chat message input"
                className="min-h-[44px] flex-1 rounded-xl border border-brand-rose/20 bg-white px-3 py-2 text-sm text-brand-espresso placeholder-brand-taupe/60 outline-none transition-colors focus:border-brand-rose disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={
                  isRateLimited || isLoading || input.trim().length === 0
                }
                aria-label="Send message"
                className="flex h-[44px] w-[44px] items-center justify-center rounded-xl bg-brand-rose text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 19V5m0 0l-7 7m7-7l7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={toggleChat}
        aria-label={isOpen ? 'Close chat' : 'Open chat assistant'}
        aria-expanded={isOpen}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-rose text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        {isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
