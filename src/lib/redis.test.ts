import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ioredis before importing modules
const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  zadd: vi.fn(),
  zcard: vi.fn(),
  zrange: vi.fn(),
  zremrangebyscore: vi.fn(),
  rpush: vi.fn(),
  lpop: vi.fn(),
  llen: vi.fn(),
  lindex: vi.fn(),
  lrange: vi.fn(),
  quit: vi.fn().mockResolvedValue("OK"),
  pipeline: vi.fn().mockReturnValue({
    zremrangebyscore: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, 0],
      [null, 0],
    ]),
  }),
};

vi.mock("ioredis", () => {
  return {
    default: class MockRedis {
      constructor() {
        return mockRedisInstance;
      }
    },
  };
});

import {
  getRedisClient,
  disconnectRedis,
  resetRedisClient,
  getRedisConfig,
  REDIS_KEYS,
} from "./redis";
import {
  getSession,
  setSession,
  refreshSession,
  expireSession,
} from "./session";
import {
  checkRateLimit,
  resetRateLimit,
  getRateLimitCount,
  RATE_LIMITS,
} from "./rate-limit";
import {
  pushToQueue,
  popFromQueue,
  getQueueLength,
  clearQueue,
  peekQueue,
  getAllFromQueue,
  MAX_QUEUE_SIZE,
  type QueuedNotification,
} from "./queue";

describe("Redis Client (src/lib/redis.ts)", () => {
  beforeEach(() => {
    resetRedisClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetRedisClient();
  });

  it("should return default config from environment variables", () => {
    const config = getRedisConfig();
    expect(config.url).toBe("redis://localhost:6379");
    expect(config.maxRetriesPerRequest).toBe(3);
  });

  it("should create a Redis client singleton", () => {
    const client1 = getRedisClient();
    const client2 = getRedisClient();
    expect(client1).toBe(client2);
  });

  it("should disconnect gracefully", async () => {
    getRedisClient();
    await disconnectRedis();
    expect(mockRedisInstance.quit).toHaveBeenCalled();
  });

  it("should have correct key prefixes", () => {
    expect(REDIS_KEYS.SESSION).toBe("session:");
    expect(REDIS_KEYS.RATE_LIMIT).toBe("ratelimit:");
    expect(REDIS_KEYS.NOTIFICATION_QUEUE).toBe("notifications:queue");
  });
});

describe("Session Management (src/lib/session.ts)", () => {
  beforeEach(() => {
    resetRedisClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetRedisClient();
  });

  it("should return null for non-existent session", async () => {
    mockRedisInstance.get.mockResolvedValue(null);

    const result = await getSession("non-existent");
    expect(result).toBeNull();
    expect(mockRedisInstance.get).toHaveBeenCalledWith("session:non-existent");
  });

  it("should retrieve an existing session", async () => {
    const sessionData = {
      sessionId: "test-123",
      channel: "chat_widget",
      createdAt: "2024-01-01T00:00:00.000Z",
      lastActivityAt: "2024-01-01T00:05:00.000Z",
    };
    mockRedisInstance.get.mockResolvedValue(JSON.stringify(sessionData));

    const result = await getSession("test-123");
    expect(result).toEqual(sessionData);
  });

  it("should set a session with 30-minute default expiration", async () => {
    mockRedisInstance.set.mockResolvedValue("OK");

    const sessionData = {
      sessionId: "test-456",
      channel: "whatsapp" as const,
      createdAt: "2024-01-01T00:00:00.000Z",
      lastActivityAt: "2024-01-01T00:00:00.000Z",
    };

    await setSession("test-456", sessionData);

    expect(mockRedisInstance.set).toHaveBeenCalledWith(
      "session:test-456",
      expect.any(String),
      "EX",
      1800, // 30 minutes in seconds
    );
  });

  it("should allow custom timeout on session set", async () => {
    mockRedisInstance.set.mockResolvedValue("OK");

    const sessionData = {
      sessionId: "test-789",
      channel: "instagram" as const,
      createdAt: "2024-01-01T00:00:00.000Z",
      lastActivityAt: "2024-01-01T00:00:00.000Z",
    };

    await setSession("test-789", sessionData, 600);

    expect(mockRedisInstance.set).toHaveBeenCalledWith(
      "session:test-789",
      expect.any(String),
      "EX",
      600,
    );
  });

  it("should refresh session expiration", async () => {
    mockRedisInstance.expire.mockResolvedValue(1);

    const result = await refreshSession("test-123");
    expect(result).toBe(true);
    expect(mockRedisInstance.expire).toHaveBeenCalledWith(
      "session:test-123",
      1800,
    );
  });

  it("should return false when refreshing non-existent session", async () => {
    mockRedisInstance.expire.mockResolvedValue(0);

    const result = await refreshSession("non-existent");
    expect(result).toBe(false);
  });

  it("should expire (delete) a session", async () => {
    mockRedisInstance.del.mockResolvedValue(1);

    const result = await expireSession("test-123");
    expect(result).toBe(true);
    expect(mockRedisInstance.del).toHaveBeenCalledWith("session:test-123");
  });
});

