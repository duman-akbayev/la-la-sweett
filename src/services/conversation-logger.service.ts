/**
 * Conversation Logger Service implementation.
 *
 * Responsible for:
 * - Logging every message (customer + assistant) with timestamp, channel, customer ID
 * - Tagging conversations with intent categories
 * - Detecting intents from message text using keyword matching
 * - Retry logging up to 3 times; queue on failure; notify owner
 * - Retaining data for 12 months minimum
 *
 * Requirements: 14.1, 14.3, 14.5
 */

import type {
  Channel,
  IntentTag,
  Message,
  MessageRole,
  Conversation,
} from "../types";

// -----------------------------------------------------------------------------
// Intent Detection Keywords
// -----------------------------------------------------------------------------

const INTENT_KEYWORDS: Record<Exclude<IntentTag, "general_question">, string[]> =
  {
    pricing_inquiry: [
      "price",
      "cost",
      "how much",
      "budget",
      "afford",
      "expensive",
      "cheap",
      "rate",
    ],
    availability_check: [
      "available",
      "when",
      "date",
      "schedule",
      "book",
      "opening",
    ],
    custom_design_request: [
      "custom",
      "design",
      "theme",
      "special",
      "unique",
      "personalize",
    ],
    order_status: ["order", "status", "update", "where is", "tracking"],
  };

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** A logged message entry stored in the data layer */
export interface LoggedMessage {
  id: string;
  conversationId: string;
  customerId: string;
  channel: Channel;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

/** Result of a log operation */
export interface LogResult {
  success: boolean;
  messageId?: string;
  queued?: boolean;
  error?: string;
}

/** A failed log entry queued for later persistence */
export interface QueuedLogEntry {
  id: string;
  entry: LoggedMessage;
  retryCount: number;
  queuedAt: Date;
}

/** Conversation log retrieval result */
export interface ConversationLog {
  conversationId: string;
  messages: LoggedMessage[];
  intentTags: IntentTag[];
}

/** Persistence adapter interface for dependency injection */
export interface LogPersistenceAdapter {
  saveMessage(entry: LoggedMessage): Promise<void>;
  getMessagesByConversation(conversationId: string): Promise<LoggedMessage[]>;
  saveConversationIntents(
    conversationId: string,
    intents: IntentTag[],
  ): Promise<void>;
  getConversationIntents(conversationId: string): Promise<IntentTag[]>;
}

/** Owner notification function type */
export type OwnerNotifyFn = (message: string) => Promise<void>;

// -----------------------------------------------------------------------------
// Default in-memory persistence (for testing / before DB is wired)
// -----------------------------------------------------------------------------

class InMemoryPersistence implements LogPersistenceAdapter {
  private messages: LoggedMessage[] = [];
  private intents: Map<string, IntentTag[]> = new Map();

  async saveMessage(entry: LoggedMessage): Promise<void> {
    this.messages.push(entry);
  }

  async getMessagesByConversation(
    conversationId: string,
  ): Promise<LoggedMessage[]> {
    return this.messages.filter((m) => m.conversationId === conversationId);
  }

  async saveConversationIntents(
    conversationId: string,
    intents: IntentTag[],
  ): Promise<void> {
    const existing = this.intents.get(conversationId) ?? [];
    const merged = Array.from(new Set([...existing, ...intents]));
    this.intents.set(conversationId, merged);
  }

  async getConversationIntents(conversationId: string): Promise<IntentTag[]> {
    return this.intents.get(conversationId) ?? [];
  }

  /** For testing: clear all data */
  clear(): void {
    this.messages = [];
    this.intents.clear();
  }

  /** For testing: get all messages */
  getAllMessages(): LoggedMessage[] {
    return [...this.messages];
  }
}

// -----------------------------------------------------------------------------
// Conversation Logger Service
// -----------------------------------------------------------------------------

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000]; // exponential backoff: 1s, 2s, 4s

