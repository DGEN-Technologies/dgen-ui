import { writable, derived, get } from "svelte/store";
import * as walletService from "../walletService";
import { sessionManager } from "../security/sessionManager";
import {
  startPolling,
  stopPolling,
  onRefresh,
  trackPendingTx,
  trackConfirmingTx,
  markTxConfirmed,
  clearTrackedTxs,
} from "../esplora/PollManager";
import { isValidTxid } from "$lib/validation/esplora";

// Define interfaces locally to avoid import issues
interface GetInfoResponse {
  nodeState: any;
  balanceSat: number;
  pendingReceiveSat: number;
  pendingSendSat: number;
}

// Helper to check if wallet info has meaningfully changed (inspired by misty-breez's .distinct())
function hasWalletInfoChanged(
  oldInfo: GetInfoResponse | null,
  newInfo: GetInfoResponse | null,
): boolean {
  if (!oldInfo && !newInfo) return false;
  if (!oldInfo || !newInfo) return true;

  // Compare key fields that matter for UI updates
  return (
    oldInfo.balanceSat !== newInfo.balanceSat ||
    oldInfo.pendingReceiveSat !== newInfo.pendingReceiveSat ||
    oldInfo.pendingSendSat !== newInfo.pendingSendSat ||
    oldInfo.nodeState?.id !== newInfo.nodeState?.id
  );
}

interface SdkEvent {
  type: string;
  details?: any;
}

const logInvalidTxid = (txId: string, details?: { type?: string }): void => {
  const txidLength = typeof txId === "string" ? txId.length : 0;
  const type = details?.type ?? "unknown";
  if (details?.type === "lightning") {
    console.info(
      "[WalletStore] Ignoring non-txid identifier from lightning event",
      { type, txidLength },
    );
    return;
  }
  console.warn("[WalletStore] Invalid txId detected", { type, txidLength });
};

const SAFE_ERROR_MESSAGES = new Set(["Password required to clear mnemonic"]);

const getSafeErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && SAFE_ERROR_MESSAGES.has(error.message)) {
    return error.message;
  }
  return fallback;
};

const logWalletError = (context: string, error: unknown): void => {
  console.error(`[WalletStore] ${context}:`, error);
};

interface Payment {
  id: string;
  paymentType: string;
  paymentTime: number;
  amountSat: number;
  feesSat: number;
  status: string;
}

// Wallet state interface
interface WalletState {
  isUnlocked: boolean;
  isInitialized: boolean;
  isConnecting: boolean;
  didCompleteInitialSync: boolean;
  info: GetInfoResponse | null;
  error: string | null;
}

// Polling state (defined early so lock/reset can access)
let eventListenerActive = false;
let pollUnsubscribe: (() => void) | null = null;

// Helper to clean up polling state (used by lock/reset)
const cleanupPolling = (): void => {
  if (pollUnsubscribe) {
    pollUnsubscribe();
    pollUnsubscribe = null;
  }
  stopPolling();
  clearTrackedTxs();
  eventListenerActive = false;
  console.log("[WalletStore] Polling cleanup complete");
};

