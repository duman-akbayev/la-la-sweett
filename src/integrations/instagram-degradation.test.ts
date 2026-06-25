/**
 * Tests for Instagram Graceful Degradation Module
 *
 * Validates:
 * - AI timeout handling (>10s sends acknowledgment DM)
 * - Retry with exponential backoff on failed API calls
 * - Log and skip when all retries exhausted (no crash)
 *
 * Requirements: 12.7, 12.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleDMWithTimeout,
  sendAcknowledgmentDM,
  DEFAULT_TIMEOUT_MS,
  ACKNOWLEDGMENT_MESSAGE,
} from './instagram-degradation';

// Mock dependencies
vi.mock('@/integrations/instagram', () => ({
  instagramIntegration: {
    sendDM: vi.fn().mockResolvedValue(undefined),
    handleDMWebhook: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/retry', () => ({
  retryExternalCall: vi.fn(
    async (_apiName: string, fn: () => Promise<unknown>) => {
      return fn();
    }
  ),
}));

// Get mocked modules
import { instagramIntegration } from '@/integrations/instagram';
import { retryExternalCall } from '@/lib/retry';

describe('Instagram Graceful Degradation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // handleDMWithTimeout
  // ---------------------------------------------------------------------------
  describe('handleDMWithTimeout', () => {
    it('should return success when operation completes within timeout', async () => {
      const processFn = vi.fn().mockResolvedValue('ai-response');

      const resultPromise = handleDMWithTimeout(processFn, 'user-123', 10000);
      await vi.advanceTimersByTimeAsync(100);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.result).toBe('ai-response');
      expect(result.timedOut).toBe(false);
      expect(instagramIntegration.sendDM).not.toHaveBeenCalled();
    });

    it('should send acknowledgment DM when operation times out after 10s', async () => {
      // Create a function that never resolves (simulates slow AI)
      const processFn = vi.fn(
        () => new Promise<string>(() => {}) // Never resolves
      );

      const resultPromise = handleDMWithTimeout(processFn, 'user-123', 10000);

      // Advance past the 10s timeout
      await vi.advanceTimersByTimeAsync(10001);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.result).toBeUndefined();
      // Should have called retryExternalCall to send acknowledgment
      expect(retryExternalCall).toHaveBeenCalledWith(
        'instagram',
        expect.any(Function)
      );
    });

    it('should use DEFAULT_TIMEOUT_MS (10s) when no timeout specified', async () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(10000);

      const processFn = vi.fn(
        () => new Promise<string>(() => {})
      );

      const resultPromise = handleDMWithTimeout(processFn, 'user-123');

      // Advance just before timeout — should not trigger
      await vi.advanceTimersByTimeAsync(9999);

      // Now advance past timeout
      await vi.advanceTimersByTimeAsync(2);
      const result = await resultPromise;

      expect(result.timedOut).toBe(true);
    });

    it('should log and skip when operation throws (does not crash)', async () => {
      vi.useRealTimers();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processFn = vi.fn().mockRejectedValue(new Error('AI processing error'));

      const result = await handleDMWithTimeout(processFn, 'user-123', 10000);

      // Should not crash — returns a failure result
      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(false);
      expect(result.result).toBeUndefined();
      // Should log the error
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Instagram Degradation] DM processing failed:',
        'AI processing error'
      );
      consoleSpy.mockRestore();
    });

    it('should clear the timeout on successful completion', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const processFn = vi.fn().mockResolvedValue('done');

      const resultPromise = handleDMWithTimeout(processFn, 'user-123', 10000);
      await vi.advanceTimersByTimeAsync(50);
      await resultPromise;

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // sendAcknowledgmentDM
  // ---------------------------------------------------------------------------
  describe('sendAcknowledgmentDM', () => {
    it('should send the predefined acknowledgment DM with retry', async () => {
      await sendAcknowledgmentDM('user-456');

      expect(retryExternalCall).toHaveBeenCalledWith(
        'instagram',
        expect.any(Function)
      );

      // Execute the retry callback to verify it calls sendDM correctly
      const retryFn = vi.mocked(retryExternalCall).mock.calls[0][1];
      await retryFn();

      expect(instagramIntegration.sendDM).toHaveBeenCalledWith(
        'user-456',
        ACKNOWLEDGMENT_MESSAGE
      );
    });

    it('should send custom message when provided', async () => {
      const customMessage = 'Custom Instagram acknowledgment!';
      await sendAcknowledgmentDM('user-456', customMessage);

      const retryFn = vi.mocked(retryExternalCall).mock.calls[0][1];
      await retryFn();

      expect(instagramIntegration.sendDM).toHaveBeenCalledWith(
        'user-456',
        customMessage
      );
    });

    it('should log and skip when all retries are exhausted (no crash)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(retryExternalCall).mockRejectedValueOnce(
        new Error('Instagram API unreachable')
      );

      // Should not throw — logs and skips
      await expect(sendAcknowledgmentDM('user-456')).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Instagram Degradation] Failed to send acknowledgment DM after all retries:',
        expect.objectContaining({
          recipientId: 'user-456',
          error: 'Instagram API unreachable',
        })
      );
      consoleSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Constants validation
  // ---------------------------------------------------------------------------
  describe('constants', () => {
    it('should have 10-second default timeout', () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
    });

    it('should have a meaningful acknowledgment message', () => {
      expect(ACKNOWLEDGMENT_MESSAGE.length).toBeGreaterThan(10);
      expect(ACKNOWLEDGMENT_MESSAGE).toContain('get back to you');
    });
  });
});