describe("Rate Limiting (src/lib/rate-limit.ts)", () => {
  beforeEach(() => {
    resetRedisClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetRedisClient();
  });

  it("should have correct default rate limits", () => {
    expect(RATE_LIMITS.WHATSAPP.maxRequests).toBe(20);
    expect(RATE_LIMITS.WHATSAPP.windowSeconds).toBe(60);
    expect(RATE_LIMITS.CHAT_WIDGET.maxRequests).toBe(10);
    expect(RATE_LIMITS.CHAT_WIDGET.windowSeconds).toBe(60);
  });

  it("should allow request when under the limit", async () => {
    const mockPipeline = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 0], // zremrangebyscore result
        [null, 5], // zcard result: 5 out of 20
      ]),
    };
    mockRedisInstance.pipeline.mockReturnValue(mockPipeline);
    mockRedisInstance.zadd.mockResolvedValue(1);
    mockRedisInstance.expire.mockResolvedValue(1);

    const result = await checkRateLimit("whatsapp:+1234567890", 20, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(14); // 20 - 5 - 1
    expect(result.retryAfter).toBeUndefined();
  });

  it("should reject request when at the limit", async () => {
    const mockPipeline = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 0], // zremrangebyscore result
        [null, 20], // zcard result: 20 out of 20
      ]),
    };
    mockRedisInstance.pipeline.mockReturnValue(mockPipeline);
    mockRedisInstance.zrange.mockResolvedValue([
      "oldest-entry",
      String(Date.now() - 30000), // 30s ago
    ]);

    const result = await checkRateLimit("whatsapp:+1234567890", 20, 60);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("should reset rate limit for a key", async () => {
    mockRedisInstance.del.mockResolvedValue(1);

    await resetRateLimit("whatsapp:+1234567890");

    expect(mockRedisInstance.del).toHaveBeenCalledWith(
      "ratelimit:whatsapp:+1234567890",
    );
  });

  it("should get current rate limit count", async () => {
    mockRedisInstance.zremrangebyscore.mockResolvedValue(0);
    mockRedisInstance.zcard.mockResolvedValue(7);

    const count = await getRateLimitCount("chat:session-abc", 60);

    expect(count).toBe(7);
  });
});

describe("Notification Queue (src/lib/queue.ts)", () => {
  beforeEach(() => {
    resetRedisClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetRedisClient();
  });

  const sampleNotification: QueuedNotification = {
    id: "notif-001",
    type: "new_order",
    content: "New order from John: Birthday Cake, 30 servings",
    priority: "high",
    createdAt: "2024-01-15T10:30:00.000Z",
  };

  it("should have max queue size of 1000", () => {
    expect(MAX_QUEUE_SIZE).toBe(1000);
  });

  it("should push notification to queue when under capacity", async () => {
    mockRedisInstance.llen.mockResolvedValue(500);
    mockRedisInstance.rpush.mockResolvedValue(501);

    const result = await pushToQueue(sampleNotification);

    expect(result.success).toBe(true);
    expect(result.queueLength).toBe(501);
    expect(result.overflow).toBe(false);
    expect(mockRedisInstance.rpush).toHaveBeenCalledWith(
      "notifications:queue",
      JSON.stringify(sampleNotification),
    );
  });

  it("should reject push when queue is at capacity", async () => {
    mockRedisInstance.llen.mockResolvedValue(1000);

    const result = await pushToQueue(sampleNotification);

    expect(result.success).toBe(false);
    expect(result.queueLength).toBe(1000);
    expect(result.overflow).toBe(true);
    expect(mockRedisInstance.rpush).not.toHaveBeenCalled();
  });

  it("should pop notification from front of queue (FIFO)", async () => {
    mockRedisInstance.lpop.mockResolvedValue(
      JSON.stringify(sampleNotification),
    );

    const result = await popFromQueue();

    expect(result).toEqual(sampleNotification);
    expect(mockRedisInstance.lpop).toHaveBeenCalledWith("notifications:queue");
  });

  it("should return null when popping from empty queue", async () => {
    mockRedisInstance.lpop.mockResolvedValue(null);

    const result = await popFromQueue();
    expect(result).toBeNull();
  });

  it("should return current queue length", async () => {
    mockRedisInstance.llen.mockResolvedValue(42);

    const length = await getQueueLength();
    expect(length).toBe(42);
  });

  it("should clear the queue", async () => {
    mockRedisInstance.del.mockResolvedValue(1);

    await clearQueue();
    expect(mockRedisInstance.del).toHaveBeenCalledWith("notifications:queue");
  });

  it("should peek at front of queue without removing", async () => {
    mockRedisInstance.lindex.mockResolvedValue(
      JSON.stringify(sampleNotification),
    );

    const result = await peekQueue();
    expect(result).toEqual(sampleNotification);
    expect(mockRedisInstance.lindex).toHaveBeenCalledWith(
      "notifications:queue",
      0,
    );
  });

  it("should retrieve all items from queue", async () => {
    const notifications = [
      sampleNotification,
      { ...sampleNotification, id: "notif-002" },
    ];
    mockRedisInstance.lrange.mockResolvedValue(
      notifications.map((n) => JSON.stringify(n)),
    );

    const result = await getAllFromQueue();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(sampleNotification);
  });
});