// Create reactive wallet state
const createWalletState = (mnemonicStore?: any, passwordStore?: any) => {
  const { subscribe, set, update } = writable<WalletState>({
    isUnlocked: false,
    isInitialized: false,
    isConnecting: false,
    didCompleteInitialSync: false,
    info: null,
    error: null,
  });

  return {
    subscribe,
    set,
    update,

    // Initialize wallet store (SDK should already be connected by layout)
    async init(userPassword?: string, userId?: string): Promise<void> {
      update((state) => ({ ...state, isConnecting: true, error: null }));

      try {
        // SDK should already be initialized by layout, just get info
        // If not connected, the layout will handle it
        if (!walletService.isConnected()) {
          console.log(
            "[WalletStore] SDK not yet connected, skipping store init",
          );
          update((state) => ({
            ...state,
            isConnecting: false,
            isInitialized: false,
          }));
          return;
        }

        const info = await walletService.getWalletInfo();

        // Mark initial sync complete if we got valid info with balance data
        // This prevents showing loading placeholder when we already have balance
        const hasValidBalance = info?.walletInfo?.balanceSat !== undefined;

        update((state) => ({
          ...state,
          isUnlocked: true,
          isInitialized: true,
          isConnecting: false,
          didCompleteInitialSync:
            hasValidBalance || state.didCompleteInitialSync,
          info,
          error: null,
        }));

        // Start event listening
        await startEventListening();
      } catch (error) {
        const errorMessage = getSafeErrorMessage(
          error,
          "Failed to initialize wallet store",
        );
        logWalletError("Init failed", error);
        update((state) => ({
          ...state,
          isUnlocked: false,
          isConnecting: false,
          error: errorMessage,
        }));
        throw error;
      }
    },

    // Lock wallet
    async lock(): Promise<void> {
      try {
        await walletService.lockWallet();

        update((state) => ({
          ...state,
          isUnlocked: false,
          info: null,
          error: null,
        }));

        // Clear password from memory
        if (passwordStore) {
          passwordStore.set(undefined);
        }

        // Stop polling when wallet is locked
        cleanupPolling();
      } catch (error) {
        const errorMessage = getSafeErrorMessage(
          error,
          "Failed to lock wallet",
        );
        logWalletError("Lock failed", error);
        update((state) => ({ ...state, error: errorMessage }));
        throw error;
      }
    },

    // Unlock wallet with password
    async unlock(userPassword: string): Promise<void> {
      update((state) => ({ ...state, isConnecting: true, error: null }));

      try {
        await walletService.unlockWallet(userPassword);
        const info = await walletService.getWalletInfo();

        update((state) => ({
          ...state,
          isUnlocked: true,
          isConnecting: false,
          info,
          error: null,
        }));

        // Store password in memory for session
        if (passwordStore) {
          passwordStore.set(userPassword);
        }

        // Start event listening
        await startEventListening();
      } catch (error) {
        const errorMessage = getSafeErrorMessage(
          error,
          "Failed to unlock wallet",
        );
        logWalletError("Unlock failed", error);
        update((state) => ({
          ...state,
          isUnlocked: false,
          isConnecting: false,
          error: errorMessage,
        }));
        throw error;
      }
    },

    // Save mnemonic to secure storage
    async saveMnemonic(
      mnemonicPhrase: string,
      userPassword: string,
      userId?: string,
    ): Promise<void> {
      try {
        // Update main store if provided
        if (mnemonicStore) {
          mnemonicStore.set(mnemonicPhrase);
        }

        // Save to secure storage with password
        await walletService.saveMnemonic(mnemonicPhrase, userPassword, userId);
      } catch (error) {
        // If storage fails, clear the mnemonic from main store
        if (mnemonicStore) {
          mnemonicStore.set(null);
        }
        const errorMessage = getSafeErrorMessage(
          error,
          "Failed to save mnemonic",
        );
        logWalletError("Save mnemonic failed", error);
        update((state) => ({ ...state, error: errorMessage }));
        throw error;
      }
    },

    // Clear mnemonic from storage
    async clearMnemonic(userPassword?: string, userId?: string): Promise<void> {
      try {
        // Try to get password from passwordStore if not provided
        let password = userPassword;
        if (!password && passwordStore) {
          password = get(passwordStore);
        }

        // Try to get from secure session manager if still not available
        if (!password && typeof window !== "undefined") {
          password = sessionManager.getPassword(userId);
        }

        if (!password) {
          throw new Error("Password required to clear mnemonic");
        }

        await walletService.clearMnemonic(password, userId);
        if (mnemonicStore) {
          mnemonicStore.set(null);
        }
      } catch (error) {
        const errorMessage = getSafeErrorMessage(
          error,
          "Failed to clear mnemonic",
        );
        logWalletError("Clear mnemonic failed", error);
        update((state) => ({ ...state, error: errorMessage }));
        throw error;
      }
    },

    // Refresh wallet info (with deduplication)
    async refresh(): Promise<void> {
      try {
        const newInfo = await walletService.getWalletInfo();

        // Only update if data has actually changed (prevents unnecessary reactive updates)
        update((state) => {
          if (!hasWalletInfoChanged(state.info, newInfo)) {
            return state; // No change, don't trigger reactive updates
          }
          return { ...state, info: newInfo, error: null };
        });
      } catch (error) {
        const errorMessage = getSafeErrorMessage(
          error,
          "Failed to refresh wallet",
        );
        logWalletError("Refresh failed", error);
        update((state) => ({ ...state, error: errorMessage }));
        throw error;
      }
    },

    // Sync wallet - DEPRECATED: SDK handles syncing automatically
    // Keeping for backwards compatibility but just refreshes data
    async sync(): Promise<void> {
      try {
        // Don't manually call SDK sync - it handles this automatically
        // Just refresh our local state
        await this.refresh();
      } catch (error) {
        const errorMessage = getSafeErrorMessage(
          error,
          "Failed to refresh wallet",
        );
        logWalletError("Sync failed", error);
        update((state) => ({ ...state, error: errorMessage }));
        throw error;
      }
    },

    // Clear error
    clearError(): void {
      update((state) => ({ ...state, error: null }));
    },

    // Reset wallet store to initial state (for logout)
    reset(): void {
      // Stop polling when wallet is reset
      cleanupPolling();

      set({
        isUnlocked: false,
        isInitialized: false,
        isConnecting: false,
        didCompleteInitialSync: false,
        info: null,
        error: null,
      });
    },
  };
};

