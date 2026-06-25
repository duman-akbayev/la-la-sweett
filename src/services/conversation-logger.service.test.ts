/**
 * Unit tests for Conversation Logger Service.
 *
 * Tests cover:
 * - logMessage: logging with all required fields, retry logic, queue on failure, owner notification
 * - tagConversation: tagging with intent categories
 * - detectIntents: keyword-based intent detection
 * - getConversationLog: retrieving logged messages and intents
 * - processFailedQueue: retrying queued entries
 *
 * Requirements: 14.1, 14.3, 14.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ConversationLoggerService,
  InMemoryPersistence,
  INTENT_KEYWORDS,
  MAX_RETRIES,
  RETRY_DELAYS_MS,
} from "./conversation-logger.service";
import type {
  LogPersistenceAdapter,
  LoggedMessage,
  OwnerNotifyFn,
} from "./conversation-logger.service";
import type { Channel, IntentTag, MessageRole } from "../types";

describe("ConversationLoggerService", () => {
  let service: ConversationLoggerService;
  let persistence: InMemoryPersistence;
  let idCounter: number;

  beforeEach(() => {
    vi.useFakeTimers();
    persistence = new InMemoryPersistence();
    idCounter = 0;
    service = new ConversationLoggerService(
      persistence,
      () => `msg-${++idCounter}`,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("logMessage", () => {
    it("should log a message with all required fields", async () => {
      const result = await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content: "Hello, I want to order a cake",
        timestamp: new Date("2024-06-15T10:00:00Z"),
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-1");

      const log = await service.getConversationLog("conv-1");
      expect(log.messages).toHaveLength(1);
      expect(log.messages[0]).toEqual({
        id: "msg-1",
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content: "Hello, I want to order a cake",
        timestamp: new Date("2024-06-15T10:00:00Z"),
      });
    });

    it("should log messages from both customer and assistant roles", async () => {
      await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "chat_widget",
        role: "customer",
        content: "What flavors do you have?",
      });

      await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "chat_widget",
        role: "assistant",
        content: "We offer chocolate, vanilla, red velvet, and more!",
      });

      const log = await service.getConversationLog("conv-1");
      expect(log.messages).toHaveLength(2);
      expect(log.messages[0].role).toBe("customer");
      expect(log.messages[1].role).toBe("assistant");
    });

    it("should log messages from all supported channels", async () => {
      const channels: Channel[] = ["whatsapp", "instagram", "chat_widget"];

      for (const channel of channels) {
        await service.logMessage({
          conversationId: `conv-${channel}`,
          customerId: "cust-1",
          channel,
          role: "customer",
          content: `Message from ${channel}`,
        });
      }

      for (const channel of channels) {
        const log = await service.getConversationLog(`conv-${channel}`);
        expect(log.messages).toHaveLength(1);
        expect(log.messages[0].channel).toBe(channel);
      }
    });

    it("should use current timestamp if not provided", async () => {
      const now = new Date("2024-07-01T12:00:00Z");
      vi.setSystemTime(now);

      await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content: "Hello",
      });

      const log = await service.getConversationLog("conv-1");
      expect(log.messages[0].timestamp).toEqual(now);
    });

    it("should retry up to 3 times on failure then queue", async () => {
      const failingPersistence: LogPersistenceAdapter = {
        saveMessage: vi.fn().mockRejectedValue(new Error("DB connection lost")),
        getMessagesByConversation: vi.fn().mockResolvedValue([]),
        saveConversationIntents: vi.fn().mockResolvedValue(undefined),
        getConversationIntents: vi.fn().mockResolvedValue([]),
      };

      const failService = new ConversationLoggerService(
        failingPersistence,
        () => `msg-${++idCounter}`,
      );

      const logPromise = failService.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content: "Hello",
      });

      // Advance through all retry delays: 1s + 2s + 4s
      await vi.advanceTimersByTimeAsync(1000); // first retry delay
      await vi.advanceTimersByTimeAsync(2000); // second retry delay
      await vi.advanceTimersByTimeAsync(4000); // third retry delay

      const result = await logPromise;

      expect(result.success).toBe(false);
      expect(result.queued).toBe(true);
      expect(result.error).toBe("DB connection lost");
      // Initial attempt + 3 retries = 4 calls total
      expect(failingPersistence.saveMessage).toHaveBeenCalledTimes(4);
    });

    it("should succeed on retry if persistence recovers", async () => {
      let callCount = 0;
      const flakeyPersistence: LogPersistenceAdapter = {
        saveMessage: vi.fn().mockImplementation(async (entry: LoggedMessage) => {
          callCount++;
          if (callCount <= 2) {
            throw new Error("Transient failure");
          }
          persistence.saveMessage(entry);
        }),
        getMessagesByConversation: vi
          .fn()
          .mockImplementation((id: string) =>
            persistence.getMessagesByConversation(id),
          ),
        saveConversationIntents: vi.fn().mockResolvedValue(undefined),
        getConversationIntents: vi.fn().mockResolvedValue([]),
      };

      const retryService = new ConversationLoggerService(
        flakeyPersistence,
        () => `msg-${++idCounter}`,
      );

      const logPromise = retryService.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content: "Hello",
      });

      // Advance through retry delays
      await vi.advanceTimersByTimeAsync(1000); // first retry
      await vi.advanceTimersByTimeAsync(2000); // second retry (succeeds)

      const result = await logPromise;

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      // Failed 2 times, succeeded on 3rd attempt
      expect(flakeyPersistence.saveMessage).toHaveBeenCalledTimes(3);
    });

    it("should notify owner when all retries fail", async () => {
      const mockNotify = vi.fn().mockResolvedValue(undefined);
      const failingPersistence: LogPersistenceAdapter = {
        saveMessage: vi.fn().mockRejectedValue(new Error("DB crashed")),
        getMessagesByConversation: vi.fn().mockResolvedValue([]),
        saveConversationIntents: vi.fn().mockResolvedValue(undefined),
        getConversationIntents: vi.fn().mockResolvedValue([]),
      };

      const failService = new ConversationLoggerService(
        failingPersistence,
        () => `msg-${++idCounter}`,
      );
      failService.setOwnerNotify(mockNotify);

      const logPromise = failService.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content: "Hello",
      });

      await vi.advanceTimersByTimeAsync(7000); // 1s + 2s + 4s

      await logPromise;

      expect(mockNotify).toHaveBeenCalledWith(
        expect.stringContaining("Conversation logging failed after 3 retries"),
      );
      expect(mockNotify).toHaveBeenCalledWith(
        expect.stringContaining("conv-1"),
      );
      expect(mockNotify).toHaveBeenCalledWith(
        expect.stringContaining("cust-1"),
      );
    });

    it("should add failed entries to the queue", async () => {
      const failingPersistence: LogPersistenceAdapter = {
        saveMessage: vi.fn().mockRejectedValue(new Error("DB error")),
        getMessagesByConversation: vi.fn().mockResolvedValue([]),
        saveConversationIntents: vi.fn().mockResolvedValue(undefined),
        getConversationIntents: vi.fn().mockResolvedValue([]),
      };

      const failService = new ConversationLoggerService(
        failingPersistence,
        () => `msg-${++idCounter}`,
      );

      const logPromise = failService.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "instagram",
        role: "customer",
        content: "Hi there",
      });

      await vi.advanceTimersByTimeAsync(7000);
      await logPromise;

      const queue = failService.getFailedQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].entry.conversationId).toBe("conv-1");
      expect(queue[0].entry.channel).toBe("instagram");
      expect(queue[0].retryCount).toBe(3);
    });
  });

  describe("tagConversation", () => {
    it("should tag a conversation with intent categories", async () => {
      await service.tagConversation("conv-1", ["pricing_inquiry"]);

      const log = await service.getConversationLog("conv-1");
      expect(log.intentTags).toContain("pricing_inquiry");
    });

    it("should merge multiple intent tags without duplicates", async () => {
      await service.tagConversation("conv-1", [
        "pricing_inquiry",
        "availability_check",
      ]);
      await service.tagConversation("conv-1", [
        "pricing_inquiry",
        "custom_design_request",
      ]);

      const log = await service.getConversationLog("conv-1");
      expect(log.intentTags).toHaveLength(3);
      expect(log.intentTags).toContain("pricing_inquiry");
      expect(log.intentTags).toContain("availability_check");
      expect(log.intentTags).toContain("custom_design_request");
    });

    it("should do nothing when given an empty intents array", async () => {
      await service.tagConversation("conv-1", []);

      const log = await service.getConversationLog("conv-1");
      expect(log.intentTags).toHaveLength(0);
    });

    it("should support all valid intent categories", async () => {
      const allIntents: IntentTag[] = [
        "pricing_inquiry",
        "availability_check",
        "custom_design_request",
        "order_status",
        "general_question",
      ];

      await service.tagConversation("conv-1", allIntents);

      const log = await service.getConversationLog("conv-1");
      expect(log.intentTags).toEqual(expect.arrayContaining(allIntents));
    });
  });

  describe("detectIntents", () => {
    it("should detect pricing_inquiry from price-related keywords", () => {
      const testCases = [
        "How much does a wedding cake cost?",
        "What's the price for a 3-tier cake?",
        "Can I afford a custom cake on my budget?",
        "That seems expensive",
        "Do you have any cheap options?",
        "What's the rate for cupcakes?",
      ];

      for (const msg of testCases) {
        const intents = service.detectIntents(msg);
        expect(intents).toContain("pricing_inquiry");
      }
    });

    it("should detect availability_check from availability keywords", () => {
      const testCases = [
        "Are you available on June 15?",
        "When can I pick it up?",
        "I need it by this date",
        "Can I schedule a consultation?",
        "I'd like to book for my wedding",
        "Do you have any openings?",
      ];

      for (const msg of testCases) {
        const intents = service.detectIntents(msg);
        expect(intents).toContain("availability_check");
      }
    });

    it("should detect custom_design_request from design keywords", () => {
      const testCases = [
        "I want a custom cake",
        "Can you design a unicorn cake?",
        "I have a specific theme in mind",
        "Something special for my daughter",
        "I want something unique",
        "Can you personalize it?",
      ];

      for (const msg of testCases) {
        const intents = service.detectIntents(msg);
        expect(intents).toContain("custom_design_request");
      }
    });

    it("should detect order_status from status-related keywords", () => {
      const testCases = [
        "What's my order status?",
        "Can I get an update on my cake?",
        "Where is my order?",
        "Do you have tracking info?",
      ];

      for (const msg of testCases) {
        const intents = service.detectIntents(msg);
        expect(intents).toContain("order_status");
      }
    });

    it("should return general_question when no keywords match", () => {
      const testCases = [
        "Hello!",
        "Thank you so much",
        "That sounds wonderful",
        "I'll think about it",
      ];

      for (const msg of testCases) {
        const intents = service.detectIntents(msg);
        expect(intents).toEqual(["general_question"]);
      }
    });

    it("should detect multiple intents from a single message", () => {
      const intents = service.detectIntents(
        "How much does a custom wedding cake cost and when are you available?",
      );

      expect(intents).toContain("pricing_inquiry");
      expect(intents).toContain("custom_design_request");
      expect(intents).toContain("availability_check");
    });

    it("should be case-insensitive", () => {
      const intents = service.detectIntents(
        "WHAT IS THE PRICE FOR A CUSTOM CAKE?",
      );

      expect(intents).toContain("pricing_inquiry");
      expect(intents).toContain("custom_design_request");
    });

    it("should always return at least one intent", () => {
      const intents = service.detectIntents("");
      expect(intents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getConversationLog", () => {
    it("should return all messages for a conversation in order", async () => {
      await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content: "First message",
        timestamp: new Date("2024-06-15T10:00:00Z"),
      });

      await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "assistant",
        content: "Second message",
        timestamp: new Date("2024-06-15T10:00:05Z"),
      });

      await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content: "Third message",
        timestamp: new Date("2024-06-15T10:00:10Z"),
      });

      const log = await service.getConversationLog("conv-1");
      expect(log.conversationId).toBe("conv-1");
      expect(log.messages).toHaveLength(3);
      expect(log.messages[0].content).toBe("First message");
      expect(log.messages[1].content).toBe("Second message");
      expect(log.messages[2].content).toBe("Third message");
    });

    it("should return intent tags along with messages", async () => {
      await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content: "How much is a cake?",
      });

      await service.tagConversation("conv-1", ["pricing_inquiry"]);

      const log = await service.getConversationLog("conv-1");
      expect(log.intentTags).toContain("pricing_inquiry");
      expect(log.messages).toHaveLength(1);
    });

    it("should return empty result for non-existent conversation", async () => {
      const log = await service.getConversationLog("non-existent");
      expect(log.conversationId).toBe("non-existent");
      expect(log.messages).toHaveLength(0);
      expect(log.intentTags).toHaveLength(0);
    });

    it("should not mix messages from different conversations", async () => {
      await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content: "Message for conv-1",
      });

      await service.logMessage({
        conversationId: "conv-2",
        customerId: "cust-2",
        channel: "instagram",
        role: "customer",
        content: "Message for conv-2",
      });

      const log1 = await service.getConversationLog("conv-1");
      const log2 = await service.getConversationLog("conv-2");

      expect(log1.messages).toHaveLength(1);
      expect(log1.messages[0].content).toBe("Message for conv-1");

      expect(log2.messages).toHaveLength(1);
      expect(log2.messages[0].content).toBe("Message for conv-2");
    });
  });

  describe("processFailedQueue", () => {
    it("should retry queued entries and remove successful ones", async () => {
      // First make some entries fail
      let failCount = 0;
      const sometimesFailPersistence: LogPersistenceAdapter = {
        saveMessage: vi.fn().mockImplementation(async () => {
          failCount++;
          if (failCount <= 4) {
            // Fail first 4 attempts (initial + 3 retries)
            throw new Error("DB error");
          }
          // After that, succeed (during processFailedQueue)
        }),
        getMessagesByConversation: vi.fn().mockResolvedValue([]),
        saveConversationIntents: vi.fn().mockResolvedValue(undefined),
        getConversationIntents: vi.fn().mockResolvedValue([]),
      };

      const retryService = new ConversationLoggerService(
        sometimesFailPersistence,
        () => `msg-${++idCounter}`,
      );

      const logPromise = retryService.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content: "Hello",
      });

      await vi.advanceTimersByTimeAsync(7000);
      await logPromise;

      expect(retryService.getFailedQueue()).toHaveLength(1);

      // Now process the queue — persistence will succeed this time
      const result = await retryService.processFailedQueue();
      expect(result.processed).toBe(1);
      expect(result.remaining).toBe(0);
      expect(retryService.getFailedQueue()).toHaveLength(0);
    });

    it("should keep entries in queue if retry still fails", async () => {
      const alwaysFailPersistence: LogPersistenceAdapter = {
        saveMessage: vi.fn().mockRejectedValue(new Error("Still broken")),
        getMessagesByConversation: vi.fn().mockResolvedValue([]),
        saveConversationIntents: vi.fn().mockResolvedValue(undefined),
        getConversationIntents: vi.fn().mockResolvedValue([]),
      };

      const failService = new ConversationLoggerService(
        alwaysFailPersistence,
        () => `msg-${++idCounter}`,
      );

      const logPromise = failService.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content: "Hello",
      });

      await vi.advanceTimersByTimeAsync(7000);
      await logPromise;

      const result = await failService.processFailedQueue();
      expect(result.processed).toBe(0);
      expect(result.remaining).toBe(1);
      expect(failService.getFailedQueue()).toHaveLength(1);
    });
  });

  describe("integration: log and detect intents", () => {
    it("should log a message, detect intents, and tag the conversation", async () => {
      const content = "How much does a custom 3-tier cake cost for my wedding?";

      await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "whatsapp",
        role: "customer",
        content,
      });

      const intents = service.detectIntents(content);
      await service.tagConversation("conv-1", intents);

      const log = await service.getConversationLog("conv-1");
      expect(log.messages).toHaveLength(1);
      expect(log.intentTags).toContain("pricing_inquiry");
      expect(log.intentTags).toContain("custom_design_request");
    });

    it("should handle full conversation flow with multiple messages", async () => {
      // Customer asks about pricing
      const msg1 = "How much is a birthday cake?";
      await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "chat_widget",
        role: "customer",
        content: msg1,
      });
      await service.tagConversation("conv-1", service.detectIntents(msg1));

      // Assistant responds
      const msg2 = "Our birthday cakes start at $45-$120 depending on size!";
      await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "chat_widget",
        role: "assistant",
        content: msg2,
      });

      // Customer asks about availability
      const msg3 = "Are you available on March 15?";
      await service.logMessage({
        conversationId: "conv-1",
        customerId: "cust-1",
        channel: "chat_widget",
        role: "customer",
        content: msg3,
      });
      await service.tagConversation("conv-1", service.detectIntents(msg3));

      const log = await service.getConversationLog("conv-1");
      expect(log.messages).toHaveLength(3);
      expect(log.intentTags).toContain("pricing_inquiry");
      expect(log.intentTags).toContain("availability_check");
    });
  });
});
