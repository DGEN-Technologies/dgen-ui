import { writable, derived, get } from 'svelte/store';
import * as walletService from '../walletService';
import { sessionManager } from '../security/sessionManager';

// Define interfaces locally to avoid import issues
interface GetInfoResponse {
  nodeState: any;
  balanceSat: number;
  pendingReceiveSat: number;
  pendingSendSat: number;
}

// Helper to check if wallet info has meaningfully changed (inspired by misty-breez's .distinct())
function hasWalletInfoChanged(oldInfo: GetInfoResponse | null, newInfo: GetInfoResponse | null): boolean {
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

// Create reactive wallet state
const createWalletState = (mnemonicStore?: any, passwordStore?: any) => {
  const { subscribe, set, update } = writable<WalletState>({
    isUnlocked: false,
    isInitialized: false,
    isConnecting: false,
    didCompleteInitialSync: false,
    info: null,
    error: null
  });

  return {
    subscribe,
    set,
    update,
    
    // Initialize wallet store (SDK should already be connected by layout)
    async init(userPassword?: string, userId?: string): Promise<void> {
      update(state => ({ ...state, isConnecting: true, error: null }));
      
      try {
        // SDK should already be initialized by layout, just get info
        // If not connected, the layout will handle it
        if (!walletService.isConnected()) {
          console.log('[WalletStore] SDK not yet connected, skipping store init');
          update(state => ({
            ...state,
            isConnecting: false,
            isInitialized: false
          }));
          return;
        }
        
        const info = await walletService.getWalletInfo();
        
        update(state => ({
          ...state,
          isUnlocked: true,
          isInitialized: true,
          isConnecting: false,
          info,
          error: null
        }));
        
        // Start event listening
        await startEventListening();
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize wallet store';
        update(state => ({
          ...state,
          isUnlocked: false,
          isConnecting: false,
          error: errorMessage
        }));
        throw error;
      }
    },

    // Lock wallet
    async lock(): Promise<void> {
      try {
        await walletService.lockWallet();
        
        update(state => ({
          ...state,
          isUnlocked: false,
          info: null,
          error: null
        }));
        
        // Clear password from memory
        if (passwordStore) {
          passwordStore.set(undefined);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to lock wallet';
        update(state => ({ ...state, error: errorMessage }));
        throw error;
      }
    },

    // Unlock wallet with password
    async unlock(userPassword: string): Promise<void> {
      update(state => ({ ...state, isConnecting: true, error: null }));
      
      try {
        await walletService.unlockWallet(userPassword);
        const info = await walletService.getWalletInfo();
        
        update(state => ({
          ...state,
          isUnlocked: true,
          isConnecting: false,
          info,
          error: null
        }));
        
        // Store password in memory for session
        if (passwordStore) {
          passwordStore.set(userPassword);
        }
        
        // Start event listening
        await startEventListening();
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to unlock wallet';
        update(state => ({
          ...state,
          isUnlocked: false,
          isConnecting: false,
          error: errorMessage
        }));
        throw error;
      }
    },

    // Save mnemonic to secure storage
    async saveMnemonic(mnemonicPhrase: string, userPassword: string, userId?: string): Promise<void> {
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
        const errorMessage = error instanceof Error ? error.message : 'Failed to save mnemonic';
        update(state => ({ ...state, error: errorMessage }));
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
        if (!password && typeof window !== 'undefined') {
          password = sessionManager.getPassword(userId);
        }

        if (!password) {
          throw new Error('Password required to clear mnemonic');
        }

        await walletService.clearMnemonic(password, userId);
        if (mnemonicStore) {
          mnemonicStore.set(null);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to clear mnemonic';
        update(state => ({ ...state, error: errorMessage }));
        throw error;
      }
    },

    // Refresh wallet info (with deduplication)
    async refresh(): Promise<void> {
      try {
        const newInfo = await walletService.getWalletInfo();

        // Only update if data has actually changed (prevents unnecessary reactive updates)
        update(state => {
          if (!hasWalletInfoChanged(state.info, newInfo)) {
            return state; // No change, don't trigger reactive updates
          }
          return { ...state, info: newInfo, error: null };
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to refresh wallet';
        update(state => ({ ...state, error: errorMessage }));
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
        const errorMessage = error instanceof Error ? error.message : 'Failed to refresh wallet';
        update(state => ({ ...state, error: errorMessage }));
        throw error;
      }
    },

    // Clear error
    clearError(): void {
      update(state => ({ ...state, error: null }));
    },

    // Reset wallet store to initial state (for logout)
    reset(): void {
      set({
        isUnlocked: false,
        isInitialized: false,
        isConnecting: false,
        didCompleteInitialSync: false,
        info: null,
        error: null
      });
    }
  };
};

// Function to create wallet store with provided stores
export const createWalletStore = (mnemonicStore?: any, passwordStore?: any) => {
  return createWalletState(mnemonicStore, passwordStore);
};

// Initialize default wallet store
const initializeDefaultWalletStore = async () => {
  // Import stores dynamically to avoid circular imports
  const { mnemonic, password } = await import('../store');
  return createWalletState(mnemonic, password);
};

// Default wallet store instance
export const walletStore = createWalletState();

// Derived stores for specific state parts
export const isWalletUnlocked = derived(
  walletStore,
  $wallet => $wallet.isUnlocked
);

export const walletInfo = derived(
  walletStore,
  $wallet => $wallet.info
);

export const walletBalance = derived(
  walletInfo,
  $info => $info?.walletInfo?.balanceSat || 0
);

export const assetBalances = derived(
  walletInfo,
  $info => $info?.walletInfo?.assetBalances || []
);

export const isWalletConnecting = derived(
  walletStore,
  $wallet => $wallet.isConnecting
);

export const walletError = derived(
  walletStore,
  $wallet => $wallet.error
);


export const didCompleteInitialSync = derived(
  walletStore,
  $wallet => $wallet.didCompleteInitialSync
);

export const isWalletLoading = derived(
  walletStore,
  $wallet => !$wallet.didCompleteInitialSync && $wallet.info === null
);

// Transactions store
const createTransactionsStore = () => {
  const { subscribe, set, update } = writable<Payment[]>([]);

  return {
    subscribe,
    set,  // Expose set method for direct updates

    async refresh(): Promise<void> {
      try {
        const transactions = await walletService.getTransactions();
        set(transactions);
      } catch (error) {
        console.error('Failed to refresh transactions:', error);
        throw error;
      }
    },

    // Add new transaction (called from event listener)
    add(payment: Payment): void {
      update(transactions => [payment, ...transactions]);
    },

    // Reset transactions to empty array (for logout)
    reset(): void {
      set([]);
    }
  };
};

export const transactions = createTransactionsStore();

// Event handling
let eventListenerActive = false;
let pollingInterval: ReturnType<typeof setInterval> | null = null;

const startEventListening = async (): Promise<void> => {
  if (eventListenerActive) return;

  try {
    // addEventListener expects just the callback function, not a string first
    await walletService.addEventListener((event: SdkEvent) => {
      console.log('[WalletStore] Event received:', event.type, event);

      // Import paymentEvents dynamically to avoid circular dependencies
      import('./paymentEvents').then(({ notifyPaymentReceived }) => {
        // Handle all payment state events
        switch (event.type) {
          // ===== INCOMING PAYMENT EVENTS (Lightning/Bitcoin/Liquid) =====

          // Lightning: lockup tx broadcast, claim tx will be broadcast when confirmed or zero-conf
          // Bitcoin: lockup tx seen and amount accepted, claim tx will be broadcast when confirmed or zero-conf
          case 'paymentPending':
            console.log('[WalletStore] Payment pending - lockup transaction broadcast');
            walletStore.refresh();
            transactions.refresh();
            // Notify UI about pending incoming payment
            if (event.details) {
              notifyPaymentReceived(event.details, 'pending');
            }
            break;

          // Lightning/Bitcoin: claim tx broadcast and waiting confirmation
          // Liquid: transaction seen (not yet confirmed)
          case 'paymentWaitingConfirmation':
            console.log('[WalletStore] Payment waiting confirmation - claim tx broadcast');
            walletStore.refresh();
            transactions.refresh();
            // Show successful payment feedback (as per Breez SDK UX guide)
            if (event.details) {
              notifyPaymentReceived(event.details, 'confirmed');

              // Navigate to success screen after short delay
              // Import goto dynamically to avoid circular dependencies
              import('$app/navigation').then(({ goto }) => {
                setTimeout(() => {
                  goto('/payment-received');
                }, 1000); // 1 second delay to let the payment event propagate
              });
            }
            break;

          // All methods: transaction is confirmed - payment complete!
          case 'paymentSucceeded':
            walletStore.refresh();
            transactions.refresh();
            // Show payment as complete
            if (event.details) {
              notifyPaymentReceived(event.details, 'complete');
            }
            break;

          // Payment failed (swap expired, fee not accepted, lockup tx failed)
          case 'paymentFailed':
            walletStore.refresh();
            transactions.refresh();
            break;

          // Bitcoin only: needs fee acceptance for amountless swaps
          case 'paymentWaitingFeeAcceptance':
            console.log('[WalletStore] Payment waiting fee acceptance (Bitcoin amountless swap)');
            walletStore.refresh();
            transactions.refresh();
            // Allow user to review fees
            if (event.details) {
              notifyPaymentReceived(event.details, 'fee_acceptance');
            }
            break;

          // Bitcoin only: swap failed but lockup tx was broadcast, needs refund
          case 'paymentRefundable':
            console.log('[WalletStore] Payment refundable - Bitcoin lockup needs refund');
            walletStore.refresh();
            transactions.refresh();
            break;

          // Refund Events
          case 'paymentRefundPending':
            console.log('[WalletStore] Payment refund pending');
            walletStore.refresh();
            transactions.refresh();
            break;

          case 'paymentRefunded':
            console.log('[WalletStore] Payment refunded');
            walletStore.refresh();
            transactions.refresh();
            break;

          // Sync Events
          case 'synced':
            walletStore.update(state => ({
              ...state,
              didCompleteInitialSync: true
            }));
            walletStore.refresh();
            transactions.refresh();
            break;

          default:
            console.log('[WalletStore] Unhandled event:', event.type);
        }
      }).catch(err => {
        console.error('[WalletStore] Failed to import paymentEvents:', err);
      });
    });

    eventListenerActive = true;
    console.log('[WalletStore] Event listening started');

    // Start polling fallback (60s interval like misty-breez)
    if (!pollingInterval && typeof window !== 'undefined') {
      pollingInterval = setInterval(async () => {
        try {
          // Only refresh if page is visible and SDK is connected
          if (!document.hidden && walletService.isConnected()) {
            console.log('[WalletStore] Polling refresh (60s fallback)');
            await walletStore.refresh();
            await transactions.refresh();
          }
        } catch (error) {
          console.error('[WalletStore] Polling refresh failed:', error);
        }
      }, 60000); // 60 seconds
      console.log('[WalletStore] Polling started (60s interval)');
    }

  } catch (error) {
    console.error('[WalletStore] Failed to start event listening:', error);
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
  }
};

