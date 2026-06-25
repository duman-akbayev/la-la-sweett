import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatWidget } from './ChatWidget';

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: (key: string) => mockSessionStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockSessionStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockSessionStorage[key];
    },
    clear: () => {
      Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
    },
  },
  writable: true,
});

describe('ChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the floating toggle button', () => {
    render(<ChatWidget />);
    const button = screen.getByRole('button', { name: /open chat assistant/i });
    expect(button).toBeInTheDocument();
  });

  it('opens the chat panel when toggle button is clicked', () => {
    render(<ChatWidget />);
    const button = screen.getByRole('button', { name: /open chat assistant/i });
    fireEvent.click(button);

    expect(screen.getByRole('dialog', { name: /chat with la la sweett/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/chat message input/i)).toBeInTheDocument();
  });

  it('closes the chat panel when close button is clicked', () => {
    render(<ChatWidget />);
    // Open
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Close via header close button (first "Close chat" button in DOM)
    const closeButtons = screen.getAllByRole('button', { name: /close chat/i });
    fireEvent.click(closeButtons[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the welcome message when chat is opened with no messages', () => {
    render(<ChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));

    expect(screen.getByRole('heading', { name: /la la sweett assistant/i })).toBeInTheDocument();
    expect(screen.getByText(/ask me about our cakes/i)).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    render(<ChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));

    const sendButton = screen.getByRole('button', { name: /send message/i });
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when input has text', () => {
    render(<ChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));

    const input = screen.getByLabelText(/chat message input/i);
    fireEvent.change(input, { target: { value: 'Hello' } });

    const sendButton = screen.getByRole('button', { name: /send message/i });
    expect(sendButton).not.toBeDisabled();
  });

  it('sends a message and displays it in the chat', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: 'Hi! How can I help?', timestamp: new Date().toISOString() }),
    });

    render(<ChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));

    const input = screen.getByLabelText(/chat message input/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    // User message should appear
    expect(screen.getByText('Hello')).toBeInTheDocument();

    // Wait for assistant response
    await waitFor(() => {
      expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument();
    });
  });

  it('shows error message when API call fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<ChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));

    const input = screen.getByLabelText(/chat message input/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
    });
  });

  it('enforces rate limit after 10 messages', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: 'Response', timestamp: new Date().toISOString() }),
    });

    render(<ChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));

    const input = screen.getByLabelText(/chat message input/i);

    // Send 10 messages quickly
    for (let i = 0; i < 10; i++) {
      fireEvent.change(input, { target: { value: `Message ${i}` } });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));
      // Wait for each response to complete before sending next
      await waitFor(() => {
        expect(screen.queryByText(/·/)).not.toBeInTheDocument();
      });
    }

    // 11th message should trigger rate limit
    fireEvent.change(input, { target: { value: 'One more' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/rate limit reached/i)).toBeInTheDocument();
    });
  });

  it('handles 429 response from server', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({
          error: { code: 'RATE_LIMITED', message: 'Too many messages', retryAfter: 60 },
        }),
    });

    render(<ChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));

    const input = screen.getByLabelText(/chat message input/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('has proper ARIA attributes for accessibility', () => {
    render(<ChatWidget />);

    // Toggle button has aria-expanded
    const toggleButton = screen.getByRole('button', { name: /open chat assistant/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    // Open the chat
    fireEvent.click(toggleButton);

    // Dialog role present
    expect(screen.getByRole('dialog', { name: /chat with la la sweett/i })).toBeInTheDocument();

    // Message log area
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('displays timeout fallback message with order form link when AI times out', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: 'Our assistant is temporarily unavailable. Please submit your inquiry through our [order form](/order) and we will get back to you shortly!',
          timestamp: new Date().toISOString(),
          timeout: true,
        }),
    });

    render(<ChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));

    const input = screen.getByLabelText(/chat message input/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /order form/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /order form/i })).toHaveAttribute('href', '/order');
    });
  });

  it('persists messages to sessionStorage', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: 'Hi there!', timestamp: new Date().toISOString() }),
    });

    render(<ChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));

    const input = screen.getByLabelText(/chat message input/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });

    // Check sessionStorage has messages
    const stored = mockSessionStorage['la_la_sweett_chat_messages'];
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored);
    expect(parsed.length).toBe(2); // user message + assistant response
    expect(parsed[0].role).toBe('user');
    expect(parsed[0].content).toBe('Hello');
    expect(parsed[1].role).toBe('assistant');
    expect(parsed[1].content).toBe('Hi there!');
  });

  it('restores messages from sessionStorage on mount', () => {
    const existingMessages = [
      {
        id: 'msg_123',
        role: 'user',
        content: 'Previous message',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg_456',
        role: 'assistant',
        content: 'Previous response',
        timestamp: new Date().toISOString(),
      },
    ];
    mockSessionStorage['la_la_sweett_chat_messages'] = JSON.stringify(existingMessages);

    render(<ChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));

    expect(screen.getByText('Previous message')).toBeInTheDocument();
    expect(screen.getByText('Previous response')).toBeInTheDocument();
  });
});