// Function to create wallet store with provided stores
export const createWalletStore = (mnemonicStore?: any, passwordStore?: any) => {
  return createWalletState(mnemonicStore, passwordStore);
};

// Initialize default wallet store
const initializeDefaultWalletStore = async () => {
  // Import stores dynamically to avoid circular imports
  const { mnemonic, password } = await import("../store");
  return createWalletState(mnemonic, password);
};

// Default wallet store instance
export const walletStore = createWalletState();

// Derived stores for specific state parts
export const isWalletUnlocked = derived(
  walletStore,
  ($wallet) => $wallet.isUnlocked,
);

export const walletInfo = derived(walletStore, ($wallet) => $wallet.info);

export const walletBalance = derived(
  walletInfo,
  ($info) => $info?.walletInfo?.balanceSat || 0,
);

export const assetBalances = derived(
  walletInfo,
  ($info) => $info?.walletInfo?.assetBalances || [],
);

export const isWalletConnecting = derived(
  walletStore,
  ($wallet) => $wallet.isConnecting,
);

export const walletError = derived(walletStore, ($wallet) => $wallet.error);

export const didCompleteInitialSync = derived(
  walletStore,
  ($wallet) => $wallet.didCompleteInitialSync,
);

export const isWalletLoading = derived(
  walletStore,
  ($wallet) => !$wallet.didCompleteInitialSync && $wallet.info === null,
);

// Transactions store
const createTransactionsStore = () => {
  const { subscribe, set, update } = writable<Payment[]>([]);

  return {
    subscribe,
    set, // Expose set method for direct updates

    async refresh(): Promise<void> {
      try {
        const transactions = await walletService.getTransactions();
        set(transactions);
      } catch (error) {
        console.error("Failed to refresh transactions:", error);
        throw error;
      }
    },

    // Add new transaction (called from event listener)
    add(payment: Payment): void {
      update((transactions) => [payment, ...transactions]);
    },

    // Reset transactions to empty array (for logout)
    reset(): void {
      set([]);
    },
  };
};

export const transactions = createTransactionsStore();

