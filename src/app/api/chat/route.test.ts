// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the message router
vi.mock('@/services/message-router', () => {
  const mockHandleInbound = vi.fn();
  return {
    messageRouter: {
      handleInbound: mockHandleInbound,
    },
    ChatWidgetRawMessage: {},
  };
});

// Import the mocked module to control behavior in tests
import { messageRouter } from '@/services/message-router';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns fallback message when AI times out after 10 seconds', async () => {
    vi.useFakeTimers();

    // Simulate a slow AI response that never resolves within the timeout
    const mockHandleInbound = vi.mocked(messageRouter.handleInbound);
    mockHandleInbound.mockImplementation(
      () =>
        new Promise((resolve) => {
          // Never resolves within the 10s timeout
          setTimeout(() => resolve({ channel: 'chat_widget', recipientId: 'test', content: 'late response' }), 60_000);
        })
    );

    const request = createRequest({
      sessionId: 'session_timeout_test',
      message: 'Hello',
    });

    const responsePromise = POST(request);

    // Advance time past the 10-second timeout
    await vi.advanceTimersByTimeAsync(10_001);

    const response = await responsePromise;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.timeout).toBe(true);
    expect(data.content).toContain('temporarily unavailable');
    expect(data.content).toContain('order form');
  });

  it('returns normal response when AI responds within timeout', async () => {
    const mockHandleInbound = vi.mocked(messageRouter.handleInbound);
    mockHandleInbound.mockResolvedValue({
      channel: 'chat_widget',
      recipientId: 'test_user',
      content: 'Hello! How can I help you today?',
    });

    const request = createRequest({
      sessionId: 'session_fast_test',
      message: 'Hello',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content).toBe('Hello! How can I help you today?');
    expect(data.timeout).toBeUndefined();
  });

  it('returns fallback when message router returns null (no AI connected)', async () => {
    const mockHandleInbound = vi.mocked(messageRouter.handleInbound);
    mockHandleInbound.mockResolvedValue(null);

    const request = createRequest({
      sessionId: 'session_no_ai',
      message: 'Hello',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content).toContain('assistant is currently being set up');
    expect(data.content).toContain('order form');
  });

  it('returns 400 when sessionId is missing', async () => {
    const request = createRequest({ message: 'Hello' });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when message is empty', async () => {
    const request = createRequest({
      sessionId: 'test_session',
      message: '',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const mockHandleInbound = vi.mocked(messageRouter.handleInbound);
    mockHandleInbound.mockResolvedValue({
      channel: 'chat_widget',
      recipientId: 'test',
      content: 'response',
    });

    const sessionId = 'session_rate_limit_test_' + Date.now();

    // Send 10 messages to fill up the rate limit
    for (let i = 0; i < 10; i++) {
      const req = createRequest({ sessionId, message: `msg ${i}` });
      await POST(req);
    }

    // 11th message should be rate limited
    const request = createRequest({ sessionId, message: 'one more' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error.code).toBe('RATE_LIMITED');
  });
});
