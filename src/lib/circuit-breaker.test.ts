import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  circuitBreakers,
} from "./circuit-breaker";

describe("circuit-breaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Closed state", () => {
    it("passes through on success", async () => {
      const breaker = new CircuitBreaker("test");
      const fn = vi.fn().mockResolvedValue("result");

      const result = await breaker.execute(fn);

      expect(result).toBe("result");
      expect(fn).toHaveBeenCalledTimes(1);
      expect(breaker.getState()).toBe("closed");
    });

    it("increments failure count but stays closed under threshold", async () => {
      const breaker = new CircuitBreaker("test");
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      // 4 failures (threshold is 5)
      for (let i = 0; i < 4; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }

      expect(breaker.getState()).toBe("closed");
      expect(breaker.getStats().failures).toBe(4);
    });

    it("resets failure count on success", async () => {
      const breaker = new CircuitBreaker("test");
      const failFn = vi.fn().mockRejectedValue(new Error("fail"));
      const successFn = vi.fn().mockResolvedValue("ok");

      // 3 failures
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow("fail");
      }
      expect(breaker.getStats().failures).toBe(3);

      // 1 success resets count
      await breaker.execute(successFn);
      expect(breaker.getStats().failures).toBe(0);
    });
  });

  describe("Closed → Open transition", () => {
    it("trips after 5 consecutive failures within 1 minute", async () => {
      const breaker = new CircuitBreaker("test");
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      // 5 consecutive failures within the window
      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }

      expect(breaker.getState()).toBe("open");
    });
  });

  describe("Open state", () => {
    it("immediately throws CircuitBreakerOpenError without calling fn", async () => {
      const breaker = new CircuitBreaker("test");
      const failFn = vi.fn().mockRejectedValue(new Error("fail"));

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow("fail");
      }

      expect(breaker.getState()).toBe("open");

      // Now try to execute — should not call fn
      const probeFn = vi.fn().mockResolvedValue("should not be called");

      await expect(breaker.execute(probeFn)).rejects.toThrow(
        CircuitBreakerOpenError
      );
      expect(probeFn).not.toHaveBeenCalled();
    });

    it("throws error with correct breaker name", async () => {
      const breaker = new CircuitBreaker("my-api");
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }

      try {
        await breaker.execute(fn);
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerOpenError);
        expect((error as CircuitBreakerOpenError).breakerName).toBe("my-api");
      }
    });
  });

  describe("Open → Half-Open transition", () => {
    it("transitions to half-open after 30s timeout", async () => {
      const breaker = new CircuitBreaker("test");
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }
      expect(breaker.getState()).toBe("open");

      // Advance time by 30s
      vi.advanceTimersByTime(30_000);

      expect(breaker.getState()).toBe("half-open");
    });

    it("stays open before 30s timeout", async () => {
      const breaker = new CircuitBreaker("test");
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }

      // Advance 29s — should still be open
      vi.advanceTimersByTime(29_999);
      expect(breaker.getState()).toBe("open");
    });
  });

  describe("Half-Open → Closed transition", () => {
    it("transitions to closed on successful probe", async () => {
      const breaker = new CircuitBreaker("test");
      const failFn = vi.fn().mockRejectedValue(new Error("fail"));

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow("fail");
      }

      // Advance to half-open
      vi.advanceTimersByTime(30_000);
      expect(breaker.getState()).toBe("half-open");

      // Successful probe
      const successFn = vi.fn().mockResolvedValue("recovered");
      const result = await breaker.execute(successFn);

      expect(result).toBe("recovered");
      expect(breaker.getState()).toBe("closed");
    });
  });

  describe("Half-Open → Open transition", () => {
    it("transitions back to open on failed probe", async () => {
      const breaker = new CircuitBreaker("test");
      const failFn = vi.fn().mockRejectedValue(new Error("fail"));

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow("fail");
      }

      // Advance to half-open
      vi.advanceTimersByTime(30_000);
      expect(breaker.getState()).toBe("half-open");

      // Failed probe — should go back to open
      await expect(breaker.execute(failFn)).rejects.toThrow("fail");
      expect(breaker.getState()).toBe("open");
    });

    it("resets the 30s timer when transitioning back to open from half-open", async () => {
      const breaker = new CircuitBreaker("test");
      const failFn = vi.fn().mockRejectedValue(new Error("fail"));

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow("fail");
      }

      // Advance to half-open
      vi.advanceTimersByTime(30_000);

      // Failed probe → back to open
      await expect(breaker.execute(failFn)).rejects.toThrow("fail");
      expect(breaker.getState()).toBe("open");

      // Should require another 30s before half-open again
      vi.advanceTimersByTime(29_999);
      expect(breaker.getState()).toBe("open");

      vi.advanceTimersByTime(1);
      expect(breaker.getState()).toBe("half-open");
    });
  });

  describe("Manual reset", () => {
    it("resets the breaker to closed state from open", async () => {
      const breaker = new CircuitBreaker("test");
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }
      expect(breaker.getState()).toBe("open");

      // Manual reset
      breaker.reset();
      expect(breaker.getState()).toBe("closed");
      expect(breaker.getStats().failures).toBe(0);
    });

    it("allows requests again after reset", async () => {
      const breaker = new CircuitBreaker("test");
      const failFn = vi.fn().mockRejectedValue(new Error("fail"));

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow("fail");
      }

      breaker.reset();

      // Should be able to execute again
      const successFn = vi.fn().mockResolvedValue("ok");
      const result = await breaker.execute(successFn);
      expect(result).toBe("ok");
      expect(successFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Failure window", () => {
    it("old failures outside 1min window do not count toward threshold", async () => {
      const breaker = new CircuitBreaker("test");
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      // 4 failures at t=0
      for (let i = 0; i < 4; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }
      expect(breaker.getState()).toBe("closed");

      // Advance time past the failure window (>1 min)
      vi.advanceTimersByTime(61_000);

      // 1 more failure — should NOT trip because old failures expired
      await expect(breaker.execute(fn)).rejects.toThrow("fail");
      expect(breaker.getState()).toBe("closed");
    });

    it("failures within the window accumulate correctly", async () => {
      const breaker = new CircuitBreaker("test");
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      // 3 failures at t=0
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }

      // Advance 30s (still within window)
      vi.advanceTimersByTime(30_000);

      // 2 more failures — total 5 within window → should trip
      for (let i = 0; i < 2; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }

      expect(breaker.getState()).toBe("open");
    });
  });

  describe("getStats", () => {
    it("reports correct stats after operations", async () => {
      const breaker = new CircuitBreaker("test");

      // Initial stats
      expect(breaker.getStats()).toEqual({
        state: "closed",
        failures: 0,
        lastFailure: undefined,
        lastSuccess: undefined,
      });

      // After success
      await breaker.execute(() => Promise.resolve("ok"));
      const statsAfterSuccess = breaker.getStats();
      expect(statsAfterSuccess.state).toBe("closed");
      expect(statsAfterSuccess.lastSuccess).toBeInstanceOf(Date);
      expect(statsAfterSuccess.lastFailure).toBeUndefined();

      // After failure
      await expect(
        breaker.execute(() => Promise.reject(new Error("err")))
      ).rejects.toThrow();
      const statsAfterFailure = breaker.getStats();
      expect(statsAfterFailure.failures).toBe(1);
      expect(statsAfterFailure.lastFailure).toBeInstanceOf(Date);
    });
  });

  describe("Custom options", () => {
    it("respects custom failure threshold", async () => {
      const breaker = new CircuitBreaker("test", { failureThreshold: 3 });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }

      expect(breaker.getState()).toBe("open");
    });

    it("respects custom reset timeout", async () => {
      const breaker = new CircuitBreaker("test", { resetTimeout: 10_000 });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }

      // Advance only 10s (custom timeout)
      vi.advanceTimersByTime(10_000);
      expect(breaker.getState()).toBe("half-open");
    });

    it("respects custom failure window", async () => {
      const breaker = new CircuitBreaker("test", { failureWindow: 5000 });
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      // 4 failures
      for (let i = 0; i < 4; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow("fail");
      }

      // Advance past the custom 5s window
      vi.advanceTimersByTime(6000);

      // 1 more failure — old ones expired, won't trip
      await expect(breaker.execute(fn)).rejects.toThrow("fail");
      expect(breaker.getState()).toBe("closed");
    });
  });

  describe("circuitBreakers registry", () => {
    it("has pre-configured breakers for all external APIs", () => {
      expect(circuitBreakers.whatsapp).toBeInstanceOf(CircuitBreaker);
      expect(circuitBreakers.instagram).toBeInstanceOf(CircuitBreaker);
      expect(circuitBreakers.telegram).toBeInstanceOf(CircuitBreaker);
      expect(circuitBreakers.claude).toBeInstanceOf(CircuitBreaker);
    });

    it("each breaker starts in closed state", () => {
      expect(circuitBreakers.whatsapp.getState()).toBe("closed");
      expect(circuitBreakers.instagram.getState()).toBe("closed");
      expect(circuitBreakers.telegram.getState()).toBe("closed");
      expect(circuitBreakers.claude.getState()).toBe("closed");
    });
  });
});