const startEventListening = async (): Promise<void> => {
  if (eventListenerActive) return;

  try {
    // addEventListener expects just the callback function, not a string first
    await walletService.addEventListener((event: SdkEvent) => {
      console.log("[WalletStore] Event received:", event.type, event);

      // Import paymentEvents dynamically to avoid circular dependencies
      import("./paymentEvents")
        .then(({ notifyPaymentReceived }) => {
          // Handle all payment state events
          switch (event.type) {
            // ===== INCOMING PAYMENT EVENTS (Lightning/Bitcoin/Liquid) =====

            // Lightning: lockup tx broadcast, claim tx will be broadcast when confirmed or zero-conf
            // Bitcoin: lockup tx seen and amount accepted, claim tx will be broadcast when confirmed or zero-conf
            case "paymentPending":
              console.log(
                "[WalletStore] Payment pending - lockup transaction broadcast",
              );
              // Track pending tx for fast polling (Breez SDK uses Liquid network)
              if (isValidTxid(event.details?.txId)) {
                trackPendingTx(event.details.txId, "liquid");
              } else if (event.details?.txId) {
                logInvalidTxid(event.details.txId, event.details);
              }
              walletStore.refresh();
              transactions.refresh();
              // Only notify if initial sync is complete (prevents showing stale pending payments)
              const currentState = get(walletStore);
              if (event.details && currentState.didCompleteInitialSync) {
                // Only show "Payment Received" notification for incoming payments
                if (event.details.paymentType === "receive") {
                  notifyPaymentReceived(event.details, "pending");
                } else {
                  console.log("[WalletStore] Outgoing payment pending");
                }
              } else {
                console.log(
                  "[WalletStore] Skipping notification - waiting for initial sync",
                );
              }
              break;

            // Lightning/Bitcoin: claim tx broadcast and waiting confirmation
            // Liquid: transaction seen (not yet confirmed)
            case "paymentWaitingConfirmation":
              console.log(
                "[WalletStore] Payment waiting confirmation - claim tx broadcast",
              );
              // Move from pending to confirming for normal polling (Breez SDK uses Liquid network)
              if (isValidTxid(event.details?.txId)) {
                trackConfirmingTx(event.details.txId, "liquid");
              } else if (event.details?.txId) {
                logInvalidTxid(event.details.txId, event.details);
              }
              walletStore.refresh();
              transactions.refresh();
              // Only show notifications and navigate after initial sync is complete
              const stateConfirmed = get(walletStore);
              if (event.details && stateConfirmed.didCompleteInitialSync) {
                // Only show "Payment Received" feedback for incoming payments
                if (event.details.paymentType === "receive") {
                  // Show successful payment feedback (as per Breez SDK UX guide)
                  notifyPaymentReceived(event.details, "confirmed");

                  // Navigate to success screen after short delay
                  // Import goto dynamically to avoid circular dependencies
                  import("$app/navigation")
                    .then(({ goto }) => {
                      setTimeout(() => {
                        goto("/payment-received");
                      }, 1000); // 1 second delay to let the payment event propagate
                    })
                    .catch((error) => {
                      console.error(
                        "[WalletStore] Failed to import navigation module:",
                        error,
                      );
                    });
                } else {
                  console.log(
                    "[WalletStore] Outgoing payment waiting confirmation",
                  );
                }
              } else {
                console.log(
                  "[WalletStore] Skipping notification - waiting for initial sync",
                );
              }
              break;

            // All methods: transaction is confirmed - payment complete!
            case "paymentSucceeded":
              // Mark tx as confirmed - can slow down polling
              if (isValidTxid(event.details?.txId)) {
                markTxConfirmed(event.details.txId);
              } else if (event.details?.txId) {
                logInvalidTxid(event.details.txId, event.details);
              }
              walletStore.refresh();
              transactions.refresh();
              // Only notify after initial sync is complete
              const stateComplete = get(walletStore);
              if (event.details && stateComplete.didCompleteInitialSync) {
                // Only show "Payment Received" notification for incoming payments
                if (event.details.paymentType === "receive") {
                  notifyPaymentReceived(event.details, "complete");
                } else {
                  console.log("[WalletStore] Outgoing payment succeeded");
                }
              } else {
                console.log(
                  "[WalletStore] Skipping notification - waiting for initial sync",
                );
              }
              break;

            // Payment failed (swap expired, fee not accepted, lockup tx failed)
            case "paymentFailed":
              // Clear tracking for failed tx
              if (isValidTxid(event.details?.txId)) {
                markTxConfirmed(event.details.txId);
              } else if (event.details?.txId) {
                logInvalidTxid(event.details.txId, event.details);
              }
              walletStore.refresh();
              transactions.refresh();
              break;

            // Bitcoin only: needs fee acceptance for amountless swaps
            case "paymentWaitingFeeAcceptance":
              console.log(
                "[WalletStore] Payment waiting fee acceptance (Bitcoin amountless swap)",
              );
              walletStore.refresh();
              transactions.refresh();
              // Only notify after initial sync is complete
              const stateFee = get(walletStore);
              if (event.details && stateFee.didCompleteInitialSync) {
                notifyPaymentReceived(event.details, "fee_acceptance");
              } else {
                console.log(
                  "[WalletStore] Skipping notification - waiting for initial sync",
                );
              }
              break;

            // Bitcoin only: swap failed but lockup tx was broadcast, needs refund
            case "paymentRefundable":
              console.log(
                "[WalletStore] Payment refundable - Bitcoin lockup needs refund",
              );
              walletStore.refresh();
              transactions.refresh();
              import("$lib/stores/refundables")
                .then(({ refundablesStore }) => {
                  refundablesStore.refresh();
                })
                .catch((error) => {
                  console.error(
                    "[WalletStore] Failed to import refundables store:",
                    error,
                  );
                });
              break;

            // Refund Events
            case "paymentRefundPending":
              console.log("[WalletStore] Payment refund pending");
              walletStore.refresh();
              transactions.refresh();
              import("$lib/stores/refundables")
                .then(({ refundablesStore }) => {
                  refundablesStore.refresh();
                })
                .catch((error) => {
                  console.error(
                    "[WalletStore] Failed to import refundables store:",
                    error,
                  );
                });
              break;

            case "paymentRefunded":
              console.log("[WalletStore] Payment refunded");
              walletStore.refresh();
              transactions.refresh();
              import("$lib/stores/refundables")
                .then(({ refundablesStore }) => {
                  refundablesStore.refresh();
                })
                .catch((error) => {
                  console.error(
                    "[WalletStore] Failed to import refundables store:",
                    error,
                  );
                });
              break;

            // Sync Events
            case "synced":
              walletStore.update((state) => ({
                ...state,
                didCompleteInitialSync: true,
              }));
              walletStore.refresh();
              transactions.refresh();
              import("$lib/stores/refundables")
                .then(({ refundablesStore }) => {
                  refundablesStore.refresh();
                })
                .catch((error) => {
                  console.error(
                    "[WalletStore] Failed to import refundables store:",
                    error,
                  );
                });
              break;

            default:
              console.log("[WalletStore] Unhandled event:", event.type);
          }
        })
        .catch((err) => {
          console.error("[WalletStore] Failed to import paymentEvents:", err);
        });
    });

    eventListenerActive = true;
    console.log("[WalletStore] Event listening started");

    // Register with PollManager for coordinated polling
    if (!pollUnsubscribe && typeof window !== "undefined") {
      pollUnsubscribe = onRefresh(async () => {
        try {
          // Only refresh if SDK is connected
          if (walletService.isConnected()) {
            console.log("[WalletStore] PollManager refresh");
            await walletStore.refresh();
            await transactions.refresh();
          }
        } catch (error) {
          console.error("[WalletStore] PollManager refresh failed:", error);
        }
      });

      // Start the poll manager
      startPolling();
      console.log("[WalletStore] Registered with PollManager");
    }
  } catch (error) {
    console.error("[WalletStore] Failed to start event listening:", error);
  }
};

