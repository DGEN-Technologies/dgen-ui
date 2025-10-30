/**
 * Multi-tab synchronization service
 * Prevents duplicate SDK instances and coordinates wallet state across tabs
 */

export type TabSyncMessage =
  | { type: 'PING' }
  | { type: 'PONG'; tabId: string }
  | { type: 'WALLET_INITIALIZED'; tabId: string }
  | { type: 'WALLET_DISCONNECTED'; tabId: string }
  | { type: 'WALLET_UPDATED'; balance: number; timestamp: number }
  | { type: 'REQUEST_LOCK'; tabId: string }
  | { type: 'LOCK_ACQUIRED'; tabId: string }
  | { type: 'LOCK_RELEASED'; tabId: string };

export class TabSyncService {
  private static instance: TabSyncService;
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private hasWalletLock = false;
  private lockCheckInterval: number | null = null;
  private heartbeatInterval: number | null = null;
  private lastHeartbeat = 0;
  private readonly HEARTBEAT_INTERVAL = 5000; // 5 seconds
  private readonly LOCK_TIMEOUT = 10000; // 10 seconds
  private readonly LOCK_KEY = 'breez_wallet_lock';
  private readonly LOCK_HOLDER_KEY = 'breez_wallet_lock_holder';
  private readonly HEARTBEAT_KEY = 'breez_wallet_heartbeat';

  private messageHandlers: Set<(message: TabSyncMessage) => void> = new Set();

  private constructor() {
    // Use sessionStorage to maintain stable tab ID across page refreshes
    // sessionStorage persists across refreshes but clears when tab closes
    const TAB_ID_KEY = 'breez_tab_id';
    let storedTabId: string | null = null;

    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      storedTabId = sessionStorage.getItem(TAB_ID_KEY);
    }

