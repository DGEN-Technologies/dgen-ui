class SecureSessionManager {
  private static instance: SecureSessionManager;
  private passwordCache: Map<string, string> = new Map();
  private lockTimers: Map<string, number> = new Map();
  private readonly LOCK_TIMEOUT = 15 * 60 * 1000; // 15 minutes

  private constructor() {
    // Clear on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.clearAll());

      // Clear on visibility change (tab switch)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // Start aggressive timeout when tab hidden
          setTimeout(() => this.clearAll(), 5 * 60 * 1000); // 5 min
        }
      });
    }
  }

  public static getInstance(): SecureSessionManager {
    if (!SecureSessionManager.instance) {
      SecureSessionManager.instance = new SecureSessionManager();
    }
    return SecureSessionManager.instance;
  }

  public setPassword(userId: string, password: string): void {
    this.passwordCache.set(userId, password);
    this.resetLockTimer(userId);
  }

  public getPassword(userId: string): string | null {
    this.resetLockTimer(userId);
    return this.passwordCache.get(userId) || null;
  }

  public clearPassword(userId: string): void {
    this.passwordCache.delete(userId);
    const timer = this.lockTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.lockTimers.delete(userId);
    }
  }

  public clearAll(): void {
    this.passwordCache.clear();
    this.lockTimers.forEach((timer) => clearTimeout(timer));
    this.lockTimers.clear();
  }

  private resetLockTimer(userId: string): void {
    const existingTimer = this.lockTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = window.setTimeout(() => {
      this.clearPassword(userId);
    }, this.LOCK_TIMEOUT);

    this.lockTimers.set(userId, timer);
  }
}

export const sessionManager = SecureSessionManager.getInstance();
