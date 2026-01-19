import { browser } from "$app/environment";
import { writable, get } from "svelte/store";
import { getTipHeight, getTxStatus, type Network } from "./EsploraClient";

// Polling cadence based on transaction state
export const POLL_INTERVALS = {
  FAST: 10000, // 10s - for pending transactions
  NORMAL: 60000, // 60s - for confirming transactions
  SLOW: 300000, // 5min - for stable state (all confirmed)
  PAUSED: 0, // No polling when page is hidden
};

const MAX_TRACKED_TX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_STATUS_FAILURES = 20;

type PollState = "fast" | "normal" | "slow" | "paused";

interface PollManagerState {
  currentInterval: number;
  state: PollState;
  pendingTxCount: number;
  confirmingTxCount: number;
  lastPollTime: number;
  isPolling: boolean;
}

type RefreshCallback = () => Promise<void>;

// Singleton poll manager
class PollManager {
  private static instance: PollManager | null = null;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: Set<RefreshCallback> = new Set();
  private pendingTxs: Map<string, Network> = new Map();
  private confirmingTxs: Map<string, Network> = new Map();
  private txMeta: Map<string, { failures: number; firstSeen: number }> =
    new Map();
  private refreshInFlight = false;

  // Store handlers for cleanup
  private visibilityHandler: (() => void) | null = null;
  private unloadHandler: (() => void) | null = null;

  // Reactive store for UI
  public store = writable<PollManagerState>({
    currentInterval: POLL_INTERVALS.SLOW,
    state: "slow",
    pendingTxCount: 0,
    confirmingTxCount: 0,
    lastPollTime: 0,
    isPolling: false,
  });

  private constructor() {
    if (browser) {
      // Handle visibility changes
      this.visibilityHandler = () => {
        if (document.hidden) {
          this.pause();
        } else {
          this.resume();
        }
      };
      document.addEventListener("visibilitychange", this.visibilityHandler);

      // Handle page unload
      this.unloadHandler = () => {
        this.stop();
      };
      window.addEventListener("beforeunload", this.unloadHandler);
    }
  }

  public static getInstance(): PollManager {
    if (!PollManager.instance) {
      PollManager.instance = new PollManager();
    }
    return PollManager.instance;
  }