    if (storedTabId) {
      // Reuse existing tab ID from this browser tab
      this.tabId = storedTabId;
      console.log(`[TabSync] Reusing tab ID from sessionStorage: ${this.tabId}`);
    } else {
      // Generate new tab ID for new tab
      this.tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(TAB_ID_KEY, this.tabId);
      }
      console.log(`[TabSync] Generated new tab ID: ${this.tabId}`);
    }
  }

  static getInstance(): TabSyncService {
    if (!TabSyncService.instance) {
      TabSyncService.instance = new TabSyncService();
    }
    return TabSyncService.instance;
  }

  /**
   * Initialize tab sync service
   */
  async init(): Promise<void> {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      console.warn('[TabSync] BroadcastChannel not available, tab sync disabled');
      return;
    }

    // Initialize BroadcastChannel for cross-tab communication
    this.channel = new BroadcastChannel('breez_wallet_sync');

    this.channel.onmessage = (event) => {
      this.handleMessage(event.data as TabSyncMessage);
    };

    // Listen for storage events (cross-tab localStorage changes)
    window.addEventListener('storage', this.handleStorageChange.bind(this));

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    console.log(`[TabSync] Initialized with ID: ${this.tabId}`);
  }

  /**
   * Attempt to acquire wallet lock
   * Returns true if lock acquired, false if another tab has it
   */
  async tryAcquireWalletLock(maxRetries: number = 3, retryDelayMs: number = 1000): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const now = Date.now();
      const existingLock = localStorage.getItem(this.LOCK_KEY);
      const lockHolder = localStorage.getItem(this.LOCK_HOLDER_KEY);
      const lastHeartbeat = parseInt(localStorage.getItem(this.HEARTBEAT_KEY) || '0');

      // Check if this tab already owns the lock (refresh scenario)
      if (lockHolder === this.tabId) {
        console.log(`[TabSync] Lock already owned by this tab, reacquiring...`);
        this.clearStaleLock();
      }

      // Check if there's an existing lock from another tab
      if (existingLock && lockHolder && lockHolder !== this.tabId) {
        const lockTime = parseInt(existingLock);

        // If lock is recent and has recent heartbeat, another tab has it
        if (now - lockTime < this.LOCK_TIMEOUT && now - lastHeartbeat < this.HEARTBEAT_INTERVAL * 2) {
          if (attempt < maxRetries - 1) {
            console.log(`[TabSync] Lock held by ${lockHolder}, retrying in ${retryDelayMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            continue;
          } else {
            console.log(`[TabSync] Lock held by ${lockHolder}, max retries reached`);
            return false;
          }
        }

        // Lock is stale, previous tab likely crashed
        console.log(`[TabSync] Stale lock detected from ${lockHolder}, clearing and acquiring...`);
        this.clearStaleLock();
      }

      // Acquire lock
      localStorage.setItem(this.LOCK_KEY, now.toString());
      localStorage.setItem(this.LOCK_HOLDER_KEY, this.tabId);
      localStorage.setItem(this.HEARTBEAT_KEY, now.toString());
      this.hasWalletLock = true;
      this.lastHeartbeat = now;

      // Start heartbeat to maintain lock
      this.startHeartbeat();

      // Broadcast lock acquisition
      this.broadcast({ type: 'LOCK_ACQUIRED', tabId: this.tabId });

      console.log(`[TabSync] Lock acquired by ${this.tabId}`);
      return true;
    }

    return false;
  }

  /**
   * Clear stale lock from localStorage
   */
  private clearStaleLock(): void {
    localStorage.removeItem(this.LOCK_KEY);
    localStorage.removeItem(this.LOCK_HOLDER_KEY);
    localStorage.removeItem(this.HEARTBEAT_KEY);
    console.log(`[TabSync] Cleared stale lock`);
  }

  /**
   * Release wallet lock
   */
  releaseWalletLock(): void {
    if (!this.hasWalletLock) return;

    localStorage.removeItem(this.LOCK_KEY);
    localStorage.removeItem(this.LOCK_HOLDER_KEY);
    localStorage.removeItem(this.HEARTBEAT_KEY);
    this.hasWalletLock = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Broadcast lock release
    this.broadcast({ type: 'LOCK_RELEASED', tabId: this.tabId });

    console.log(`[TabSync] Lock released by ${this.tabId}`);
  }

  /**
   * Check if this tab has the wallet lock
   */
  hasLock(): boolean {
    return this.hasWalletLock;
  }

  /**
   * Get this tab's ID
   */
  getTabId(): string {
    return this.tabId;
  }

  /**
   * Check if any tab has the wallet lock
   */
  isLocked(): boolean {
    if (typeof window === 'undefined') return false;

    const existingLock = localStorage.getItem(this.LOCK_KEY);
    const lastHeartbeat = parseInt(localStorage.getItem(this.HEARTBEAT_KEY) || '0');
    const now = Date.now();

    if (!existingLock) return false;

    const lockTime = parseInt(existingLock);

    // Check if lock is recent and has recent heartbeat
    return now - lockTime < this.LOCK_TIMEOUT && now - lastHeartbeat < this.HEARTBEAT_INTERVAL * 2;
  }

  /**
   * Get the ID of the tab that holds the lock
   */
  getLockHolder(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.LOCK_HOLDER_KEY);
  }

  /**
   * Force takeover of the wallet lock from another tab
   * This will clear any existing lock and acquire it for this tab
   * Warning: This may interrupt operations in the other tab
   */
  async forceTakeover(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    console.log(`[TabSync] Force takeover requested by ${this.tabId}`);

    // Clear any existing lock
    this.clearStaleLock();

    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    // Acquire lock without retries (we just cleared it)
    const now = Date.now();
    localStorage.setItem(this.LOCK_KEY, now.toString());
    localStorage.setItem(this.LOCK_HOLDER_KEY, this.tabId);
    localStorage.setItem(this.HEARTBEAT_KEY, now.toString());
    this.hasWalletLock = true;
    this.lastHeartbeat = now;

    // Start heartbeat to maintain lock
    this.startHeartbeat();

    // Broadcast lock acquisition
    this.broadcast({ type: 'LOCK_ACQUIRED', tabId: this.tabId });

    console.log(`[TabSync] Force takeover completed by ${this.tabId}`);
    return true;
  }

  /**
   * Check if the active tab is still alive by checking heartbeat freshness
   */
  isActiveTabAlive(): boolean {
    if (typeof window === 'undefined') return false;

    const lastHeartbeat = parseInt(localStorage.getItem(this.HEARTBEAT_KEY) || '0');
    const now = Date.now();

    // Consider tab alive if heartbeat is within the last 2 intervals
    return now - lastHeartbeat < this.HEARTBEAT_INTERVAL * 2;
  }

  /**
   * Get information about the current lock state
   */
  getLockInfo(): { holder: string | null; time: number | null; isAlive: boolean } {
    if (typeof window === 'undefined') {
      return { holder: null, time: null, isAlive: false };
    }

    const holder = localStorage.getItem(this.LOCK_HOLDER_KEY);
    const lockKey = localStorage.getItem(this.LOCK_KEY);
    const time = lockKey ? parseInt(lockKey) : null;
    const isAlive = this.isActiveTabAlive();

    return { holder, time, isAlive };
  }

  /**
   * Broadcast wallet state update
   */
  broadcastWalletUpdate(balance: number): void {
    this.broadcast({
      type: 'WALLET_UPDATED',
      balance,
      timestamp: Date.now()
    });
  }

  /**
   * Add message handler
   */
  onMessage(handler: (message: TabSyncMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Broadcast message to other tabs
   */
  private broadcast(message: TabSyncMessage): void {
    if (this.channel) {
      this.channel.postMessage(message);
    }
  }

  /**
   * Handle incoming messages from other tabs
   */
  private handleMessage(message: TabSyncMessage): void {
    console.log(`[TabSync] Received message:`, message);

    // Notify all handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('[TabSync] Error in message handler:', error);
      }
    });
  }

  /**
   * Handle localStorage changes from other tabs
   */
  private handleStorageChange(event: StorageEvent): void {
    // Check if lock was released by another tab
    if (event.key === this.LOCK_KEY && !event.newValue && !this.hasWalletLock) {
      console.log('[TabSync] Lock released by another tab');
    }
  }

  /**
   * Start heartbeat to maintain lock
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = window.setInterval(() => {
      if (this.hasWalletLock) {
        const now = Date.now();
        localStorage.setItem(this.HEARTBEAT_KEY, now.toString());
        localStorage.setItem(this.LOCK_KEY, now.toString());
        this.lastHeartbeat = now;
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.releaseWalletLock();

    if (this.lockCheckInterval) {
      clearInterval(this.lockCheckInterval);
      this.lockCheckInterval = null;
    }

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    this.messageHandlers.clear();

    console.log(`[TabSync] Cleaned up for ${this.tabId}`);
  }
}

// Export singleton instance
export const tabSync = TabSyncService.getInstance();
