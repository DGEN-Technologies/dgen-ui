interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private blockedUntil: Map<string, number> = new Map();

  constructor(private config: RateLimitConfig) {}

  public checkLimit(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();

    // Check if currently blocked
    const blockedUntil = this.blockedUntil.get(key);
    if (blockedUntil && now < blockedUntil) {
      return {
        allowed: false,
        retryAfter: Math.ceil((blockedUntil - now) / 1000),
      };
    }

    // Clean up old attempts
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    // Check if limit exceeded
    if (recentAttempts.length >= this.config.maxAttempts) {
      const blockUntil = now + this.config.blockDurationMs;
      this.blockedUntil.set(key, blockUntil);
      return {
        allowed: false,
        retryAfter: Math.ceil(this.config.blockDurationMs / 1000),
      };
    }

    // Record this attempt
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);

    return { allowed: true };
  }

  public reset(key: string): void {
    this.attempts.delete(key);
    this.blockedUntil.delete(key);
  }
}

// Pre-configured rate limiters
export const walletUnlockLimiter = new RateLimiter({
  maxAttempts: 10,  // More forgiving for users who forgot password
  windowMs: 5 * 60 * 1000, // 5 minutes
  blockDurationMs: 5 * 60 * 1000, // 5 minutes (shorter lockout)
});

export const paymentLimiter = new RateLimiter({
  maxAttempts: 50,
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 5 * 60 * 1000, // 5 minutes
});
