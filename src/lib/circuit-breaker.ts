/**
 * Circuit Breaker pattern implementation for external API calls.
 *
 * Implements Requirement 12.6:
 * External APIs (WhatsApp, Instagram, Telegram, Claude) use a circuit breaker:
 * - Closed: Normal operation — requests pass through
 * - Open: After 5 consecutive failures within 1 minute → all calls fail immediately for 30s
 * - Half-Open: After 30s timeout, allow one probe request; success → Closed, failure → Open
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures to trip the breaker (default: 5) */
  failureThreshold?: number;
  /** Window in ms for counting consecutive failures (default: 60000 = 1 minute) */
  failureWindow?: number;
  /** How long the circuit stays open in ms before half-open probe (default: 30000 = 30s) */
  resetTimeout?: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  lastFailure?: Date;
  lastSuccess?: Date;
}

/**
 * Error thrown when the circuit breaker is open and requests are short-circuited.
 */
export class CircuitBreakerOpenError extends Error {
  public readonly breakerName: string;

  constructor(name: string) {
    super(`Circuit breaker "${name}" is open — request blocked`);
    this.name = 'CircuitBreakerOpenError';
    this.breakerName = name;
  }
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_FAILURE_WINDOW = 60_000; // 1 minute
const DEFAULT_RESET_TIMEOUT = 30_000; // 30 seconds

export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly failureWindow: number;
  private readonly resetTimeout: number;

  private state: CircuitState = 'closed';
  private failureTimestamps: number[] = [];
  private lastFailure?: Date;
  private lastSuccess?: Date;
  private openedAt?: number;

  constructor(name: string, options?: CircuitBreakerOptions) {
    this.name = name;
    this.failureThreshold = options?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.failureWindow = options?.failureWindow ?? DEFAULT_FAILURE_WINDOW;
    this.resetTimeout = options?.resetTimeout ?? DEFAULT_RESET_TIMEOUT;
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * - In CLOSED state: execute fn(). On success, reset failure count.
   *   On failure, increment failure count. If threshold reached within window, transition to OPEN.
   * - In OPEN state: immediately throw CircuitBreakerOpenError without calling fn().
   *   After resetTimeout, transition to HALF_OPEN.
   * - In HALF_OPEN state: allow ONE request through.
   *   On success → CLOSED. On failure → OPEN (reset the 30s timer).
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if enough time has passed to transition to half-open
      const now = Date.now();
      if (this.openedAt && now - this.openedAt >= this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new CircuitBreakerOpenError(this.name);
      }
    }

    if (this.state === 'half-open') {
      // Allow one probe request
      try {
        const result = await fn();
        // Success: transition back to closed
        this.transitionToClosed();
        return result;
      } catch (error) {
        // Failure: transition back to open, reset the timer
        this.transitionToOpen();
        throw error;
      }
    }

    // State is CLOSED — normal operation
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /** Get current circuit state */
  getState(): CircuitState {
    // Check if the breaker should transition to half-open
    if (this.state === 'open' && this.openedAt) {
      const now = Date.now();
      if (now - this.openedAt >= this.resetTimeout) {
        this.state = 'half-open';
      }
    }
    return this.state;
  }

  /** Get breaker statistics */
  getStats(): CircuitBreakerStats {
    return {
      state: this.getState(),
      failures: this.getRecentFailureCount(),
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
    };
  }

  /** Manually reset the breaker to closed state */
  reset(): void {
    this.transitionToClosed();
  }

  private onSuccess(): void {
    this.failureTimestamps = [];
    this.lastSuccess = new Date();
  }

  private onFailure(): void {
    const now = Date.now();
    this.lastFailure = new Date();
    this.failureTimestamps.push(now);

    // Remove failures outside the window
    this.pruneOldFailures(now);

    // Check if threshold is reached
    if (this.failureTimestamps.length >= this.failureThreshold) {
      this.transitionToOpen();
    }
  }

  private pruneOldFailures(now: number): void {
    const windowStart = now - this.failureWindow;
    this.failureTimestamps = this.failureTimestamps.filter(
      (ts) => ts > windowStart
    );
  }

  private transitionToOpen(): void {
    this.state = 'open';
    this.openedAt = Date.now();
  }

  private transitionToClosed(): void {
    this.state = 'closed';
    this.failureTimestamps = [];
    this.openedAt = undefined;
  }

  private getRecentFailureCount(): number {
    const now = Date.now();
    const windowStart = now - this.failureWindow;
    return this.failureTimestamps.filter((ts) => ts > windowStart).length;
  }
}

/**
 * Pre-configured circuit breakers for each external API.
 * Each uses default settings: 5 failures in 1 min → open for 30s.
 */
export const circuitBreakers = {
  whatsapp: new CircuitBreaker('whatsapp'),
  instagram: new CircuitBreaker('instagram'),
  telegram: new CircuitBreaker('telegram'),
  claude: new CircuitBreaker('claude'),
};