// Auto-lock timer integration
export const resetWalletTimer = (): void => {
  walletService.resetLockTimer();
};

// Check if storage is unlocked (for initialization)
export const checkStorageUnlocked = (): boolean => {
  return walletService.isStorageUnlocked();
};

// Payment operations (wrapped with reactive updates)
export const walletOperations = {
  async parseInput(input: string) {
    return await walletService.parseInput(input);
  },

  async prepareSendPayment(params: any) {
    return await walletService.prepareSendPayment(params);
  },

  async sendPayment(params: any) {
    const result = await walletService.sendPayment(params);
    // Refresh wallet state after payment
    await walletStore.refresh();
    await transactions.refresh();
    return result;
  },

  async prepareReceivePayment(params: any) {
    return await walletService.prepareReceivePayment(params);
  },

  async receivePayment(params: any) {
    const result = await walletService.receivePayment(params);
    // Refresh wallet state after receiving payment
    await walletStore.refresh();
    await transactions.refresh();
    return result;
  },

  async fetchLightningLimits() {
    return await walletService.fetchLightningLimits();
  },

  async fetchFiatRates() {
    return await walletService.fetchFiatRates();
  },

  async generateMnemonic() {
    return await walletService.generateMnemonic();
  },

  async validateMnemonic(mnemonicPhrase: string) {
    return await walletService.validateMnemonic(mnemonicPhrase);
  },
};