  /**
   * Register a refresh callback
   */
  public onRefresh(callback: RefreshCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Track a pending transaction (will increase polling frequency)
   */
  public trackPendingTx(txid: string, network: Network = "liquid"): void {
    this.confirmingTxs.delete(txid);
    this.pendingTxs.set(txid, network);
    this.ensureTxMeta(txid);
    this.updateState();
  }

  /**
   * Track a confirming transaction (needs medium polling)
   */
  public trackConfirmingTx(txid: string, network: Network = "liquid"): void {
    // Move from pending to confirming
    const resolvedNetwork = this.pendingTxs.get(txid) || network;
    this.pendingTxs.delete(txid);
    this.confirmingTxs.set(txid, resolvedNetwork);
    this.ensureTxMeta(txid);
    this.updateState();
  }

  /**
   * Mark a transaction as confirmed (can slow down polling)
   */
  public markConfirmed(txid: string): void {
    this.stopTracking(txid);
  }

  /**
   * Clear all tracked transactions
   */
  public clearTrackedTxs(): void {
    this.pendingTxs.clear();
    this.confirmingTxs.clear();
    this.txMeta.clear();
    this.updateState();
  }

  private ensureTxMeta(txid: string): { failures: number; firstSeen: number } {
    const existing = this.txMeta.get(txid);
    if (existing) return existing;

    const meta = { failures: 0, firstSeen: Date.now() };
    this.txMeta.set(txid, meta);
    return meta;
  }

  private stopTracking(txid: string, reason?: string): void {
    this.pendingTxs.delete(txid);
    this.confirmingTxs.delete(txid);
    this.txMeta.delete(txid);
    this.updateState();
    if (reason) {
      console.warn(`[PollManager] Stopped tracking ${txid}: ${reason}`);
    }
  }

  /**
   * Start polling with the current interval
   */
  public start(): void {
    if (!browser) return;

    this.updateState();
    this.scheduleNextPoll();

    this.store.update((s) => ({ ...s, isPolling: true }));
    console.log("[PollManager] Started");
  }

  /**
   * Stop polling completely
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.store.update((s) => ({ ...s, isPolling: false }));
    console.log("[PollManager] Stopped");
  }

  /**
   * Clean up event listeners and reset singleton.
   * Call this before HMR or when destroying the app context.
   */
  public destroy(): void {
    this.stop();

    if (browser) {
      if (this.visibilityHandler) {
        document.removeEventListener(
          "visibilitychange",
          this.visibilityHandler,
        );
        this.visibilityHandler = null;
      }
      if (this.unloadHandler) {
        window.removeEventListener("beforeunload", this.unloadHandler);
        this.unloadHandler = null;
      }
    }

    this.callbacks.clear();
    this.pendingTxs.clear();
    this.confirmingTxs.clear();
    this.txMeta.clear();
    PollManager.instance = null;
    console.log("[PollManager] Destroyed");
  }

  /**
   * Pause polling (e.g., when tab is hidden)
   */
  private pause(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.store.update((s) => ({
      ...s,
      state: "paused",
      currentInterval: POLL_INTERVALS.PAUSED,
    }));
    console.log("[PollManager] Paused (tab hidden)");
  }

  /**
   * Resume polling after pause
   */
  private resume(): void {
    this.updateState(true);
    this.triggerRefresh(); // Immediate refresh when tab becomes visible
    this.scheduleNextPoll();
    console.log("[PollManager] Resumed (tab visible)");
  }

  /**
   * Trigger an immediate refresh
   */
  public async triggerRefresh(): Promise<void> {
    const state = get(this.store);

    // Don't refresh if paused
    if (state.state === "paused") return;
    if (this.refreshInFlight) return;

    console.log("[PollManager] Triggering refresh");

    this.store.update((s) => ({ ...s, lastPollTime: Date.now() }));

    this.refreshInFlight = true;

    try {
      // Execute all callbacks in parallel
      const promises = Array.from(this.callbacks).map(async (callback) => {
        try {
          await callback();
        } catch (error) {
          console.warn("[PollManager] Callback error:", error);
        }
      });

      await Promise.allSettled(promises);
      await this.refreshTrackedTxs();
    } finally {
      this.refreshInFlight = false;
    }
  }

  /**
   * Update polling state based on tracked transactions
   */
  private updateState(force = false): void {
    const pendingCount = this.pendingTxs.size;
    const confirmingCount = this.confirmingTxs.size;

    let newState: PollState;
    let newInterval: number;

    if (pendingCount > 0) {
      // Fast polling when we have pending transactions
      newState = "fast";
      newInterval = POLL_INTERVALS.FAST;
    } else if (confirmingCount > 0) {
      // Normal polling when waiting for confirmations
      newState = "normal";
      newInterval = POLL_INTERVALS.NORMAL;
    } else {
      // Slow polling when everything is confirmed
      newState = "slow";
      newInterval = POLL_INTERVALS.SLOW;
    }

    const currentState = get(this.store);

    // Only reschedule if interval changed
    if (
      force ||
      (currentState.currentInterval !== newInterval &&
        currentState.state !== "paused")
    ) {
      this.store.update((s) => ({
        ...s,
        state: newState,
        currentInterval: newInterval,
        pendingTxCount: pendingCount,
        confirmingTxCount: confirmingCount,
      }));

      // Reschedule with new interval
      if (this.intervalId) {
        this.scheduleNextPoll();
      }

      console.log(
        `[PollManager] State changed to ${newState} (${newInterval}ms interval)`,
      );
    } else {
      // Just update counts
      this.store.update((s) => ({
        ...s,
        pendingTxCount: pendingCount,
        confirmingTxCount: confirmingCount,
      }));
    }
  }

  /**
   * Refresh tracked transactions and update polling state based on confirmations
   */
  private async refreshTrackedTxs(): Promise<void> {
    if (!browser) return;

    const pendingEntries = Array.from(this.pendingTxs.entries());
    const confirmingEntries = Array.from(this.confirmingTxs.entries());

    if (pendingEntries.length === 0 && confirmingEntries.length === 0) {
      return;
    }

    const tipCache = new Map<Network, number>();
    const getTip = async (network: Network): Promise<number> => {
      if (tipCache.has(network)) {
        return tipCache.get(network) as number;
      }
      const height = await getTipHeight(network);
      tipCache.set(network, height);
      return height;
    };

    const checkTx = async (
      txid: string,
      network: Network,
      isConfirming: boolean,
    ): Promise<void> => {
      const meta = this.ensureTxMeta(txid);
      if (Date.now() - meta.firstSeen > MAX_TRACKED_TX_AGE_MS) {
        this.stopTracking(txid, "max age exceeded");
        return;
      }

      try {
        const status = await getTxStatus(txid, network);
        meta.failures = 0;
        if (!status.confirmed) {
          if (isConfirming) {
            this.trackPendingTx(txid, network);
          }
          return;
        }

        if (!status.block_height) {
          this.trackConfirmingTx(txid, network);
          return;
        }

        const tipHeight = await getTip(network);
        const confirmations = tipHeight - status.block_height + 1;

        if (confirmations >= 6) {
          this.markConfirmed(txid);
        } else {
          this.trackConfirmingTx(txid, network);
        }
      } catch (error) {
        meta.failures += 1;
        console.warn("[PollManager] Tx status check failed:", error);
        if (meta.failures >= MAX_STATUS_FAILURES) {
          this.stopTracking(txid, "max status check failures");
        }
      }
    };

    const checks = [
      ...pendingEntries.map(([txid, network]) => checkTx(txid, network, false)),
      ...confirmingEntries.map(([txid, network]) =>
        checkTx(txid, network, true),
      ),
    ];

    await Promise.allSettled(checks);
  }

  /**
   * Schedule the next poll
   */
  private scheduleNextPoll(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const state = get(this.store);
    if (state.currentInterval <= 0 || state.state === "paused") {
      return;
    }

    this.intervalId = setInterval(() => {
      // Skip if document is hidden
      if (browser && document.hidden) {
        return;
      }
      this.triggerRefresh();
    }, state.currentInterval);
  }

  /**
   * Get current polling stats
   */
  public getStats(): PollManagerState {
    return get(this.store);
  }
}

// Export singleton instance
export const pollManager = PollManager.getInstance();

// Export convenience functions
export function startPolling(): void {
  pollManager.start();
}

export function stopPolling(): void {
  pollManager.stop();
}

export function destroyPollManager(): void {
  pollManager.destroy();
}

export function onRefresh(callback: RefreshCallback): () => void {
  return pollManager.onRefresh(callback);
}

export function trackPendingTx(txid: string, network?: Network): void {
  pollManager.trackPendingTx(txid, network);
}

export function trackConfirmingTx(txid: string, network?: Network): void {
  pollManager.trackConfirmingTx(txid, network);
}

export function markTxConfirmed(txid: string): void {
  pollManager.markConfirmed(txid);
}

export function triggerRefresh(): Promise<void> {
  return pollManager.triggerRefresh();
}

export function clearTrackedTxs(): void {
  pollManager.clearTrackedTxs();
}

// Export store for reactive UI
export const pollManagerStore = pollManager.store;
