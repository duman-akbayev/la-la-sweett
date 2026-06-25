import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withRetry,
  retryExternalCall,
  calculateDelay,
  onRetryExhausted,
  clearAlertListeners,
  type RetryExhaustedAlert,
} from "./retry";

describe("retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAlertListeners();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("calculateDelay", () => {
    it("returns correct exponential delays with default base", () => {
      expect(calculateDelay(0)).toBe(1000); // 1s
      expect(calculateDelay(1)).toBe(2000); // 2s
      expect(calculateDelay(2)).toBe(4000); // 4s
    });

    it("respects custom base delay", () => {
      expect(calculateDelay(0, 500)).toBe(500);
      expect(calculateDelay(1, 500)).toBe(1000);
      expect(calculateDelay(2, 500)).toBe(2000);
    });
  });

  describe("withRetry", () => {
    it("returns immediately on first successful call (no retries)", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const result = await withRetry(fn);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("succeeds after 1 failure (retries once)", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockResolvedValue("success");

      const promise = withRetry(fn);

      // Advance past the first delay (1s)
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("succeeds after 2 failures (retries twice)", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");

      const promise = withRetry(fn);

      // First delay: 1s
      await vi.advanceTimersByTimeAsync(1000);
      // Second delay: 2s
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("succeeds after 3 failures (retries three times)", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockRejectedValueOnce(new Error("fail 3"))
        .mockResolvedValue("success");

      const promise = withRetry(fn);

      // First delay: 1s
      await vi.advanceTimersByTimeAsync(1000);
      // Second delay: 2s
      await vi.advanceTimersByTimeAsync(2000);
      // Third delay: 4s
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it("throws after all retries exhausted (4 failures total)", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("persistent failure"));

      // Attach .catch immediately to prevent unhandled rejection
      let caughtError: Error | undefined;
      const promise = withRetry(fn).catch((err) => {
        caughtError = err;
      });

      // Advance through all delays: 1s + 2s + 4s
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await promise;

      expect(caughtError).toBeDefined();
      expect(caughtError!.message).toBe("persistent failure");
      // 1 initial + 3 retries = 4 total
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it("uses correct timing between retries (1s, 2s, 4s)", async () => {
      const timestamps: number[] = [];
      const fn = vi.fn().mockImplementation(() => {
        timestamps.push(Date.now());
        return Promise.reject(new Error("fail"));
      });

      const promise = withRetry(fn).catch(() => {});

      // Initial call happens immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(timestamps).toHaveLength(1);

      // After 1s: second call
      await vi.advanceTimersByTimeAsync(1000);
      expect(timestamps).toHaveLength(2);
      expect(timestamps[1] - timestamps[0]).toBe(1000);

      // After 2s more: third call
      await vi.advanceTimersByTimeAsync(2000);
      expect(timestamps).toHaveLength(3);
      expect(timestamps[2] - timestamps[1]).toBe(2000);

      // After 4s more: fourth call
      await vi.advanceTimersByTimeAsync(4000);
      expect(timestamps).toHaveLength(4);
      expect(timestamps[3] - timestamps[2]).toBe(4000);

      await promise;
    });

    it("calls onRetry with correct attempt numbers", async () => {
      const onRetry = vi.fn();
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      const promise = withRetry(fn, { onRetry }).catch(() => {});

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await promise;

      expect(onRetry).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
      expect(onRetry).toHaveBeenNthCalledWith(3, 3, expect.any(Error));
    });

    it("calls onAllRetriesFailed when all retries exhausted", async () => {
      const onAllRetriesFailed = vi.fn();
      const fn = vi.fn().mockRejectedValue(new Error("final error"));

      const promise = withRetry(fn, { onAllRetriesFailed }).catch(() => {});

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await promise;

      expect(onAllRetriesFailed).toHaveBeenCalledTimes(1);
      expect(onAllRetriesFailed).toHaveBeenCalledWith(
        expect.objectContaining({ message: "final error" }),
      );
    });

    it("does not call onAllRetriesFailed when call succeeds", async () => {
      const onAllRetriesFailed = vi.fn();
      const fn = vi.fn().mockResolvedValue("ok");

      await withRetry(fn, { onAllRetriesFailed });

      expect(onAllRetriesFailed).not.toHaveBeenCalled();
    });

    it("does not call onRetry when first attempt succeeds", async () => {
      const onRetry = vi.fn();
      const fn = vi.fn().mockResolvedValue("ok");

      await withRetry(fn, { onRetry });

      expect(onRetry).not.toHaveBeenCalled();
    });

    it("handles non-Error throws by wrapping them", async () => {
      const fn = vi.fn().mockRejectedValue("string error");

      const promise = withRetry(fn, { maxRetries: 0 });

      await expect(promise).rejects.toThrow("string error");
    });

    it("respects custom maxRetries option", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("ok");

      const promise = withRetry(fn, { maxRetries: 1 });

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("respects custom baseDelayMs option", async () => {
      const timestamps: number[] = [];
      const fn = vi.fn().mockImplementation(() => {
        timestamps.push(Date.now());
        return Promise.reject(new Error("fail"));
      });

      const promise = withRetry(fn, { maxRetries: 2, baseDelayMs: 500 }).catch(
        () => {},
      );

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(500); // 500 * 2^0
      await vi.advanceTimersByTimeAsync(1000); // 500 * 2^1

      await promise;

      expect(timestamps[1] - timestamps[0]).toBe(500);
      expect(timestamps[2] - timestamps[1]).toBe(1000);
    });
  });

  describe("retryExternalCall", () => {
    it("returns result on success", async () => {
      const fn = vi.fn().mockResolvedValue({ status: 200 });

      const result = await retryExternalCall("whatsapp", fn);

      expect(result).toEqual({ status: 200 });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on failure and succeeds", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValue({ status: 200 });

      const promise = retryExternalCall("instagram", fn);

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toEqual({ status: 200 });
    });

    it("emits alert when all retries fail", async () => {
      const alertHandler = vi.fn();
      onRetryExhausted(alertHandler);

      const fn = vi.fn().mockRejectedValue(new Error("api down"));

      const promise = retryExternalCall("telegram", fn).catch(() => {});

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await promise;

      expect(alertHandler).toHaveBeenCalledTimes(1);
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          apiName: "telegram",
          error: expect.objectContaining({ message: "api down" }),
          totalAttempts: 4,
          timestamp: expect.any(Date),
        }),
      );
    });

    it("emits alert with correct apiName for each service", async () => {
      const alerts: RetryExhaustedAlert[] = [];
      onRetryExhausted((alert) => alerts.push(alert));

      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      // Test all four API names
      for (const apiName of [
        "whatsapp",
        "instagram",
        "telegram",
        "claude",
      ] as const) {
        const promise = retryExternalCall(apiName, fn).catch(() => {});
        await vi.advanceTimersByTimeAsync(7000); // 1s + 2s + 4s
        await promise;
      }

      expect(alerts).toHaveLength(4);
      expect(alerts[0].apiName).toBe("whatsapp");
      expect(alerts[1].apiName).toBe("instagram");
      expect(alerts[2].apiName).toBe("telegram");
      expect(alerts[3].apiName).toBe("claude");
    });

    it("calls user-provided onAllRetriesFailed in addition to alert", async () => {
      const alertHandler = vi.fn();
      const userCallback = vi.fn();
      onRetryExhausted(alertHandler);

      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      const promise = retryExternalCall("claude", fn, {
        onAllRetriesFailed: userCallback,
      }).catch(() => {});

      await vi.advanceTimersByTimeAsync(7000);
      await promise;

      expect(alertHandler).toHaveBeenCalledTimes(1);
      expect(userCallback).toHaveBeenCalledTimes(1);
    });

    it("supports unsubscribing from alert listener", async () => {
      const alertHandler = vi.fn();
      const unsubscribe = onRetryExhausted(alertHandler);

      // Unsubscribe before failure
      unsubscribe();

      const fn = vi.fn().mockRejectedValue(new Error("fail"));
      const promise = retryExternalCall("whatsapp", fn).catch(() => {});

      await vi.advanceTimersByTimeAsync(7000);
      await promise;

      expect(alertHandler).not.toHaveBeenCalled();
    });
  });
});