/**
 * Delays execution for the specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ConversationLoggerService {
  private persistence: LogPersistenceAdapter;
  private failedQueue: QueuedLogEntry[] = [];
  private ownerNotifyFn: OwnerNotifyFn | null = null;
  private idGenerator: () => string;

  constructor(
    persistence?: LogPersistenceAdapter,
    idGenerator?: () => string,
  ) {
    this.persistence = persistence ?? new InMemoryPersistence();
    this.idGenerator = idGenerator ?? (() => crypto.randomUUID());
  }

  /**
   * Set the persistence adapter (for dependency injection).
   */
  setPersistence(adapter: LogPersistenceAdapter): void {
    this.persistence = adapter;
  }

  /**
   * Set the owner notification function.
   */
  setOwnerNotify(fn: OwnerNotifyFn): void {
    this.ownerNotifyFn = fn;
  }

  /**
   * Set the ID generator function (for testing).
   */
  setIdGenerator(fn: () => string): void {
    this.idGenerator = fn;
  }

  /**
   * Logs a message with timestamp, channel, customer ID, role, and content.
   *
   * Implements retry logic: retries up to 3 times on failure.
   * On exhaustion, queues the entry for later persistence and notifies the owner.
   *
   * Requirements: 14.1, 14.5
   */
  async logMessage(params: {
    conversationId: string;
    customerId: string;
    channel: Channel;
    role: MessageRole;
    content: string;
    timestamp?: Date;
  }): Promise<LogResult> {
    const entry: LoggedMessage = {
      id: this.idGenerator(),
      conversationId: params.conversationId,
      customerId: params.customerId,
      channel: params.channel,
      role: params.role,
      content: params.content,
      timestamp: params.timestamp ?? new Date(),
    };

    // Attempt to persist with retries
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.persistence.saveMessage(entry);
        return { success: true, messageId: entry.id };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If we have retries left, wait before next attempt
        if (attempt < MAX_RETRIES) {
          await delay(RETRY_DELAYS_MS[attempt]);
        }
      }
    }

    // All retries exhausted — queue for later persistence
    const queuedEntry: QueuedLogEntry = {
      id: this.idGenerator(),
      entry,
      retryCount: MAX_RETRIES,
      queuedAt: new Date(),
    };
    this.failedQueue.push(queuedEntry);

    // Notify owner about the logging failure
    if (this.ownerNotifyFn) {
      try {
        await this.ownerNotifyFn(
          `⚠️ Conversation logging failed after ${MAX_RETRIES} retries. ` +
            `Message queued for later persistence. ` +
            `Conversation: ${params.conversationId}, Customer: ${params.customerId}, ` +
            `Error: ${lastError?.message ?? "Unknown error"}`,
        );
      } catch {
        // Owner notification itself failed — log to console as last resort
        console.error(
          "[ConversationLogger] Failed to notify owner of logging failure",
        );
      }
    }

    return {
      success: false,
      queued: true,
      error: lastError?.message ?? "Logging failed after all retries",
    };
  }

  /**
   * Tags a conversation with one or more intent categories.
   *
   * Requirements: 14.3
   */
  async tagConversation(
    conversationId: string,
    intents: IntentTag[],
  ): Promise<void> {
    if (intents.length === 0) return;
    await this.persistence.saveConversationIntents(conversationId, intents);
  }

  /**
   * Detects intent categories from message text using keyword matching.
   *
   * Returns at least one intent tag. If no specific intent is detected,
   * returns ["general_question"] as the default.
   *
   * Intent categories:
   * - pricing_inquiry: price, cost, how much, budget, afford, expensive, cheap, rate
   * - availability_check: available, when, date, schedule, book, opening
   * - custom_design_request: custom, design, theme, special, unique, personalize
   * - order_status: order, status, update, where is, tracking
   * - general_question: default when no other intent matches
   *
   * Requirements: 14.3
   */
  detectIntents(messageContent: string): IntentTag[] {
    const lowerContent = messageContent.toLowerCase();
    const detectedIntents: IntentTag[] = [];

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      const matched = keywords.some((keyword) =>
        lowerContent.includes(keyword),
      );
      if (matched) {
        detectedIntents.push(intent as IntentTag);
      }
    }

    // Default to general_question if no specific intent detected
    if (detectedIntents.length === 0) {
      detectedIntents.push("general_question");
    }

    return detectedIntents;
  }

  /**
   * Retrieves the full conversation log for a given conversation ID.
   *
   * Returns all messages and intent tags associated with the conversation.
   */
  async getConversationLog(conversationId: string): Promise<ConversationLog> {
    const messages =
      await this.persistence.getMessagesByConversation(conversationId);
    const intentTags =
      await this.persistence.getConversationIntents(conversationId);

    return {
      conversationId,
      messages,
      intentTags,
    };
  }

  /**
   * Returns the current failed log queue (entries waiting for later persistence).
   */
  getFailedQueue(): QueuedLogEntry[] {
    return [...this.failedQueue];
  }

  /**
   * Attempts to process the failed queue by retrying persistence.
   * Successfully persisted entries are removed from the queue.
   */
  async processFailedQueue(): Promise<{ processed: number; remaining: number }> {
    const toProcess = [...this.failedQueue];
    const remaining: QueuedLogEntry[] = [];
    let processed = 0;

    for (const queued of toProcess) {
      try {
        await this.persistence.saveMessage(queued.entry);
        processed++;
      } catch {
        remaining.push(queued);
      }
    }

    this.failedQueue = remaining;
    return { processed, remaining: remaining.length };
  }

  /**
   * Resets the service state (for testing).
   */
  reset(): void {
    this.failedQueue = [];
    if (this.persistence instanceof InMemoryPersistence) {
      this.persistence.clear();
    }
  }
}

// Singleton instance
const conversationLoggerService = new ConversationLoggerService();

export {
  conversationLoggerService as conversationLogger,
  ConversationLoggerService,
  InMemoryPersistence,
  INTENT_KEYWORDS,
  MAX_RETRIES,
  RETRY_DELAYS_MS,
};
