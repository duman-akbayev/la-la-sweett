/**
 * Unit tests for Notification Service.
 *
 * Tests cover:
 * - notifyOwner: Telegram delivery, queueing on failure, email fallback
 * - notifyCustomer: Channel dispatch
 * - queueNotification: Redis queue with max 1000 items
 * - processQueue: FIFO delivery on reconnection
 * - sendDailySummary: Summary formatting and delivery
 * - Email fallback on overflow or 24h outage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notificationService } from "./notification.service";
import * as queueModule from "../lib/queue";
import * as redisModule from "../lib/redis";
import { circuitBreakers } from "../lib/circuit-breaker";
import type { OwnerNotification, CustomerNotification } from "../types";

// Mock Redis
vi.mock("../lib/redis", () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    llen: vi.fn(),
    rpush: vi.fn(),
    lpop: vi.fn(),
    lpush: vi.fn(),
    lrange: vi.fn(),
    lindex: vi.fn(),
  };
  return {
    getRedisClient: vi.fn(() => mockRedis),
    REDIS_KEYS: { NOTIFICATION_QUEUE: "notifications:queue", SESSION: "session:", RATE_LIMIT: "ratelimit:" },
    resetRedisClient: vi.fn(),
    disconnectRedis: vi.fn(),
    getRedisConfig: vi.fn(),
  };
});

// Mock queue module
vi.mock("../lib/queue", () => ({
  pushToQueue: vi.fn(),
  popFromQueue: vi.fn(),
  getQueueLength: vi.fn(),
  getAllFromQueue: vi.fn(),
  clearQueue: vi.fn(),
  peekQueue: vi.fn(),
  MAX_QUEUE_SIZE: 1000,
}));

// Mock circuit breaker - make execute call the function directly by default
vi.mock("../lib/circuit-breaker", () => {
  const CircuitBreakerOpenError = class extends Error {
    breakerName: string;
    constructor(name: string) {
      super(`Circuit breaker "${name}" is open — request blocked`);
      this.name = "CircuitBreakerOpenError";
      this.breakerName = name;
    }
  };

  return {
    CircuitBreakerOpenError,
    circuitBreakers: {
      telegram: {
        execute: vi.fn((fn: () => Promise<unknown>) => fn()),
        getState: vi.fn(() => "closed"),
        reset: vi.fn(),
      },
      whatsapp: { execute: vi.fn((fn: () => Promise<unknown>) => fn()) },
      instagram: { execute: vi.fn((fn: () => Promise<unknown>) => fn()) },
      claude: { execute: vi.fn((fn: () => Promise<unknown>) => fn()) },
    },
  };
});

// Mock retry
vi.mock("../lib/retry", () => ({
  retryExternalCall: vi.fn((_api: string, fn: () => Promise<unknown>) => fn()),
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
  calculateDelay: vi.fn((attempt: number) => 1000 * Math.pow(2, attempt)),
  onRetryExhausted: vi.fn(() => () => {}),
  clearAlertListeners: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock crypto.randomUUID
vi.mock("crypto", () => ({
  default: { randomUUID: vi.fn(() => "test-uuid-123") },
  randomUUID: vi.fn(() => "test-uuid-123"),
}));

describe("NotificationService", () => {
  let mockEmailTransport: ReturnType<typeof vi.fn>;
  let mockCustomerTransport: ReturnType<typeof vi.fn>;
  const mockRedis = redisModule.getRedisClient() as unknown as {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    lpush: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set environment
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_OWNER_CHAT_ID = "12345";
    process.env.OWNER_EMAIL = "owner@lalasweett.com";

    // Set up transports
    mockEmailTransport = vi.fn().mockResolvedValue(undefined);
    mockCustomerTransport = vi.fn().mockResolvedValue(undefined);
    notificationService.setEmailTransport(mockEmailTransport);
    notificationService.setCustomerTransport(mockCustomerTransport);

    // Default mock behaviors
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.del.mockResolvedValue(1);
    mockRedis.lpush.mockResolvedValue(1);

    vi.mocked(queueModule.getQueueLength).mockResolvedValue(0);
    vi.mocked(queueModule.pushToQueue).mockResolvedValue({
      success: true,
      queueLength: 1,
      overflow: false,
    });
    vi.mocked(queueModule.popFromQueue).mockResolvedValue(null);
    vi.mocked(queueModule.getAllFromQueue).mockResolvedValue([]);
    vi.mocked(queueModule.clearQueue).mockResolvedValue(undefined);

    // Mock fetch for Telegram API
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: {} }),
      text: async () => "OK",
    });
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_OWNER_CHAT_ID;
    delete process.env.OWNER_EMAIL;
  });

  describe("notifyOwner", () => {
    const sampleNotification: OwnerNotification = {
      type: "new_order",
      content: "New order from John Doe: Wedding Cake, 100 servings",
      priority: "high",
    };

    it("should send notification via Telegram when available", async () => {
      await notificationService.notifyOwner(sampleNotification);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.telegram.org/bottest-token/sendMessage",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );

      const callBody = JSON.parse(
        mockFetch.mock.calls[0][1].body as string,
      );
      expect(callBody.chat_id).toBe("12345");
      expect(callBody.text).toBe(sampleNotification.content);
      expect(callBody.parse_mode).toBe("HTML");
    });

    it("should include inline buttons when actions are provided", async () => {
      const notificationWithActions: OwnerNotification = {
        ...sampleNotification,
        actions: [
          { text: "Approve", callbackData: "approve_order_123" },
          { text: "Reject", callbackData: "reject_order_123" },
        ],
      };

      await notificationService.notifyOwner(notificationWithActions);

      const callBody = JSON.parse(
        mockFetch.mock.calls[0][1].body as string,
      );
      expect(callBody.reply_markup).toBeDefined();
      expect(callBody.reply_markup.inline_keyboard).toHaveLength(2);
      expect(callBody.reply_markup.inline_keyboard[0][0].text).toBe("Approve");
    });

    it("should queue notification when Telegram delivery fails", async () => {
      vi.mocked(circuitBreakers.telegram.execute).mockRejectedValueOnce(
        new Error("Telegram API unavailable"),
      );

      await notificationService.notifyOwner(sampleNotification);

      // Should record outage
      expect(mockRedis.set).toHaveBeenCalled();
      // Should push to queue
      expect(queueModule.pushToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "new_order",
          content: sampleNotification.content,
          priority: "high",
        }),
      );
    });

    it("should trigger email fallback when queue overflows", async () => {
      vi.mocked(circuitBreakers.telegram.execute).mockRejectedValueOnce(
        new Error("Telegram down"),
      );
      vi.mocked(queueModule.getQueueLength).mockResolvedValue(1000);

      await notificationService.notifyOwner(sampleNotification);

      expect(mockEmailTransport).toHaveBeenCalledWith(
        "owner@lalasweett.com",
        "La La Sweett: Telegram Notification Fallback",
        expect.stringContaining("Telegram notification delivery failed"),
      );
    });

    it("should trigger email fallback when outage exceeds 24 hours", async () => {
      vi.mocked(circuitBreakers.telegram.execute).mockRejectedValueOnce(
        new Error("Telegram down"),
      );
      // Simulate outage started 25 hours ago
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
      mockRedis.get.mockResolvedValue(twentyFiveHoursAgo.toString());

      await notificationService.notifyOwner(sampleNotification);

      expect(mockEmailTransport).toHaveBeenCalledWith(
        "owner@lalasweett.com",
        "La La Sweett: Telegram Notification Fallback",
        expect.stringContaining("Telegram notification delivery failed"),
      );
    });

    it("should clear outage record on successful delivery", async () => {
      await notificationService.notifyOwner(sampleNotification);

      expect(mockRedis.del).toHaveBeenCalledWith("telegram:outage_start");
    });
  });

  describe("notifyCustomer", () => {
    const sampleCustomerNotification: CustomerNotification = {
      customerId: "customer-123",
      channel: "whatsapp",
      content: "Your order has been confirmed!",
    };

    it("should send notification via the customer's originating channel", async () => {
      await notificationService.notifyCustomer(sampleCustomerNotification);

      expect(mockCustomerTransport).toHaveBeenCalledWith(
        "whatsapp",
        "customer-123",
        "Your order has been confirmed!",
      );
    });

    it("should handle different channels", async () => {
      const igNotification: CustomerNotification = {
        customerId: "customer-456",
        channel: "instagram",
        content: "Thanks for your inquiry!",
      };

      await notificationService.notifyCustomer(igNotification);

      expect(mockCustomerTransport).toHaveBeenCalledWith(
        "instagram",
        "customer-456",
        "Thanks for your inquiry!",
      );
    });
  });

  describe("queueNotification", () => {
    const sampleNotification: OwnerNotification = {
      type: "escalation",
      content: "Customer needs custom 3D sculpted cake",
      priority: "high",
    };

    it("should add notification to Redis queue", async () => {
      await notificationService.queueNotification(sampleNotification);

      expect(queueModule.pushToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-uuid-123",
          type: "escalation",
          content: sampleNotification.content,
          priority: "high",
        }),
      );
    });

    it("should trigger email fallback on overflow", async () => {
      vi.mocked(queueModule.pushToQueue).mockResolvedValue({
        success: false,
        queueLength: 1000,
        overflow: true,
      });

      await notificationService.queueNotification(sampleNotification);

      expect(mockEmailTransport).toHaveBeenCalledWith(
        "owner@lalasweett.com",
        "La La Sweett: Telegram Notification Fallback",
        expect.stringContaining("Telegram notification delivery failed"),
      );
    });
  });

  describe("processQueue", () => {
    it("should process notifications in FIFO order", async () => {
      const queuedItems: queueModule.QueuedNotification[] = [
        {
          id: "1",
          type: "new_order",
          content: "First notification",
          priority: "high",
          createdAt: "2024-01-01T10:00:00Z",
        },
        {
          id: "2",
          type: "escalation",
          content: "Second notification",
          priority: "normal",
          createdAt: "2024-01-01T10:01:00Z",
        },
        {
          id: "3",
          type: "unresponded_alert",
          content: "Third notification",
          priority: "normal",
          createdAt: "2024-01-01T10:02:00Z",
        },
      ];

      let callIndex = 0;
      vi.mocked(queueModule.popFromQueue).mockImplementation(async () => {
        if (callIndex < queuedItems.length) {
          return queuedItems[callIndex++];
        }
        return null;
      });

      await notificationService.processQueue();

      // Should have sent 3 Telegram messages
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify FIFO order
      const firstCall = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(firstCall.text).toBe("First notification");

      const secondCall = JSON.parse(mockFetch.mock.calls[1][1].body as string);
      expect(secondCall.text).toBe("Second notification");

      const thirdCall = JSON.parse(mockFetch.mock.calls[2][1].body as string);
      expect(thirdCall.text).toBe("Third notification");
    });

    it("should stop processing and re-queue on failure", async () => {
      const queuedItems: queueModule.QueuedNotification[] = [
        {
          id: "1",
          type: "new_order",
          content: "First notification",
          priority: "high",
          createdAt: "2024-01-01T10:00:00Z",
        },
        {
          id: "2",
          type: "escalation",
          content: "Second notification",
          priority: "normal",
          createdAt: "2024-01-01T10:01:00Z",
        },
      ];

      let callIndex = 0;
      vi.mocked(queueModule.popFromQueue).mockImplementation(async () => {
        if (callIndex < queuedItems.length) {
          return queuedItems[callIndex++];
        }
        return null;
      });

      // First succeeds, second fails
      vi.mocked(circuitBreakers.telegram.execute)
        .mockImplementationOnce((fn) => fn())
        .mockRejectedValueOnce(new Error("Telegram down again"));

      await notificationService.processQueue();

      // First notification sent successfully
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second notification re-queued at front
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        "notifications:queue",
        JSON.stringify(queuedItems[1]),
      );
    });

    it("should clear outage record when queue is fully processed", async () => {
      vi.mocked(queueModule.popFromQueue).mockResolvedValue(null);

      await notificationService.processQueue();

      expect(mockRedis.del).toHaveBeenCalledWith("telegram:outage_start");
    });
  });

  describe("sendDailySummary", () => {
    it("should format and send daily summary", async () => {
      notificationService.setDailySummaryProvider(async () => ({
        date: new Date("2024-06-15"),
        totalInquiries: 12,
        ordersReceived: 3,
        estimatedRevenue: 1450.0,
        topCakeTypes: [
          { type: "Wedding Cake", count: 5 },
          { type: "Birthday Cake", count: 4 },
          { type: "Cupcakes", count: 3 },
        ],
      }));

      await notificationService.sendDailySummary();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.text).toContain("Daily Summary");
      expect(callBody.text).toContain("Inquiries: 12");
      expect(callBody.text).toContain("Orders: 3");
      expect(callBody.text).toContain("$1450.00");
      expect(callBody.text).toContain("Wedding Cake");
      expect(callBody.text).toContain("Birthday Cake");
      expect(callBody.text).toContain("Cupcakes");
    });

    it("should send empty summary when no provider is configured", async () => {
      notificationService.setDailySummaryProvider(null as unknown as () => Promise<import("../types").DailySummary>);
      // Reset to null through internal property
      (notificationService as unknown as { _dailySummaryProvider: null })._dailySummaryProvider = null;

      await notificationService.sendDailySummary();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.text).toContain("Inquiries: 0");
      expect(callBody.text).toContain("Orders: 0");
    });
  });

  describe("email fallback", () => {
    it("should include all queued notifications in email body", async () => {
      vi.mocked(circuitBreakers.telegram.execute).mockRejectedValueOnce(
        new Error("Telegram down"),
      );
      vi.mocked(queueModule.getQueueLength).mockResolvedValue(1000);
      vi.mocked(queueModule.getAllFromQueue).mockResolvedValue([
        {
          id: "q1",
          type: "new_order",
          content: "Order from Alice",
          priority: "high",
          createdAt: "2024-01-01T10:00:00Z",
        },
        {
          id: "q2",
          type: "escalation",
          content: "Escalation from Bob",
          priority: "normal",
          createdAt: "2024-01-01T11:00:00Z",
        },
      ]);

      const notification: OwnerNotification = {
        type: "new_order",
        content: "Latest order from Charlie",
        priority: "high",
      };

      await notificationService.notifyOwner(notification);

      expect(mockEmailTransport).toHaveBeenCalledWith(
        "owner@lalasweett.com",
        "La La Sweett: Telegram Notification Fallback",
        expect.stringContaining("Order from Alice"),
      );
      expect(mockEmailTransport).toHaveBeenCalledWith(
        "owner@lalasweett.com",
        expect.any(String),
        expect.stringContaining("Escalation from Bob"),
      );
      expect(mockEmailTransport).toHaveBeenCalledWith(
        "owner@lalasweett.com",
        expect.any(String),
        expect.stringContaining("Latest order from Charlie"),
      );
    });

    it("should clear queue after sending email fallback", async () => {
      vi.mocked(circuitBreakers.telegram.execute).mockRejectedValueOnce(
        new Error("Telegram down"),
      );
      vi.mocked(queueModule.getQueueLength).mockResolvedValue(1000);

      await notificationService.notifyOwner({
        type: "new_order",
        content: "Test",
        priority: "normal",
      });

      expect(queueModule.clearQueue).toHaveBeenCalled();
    });
  });
});
