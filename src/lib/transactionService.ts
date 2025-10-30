import * as breezSdk from '@breeztech/breez-sdk-liquid/web';
import { writable, derived, get } from 'svelte/store';
import * as walletService from './walletService';

// Transaction filtering and pagination
export interface TransactionFilter {
  startDate?: Date;
  endDate?: Date;
  type?: 'send' | 'receive' | 'swap' | 'all';
  status?: 'pending' | 'complete' | 'failed' | 'all';
  searchText?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: 'time' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionPage {
  transactions: breezSdk.Payment[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Enhanced payment with additional UI fields
export interface EnhancedPayment extends breezSdk.Payment {
  id: string; // Ensure id field exists
  displayAmount: number; // Positive for receive, negative for send
  fiatAmount?: number;
  fiatCurrency?: string;
  statusColor?: string;
  statusIcon?: string;
  isRefundable?: boolean;
  refundDetails?: any;
  lnurlInfo?: any;
  bip353Address?: string;
}

// Transaction cache using IndexedDB
class TransactionCache {
  private dbName = 'dgen_transactions';
  private storeName = 'payments';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('paymentTime', 'paymentTime');
          store.createIndex('paymentType', 'paymentType');
          store.createIndex('status', 'status');
          store.createIndex('amountSat', 'amountSat');
        }
      };
    });
  }

  async saveTransactions(transactions: breezSdk.Payment[]): Promise<void> {
    await this.init();
    if (!this.db) return;

    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    for (const tx of transactions) {
      // Ensure each transaction has an id field for IndexedDB
      const txWithId = {
        ...tx,
        id: tx.id || tx.paymentHash || tx.details?.paymentHash || `payment_${Date.now()}_${Math.random()}`
      };
      store.put(txWithId);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getTransactions(filter?: TransactionFilter): Promise<breezSdk.Payment[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        let results = request.result as breezSdk.Payment[];

        // Apply filters
        if (filter) {
          if (filter.type && filter.type !== 'all') {
            results = results.filter(tx =>
              filter.type === 'send' ? tx.paymentType === 'send' :
              filter.type === 'receive' ? tx.paymentType === 'receive' :
              tx.details?.swapInfo !== undefined
            );
          }

          if (filter.status && filter.status !== 'all') {
            results = results.filter(tx => tx.status === filter.status);
          }

          if (filter.startDate) {
            const startTime = Math.floor(filter.startDate.getTime() / 1000);
            results = results.filter(tx => tx.paymentTime >= startTime);
          }

          if (filter.endDate) {
            const endTime = Math.floor(filter.endDate.getTime() / 1000);
            results = results.filter(tx => tx.paymentTime <= endTime);
          }

          if (filter.minAmount) {
            results = results.filter(tx => tx.amountSat >= filter.minAmount);
          }

          if (filter.maxAmount) {
            results = results.filter(tx => tx.amountSat <= filter.maxAmount);
          }

          if (filter.searchText) {
            const search = filter.searchText.toLowerCase();
            results = results.filter(tx => {
              const description = tx.details?.description?.toLowerCase() || '';
              const destination = tx.details?.destination?.toLowerCase() || '';
              const paymentHash = tx.details?.paymentHash?.toLowerCase() || '';
              return description.includes(search) ||
                     destination.includes(search) ||
                     paymentHash.includes(search);
            });
          }
        }

        resolve(results);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;

    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    store.clear();

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// Initialize cache
const cache = new TransactionCache();

// Transaction store with filtering and pagination
function createTransactionStore() {
  const { subscribe, set, update } = writable<{
    allTransactions: EnhancedPayment[];
    filteredTransactions: EnhancedPayment[];
    currentPage: TransactionPage | null;
    filter: TransactionFilter;
    pagination: PaginationOptions;
    isLoading: boolean;
    error: string | null;
    lastSync: number;
    fiatRates: Map<string, number>;
  }>({
    allTransactions: [],
    filteredTransactions: [],
    currentPage: null,
    filter: {},
    pagination: { page: 1, limit: 50, sortBy: 'time', sortOrder: 'desc' },
    isLoading: false,
    error: null,
    lastSync: 0,
    fiatRates: new Map([['USD', 50000]]) // Default rate
  });

  // Payment tracking for specific invoices
  const trackedPayments = new Map<string, (payment: breezSdk.Payment) => void>();

  return {
    subscribe,

    // Load transactions with caching
    async loadTransactions(forceRefresh = false): Promise<void> {
      update(state => ({ ...state, isLoading: true, error: null }));

      try {
        let transactions: breezSdk.Payment[] = [];

        // Try cache first if not forcing refresh
        if (!forceRefresh) {
          transactions = await cache.getTransactions();
        }

        // Fetch from SDK if cache is empty or forcing refresh
        if (transactions.length === 0 || forceRefresh) {
          // Check if SDK is connected
          if (walletService.isConnected()) {
            // Get current filter state to pass timestamps to SDK
            const currentState = get({ subscribe });
            const filter = currentState.filter;

            // Build SDK filter with timestamps (in seconds, not milliseconds)
            const sdkFilter: any = {};
            if (filter.startDate) {
              sdkFilter.fromTimestamp = Math.floor(filter.startDate.getTime() / 1000);
            }
            if (filter.endDate) {
              sdkFilter.toTimestamp = Math.floor(filter.endDate.getTime() / 1000);
            }

            transactions = await walletService.getTransactions(sdkFilter);
            // Only log on initial load or significant changes
            if (transactions.length === 0 || forceRefresh) {
              console.log('[Transactions] Loaded', transactions.length, 'transactions');
            }

            // Save to cache
            await cache.saveTransactions(transactions);
          }
        }

        // Fetch current fiat rates
        let rates = new Map<string, number>();
        try {
          if (walletService.isConnected()) {
            const fiatRates = await walletService.fetchFiatRates();
            fiatRates.forEach(rate => {
              rates.set(rate.coin.toUpperCase(), rate.value);
            });
          }
        } catch (e) {
          console.warn('Failed to fetch fiat rates, using defaults');
        }

        // Enhance transactions with additional fields
        const enhanced = transactions.map(tx => enhancePayment(tx, rates));

        update(state => ({
          ...state,
          allTransactions: enhanced,
          isLoading: false,
          lastSync: Date.now(),
          fiatRates: rates
        }));

        // Apply current filter (for client-side filtering of type, status, search)
        const currentState = get({ subscribe });
        this.applyFilter(currentState.filter);

      } catch (error) {
        console.error('Failed to load transactions:', error);
        update(state => ({
          ...state,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load transactions'
        }));
      }
    },

    // Apply filter to transactions
    applyFilter(filter: TransactionFilter): void {
      update(state => {
        const filtered = filterTransactions(state.allTransactions, filter);
        const page = paginateTransactions(filtered, state.pagination);

        return {
          ...state,
          filter,
          filteredTransactions: filtered,
          currentPage: page
        };
      });
    },

    // Update pagination
    setPagination(options: Partial<PaginationOptions>): void {
      update(state => {
        const newPagination = { ...state.pagination, ...options };
        const page = paginateTransactions(state.filteredTransactions, newPagination);

        return {
          ...state,
          pagination: newPagination,
          currentPage: page
        };
      });
    },

    // Add new transaction (optimistic update)
    addTransaction(payment: breezSdk.Payment, optimistic = false): void {
      update(state => {
        const enhanced = enhancePayment(payment, state.fiatRates);

        // Mark as pending if optimistic
        if (optimistic) {
          enhanced.status = 'pending';
        }

        const allTransactions = [enhanced, ...state.allTransactions];
        const filtered = filterTransactions(allTransactions, state.filter);
        const page = paginateTransactions(filtered, state.pagination);

        // Save to cache
        cache.saveTransactions([payment]);

        return {
          ...state,
          allTransactions,
          filteredTransactions: filtered,
          currentPage: page
        };
      });
    },

    // Update transaction status
    updateTransaction(paymentId: string, updates: Partial<breezSdk.Payment>): void {
      update(state => {
        const allTransactions = state.allTransactions.map(tx =>
          tx.id === paymentId ? { ...tx, ...updates } : tx
        );

        const filtered = filterTransactions(allTransactions, state.filter);
        const page = paginateTransactions(filtered, state.pagination);

        return {
          ...state,
          allTransactions,
          filteredTransactions: filtered,
          currentPage: page
        };
      });
    },

    // Track specific payment by invoice
    trackPayment(invoice: string, callback: (payment: breezSdk.Payment) => void): void {
      trackedPayments.set(invoice, callback);
    },

    // Stop tracking payment
    untrackPayment(invoice: string): void {
      trackedPayments.delete(invoice);
    },

    // Handle incoming payment event
    handlePaymentEvent(payment: breezSdk.Payment): void {
      // Check if this payment is being tracked
      const invoice = payment.details?.invoice;
      if (invoice && trackedPayments.has(invoice)) {
        const callback = trackedPayments.get(invoice);
        if (callback) {
          callback(payment);
          trackedPayments.delete(invoice);
        }
      }

      // Update or add transaction
      const currentState = get({ subscribe });
      const existing = currentState.allTransactions.find(tx => tx.id === payment.id);

      if (existing) {
        this.updateTransaction(payment.id, payment);
      } else {
        this.addTransaction(payment);
      }
    },

    // Clear all data
    async clear(): Promise<void> {
      await cache.clear();
      set({
        allTransactions: [],
        filteredTransactions: [],
        currentPage: null,
        filter: {},
        pagination: { page: 1, limit: 50, sortBy: 'time', sortOrder: 'desc' },
        isLoading: false,
        error: null,
        lastSync: 0,
        fiatRates: new Map([['USD', 50000]])
      });
    }
  };
}

// Helper functions
function enhancePayment(payment: breezSdk.Payment, fiatRates: Map<string, number>): EnhancedPayment {
  // Normalize timestamp field first
  const paymentTime = (payment as any).paymentTime || (payment as any).timestamp || 0;

  // Create a deterministic ID based on payment data
  // Priority: txId > paymentHash > details.paymentHash > deterministic fallback
  let id = payment.txId ||
           payment.paymentHash ||
           payment.details?.paymentHash;

  // If still no ID (rare case), create deterministic ID from payment data
  if (!id) {
    id = `payment_${paymentTime}_${payment.amountSat}_${payment.paymentType}`;
  }

  const enhanced: EnhancedPayment = {
    ...payment,
    paymentTime,
    id,
    displayAmount: payment.paymentType === 'receive' ? payment.amountSat : -payment.amountSat,
    fiatAmount: undefined,
    fiatCurrency: 'USD',
    statusColor: getStatusColor(payment.status),
    statusIcon: getStatusIcon(payment.status),
    isRefundable: payment.status === 'failed' && payment.details?.swapInfo !== undefined,
    refundDetails: payment.details?.refundDetails,
    lnurlInfo: payment.details?.lnurlInfo,
    bip353Address: payment.details?.bip353Address
  };

  // Calculate fiat amount
  const rate = fiatRates.get('USD') || 50000;
  enhanced.fiatAmount = (payment.amountSat / 100000000) * rate;

  return enhanced;
}

function filterTransactions(
  transactions: EnhancedPayment[],
  filter: TransactionFilter
): EnhancedPayment[] {
  let filtered = [...transactions];

  if (filter.type && filter.type !== 'all') {
    filtered = filtered.filter(tx => {
      if (filter.type === 'send') return tx.paymentType === 'send';
      if (filter.type === 'receive') return tx.paymentType === 'receive';
      if (filter.type === 'swap') return tx.details?.swapInfo !== undefined;
      return true;
    });
  }

  if (filter.status && filter.status !== 'all') {
    filtered = filtered.filter(tx => tx.status === filter.status);
  }

  if (filter.startDate) {
    const startTime = Math.floor(filter.startDate.getTime() / 1000);
    filtered = filtered.filter(tx => tx.paymentTime >= startTime);
  }

  if (filter.endDate) {
    const endTime = Math.floor(filter.endDate.getTime() / 1000);
    filtered = filtered.filter(tx => tx.paymentTime <= endTime);
  }

  if (filter.minAmount) {
    filtered = filtered.filter(tx => tx.amountSat >= filter.minAmount);
  }

  if (filter.maxAmount) {
    filtered = filtered.filter(tx => tx.amountSat <= filter.maxAmount);
  }

  if (filter.searchText) {
    const search = filter.searchText.toLowerCase();
    filtered = filtered.filter(tx => {
      const description = tx.details?.description?.toLowerCase() || '';
      const destination = tx.details?.destination?.toLowerCase() || '';
      const paymentHash = tx.details?.paymentHash?.toLowerCase() || '';
      const invoice = tx.details?.invoice?.toLowerCase() || '';
      return description.includes(search) ||
             destination.includes(search) ||
             paymentHash.includes(search) ||
             invoice.includes(search);
    });
  }

  return filtered;
}

function paginateTransactions(
  transactions: EnhancedPayment[],
  options: PaginationOptions
): TransactionPage {
  // Sort transactions
  const sorted = [...transactions].sort((a, b) => {
    let compareValue = 0;

    if (options.sortBy === 'time') {
      compareValue = a.paymentTime - b.paymentTime;
    } else if (options.sortBy === 'amount') {
      compareValue = a.amountSat - b.amountSat;
    }

    return options.sortOrder === 'desc' ? -compareValue : compareValue;
  });

  // Calculate pagination
  const totalCount = sorted.length;
  const totalPages = Math.ceil(totalCount / options.limit);
  const currentPage = Math.min(options.page, totalPages) || 1;
  const startIndex = (currentPage - 1) * options.limit;
  const endIndex = startIndex + options.limit;

  return {
    transactions: sorted.slice(startIndex, endIndex),
    totalCount,
    totalPages,
    currentPage,
    hasNext: currentPage < totalPages,
    hasPrevious: currentPage > 1
  };
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'complete':
    case 'success':
      return 'text-green-500';
    case 'pending':
    case 'waitingConfirmation':
    case 'waitingFeeAcceptance':
      return 'text-yellow-500';
    case 'failed':
      return 'text-red-500';
    case 'refundable':
    case 'refundPending':
      return 'text-orange-500';
    case 'refunded':
      return 'text-blue-500';
    default:
      return 'text-gray-500';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'complete':
    case 'success':
      return 'ph:check-circle';
    case 'pending':
    case 'waitingConfirmation':
      return 'ph:clock';
    case 'waitingFeeAcceptance':
      return 'ph:currency-dollar';
    case 'failed':
      return 'ph:x-circle';
    case 'refundable':
    case 'refundPending':
      return 'ph:arrow-counter-clockwise';
    case 'refunded':
      return 'ph:arrow-u-up-left';
    default:
      return 'ph:question';
  }
}

// Export singleton store
export const transactionStore = createTransactionStore();

// Export derived stores for easy access
export const allTransactions = derived(
  transactionStore,
  $store => $store.allTransactions
);

export const currentTransactionPage = derived(
  transactionStore,
  $store => $store.currentPage
);

export const isLoadingTransactions = derived(
  transactionStore,
  $store => $store.isLoading
);

export const transactionError = derived(
  transactionStore,
  $store => $store.error
);

// Auto-refresh transactions on SDK events
export async function initTransactionEventHandling(): Promise<void> {
  try {
    // Check if SDK is connected first
    if (!walletService.isConnected()) {
      throw new Error('SDK not initialized');
    }

    await walletService.addEventListener((event: breezSdk.SdkEvent) => {
      // Handle all payment state events based on Breez SDK event flows
      switch (event.type) {
        // Send Payment Events (Lightning, Bitcoin, Liquid)
        case 'paymentPending':
        case 'paymentWaitingConfirmation':
          handlePaymentUpdate(event);
          break;

        case 'paymentSucceeded':
          handlePaymentUpdate(event);
          transactionStore.loadTransactions(true);
          break;

        case 'paymentFailed':
          handlePaymentUpdate(event);
          transactionStore.loadTransactions(true);
          break;

        case 'paymentRefundPending':
          handlePaymentUpdate(event);
          break;

        case 'paymentRefunded':
          handlePaymentUpdate(event);
          transactionStore.loadTransactions(true);
          break;

        case 'paymentWaitingFeeAcceptance':
        case 'paymentRefundable':
          handlePaymentUpdate(event);
          break;

        case 'synced':

          // Mark initial sync as complete
          import('$lib/stores/wallet').then(({ walletStore }) => {
            walletStore.update(state => ({
              ...state,
              didCompleteInitialSync: true
            }));
          });

          // Load transactions after sync completes (with decrypted metadata)
          transactionStore.loadTransactions(true);
          break;

        case 'dataSynced':
          const didPull = (event as any).didPullNewRecords;

          // Import wallet store dynamically to avoid circular dependencies
          import('$lib/stores/wallet').then(async ({ walletStore }) => {
            try {
              const info = await walletService.getWalletInfo();
              walletStore.update(state => ({
                ...state,
                isConnecting: false,
                didCompleteInitialSync: true,
                info: info || state.info,
                error: null
              }));
            } catch (e) {
              console.error('[TransactionService] Failed to load wallet info after data sync:', e);
            }
          });

          // Refresh transactions to get correct payment types
          if (didPull) {
            transactionStore.loadTransactions(true);
          }
          break;

        default:
          break;
      }
    });
  } catch (error) {
    console.error('[TransactionService] Failed to init event handling:', error);
    throw error;
  }
}

// Helper function to handle payment updates from events
function handlePaymentUpdate(event: breezSdk.SdkEvent): void {
  const payment = (event as any).details;
  if (payment) {
    transactionStore.handlePaymentEvent(payment);
  }
}