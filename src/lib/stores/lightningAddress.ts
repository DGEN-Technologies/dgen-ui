import { writable, derived } from 'svelte/store';

/**
 * Lightning Address state management - inspired by misty-breez
 */

export enum LnAddressStatus {
  Initial = 'initial',
  Loading = 'loading',
  Success = 'success',
  Error = 'error'
}

export enum UpdateStatus {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error'
}

export interface LnAddressUpdateStatus {
  status: UpdateStatus;
  error?: Error;
  errorMessage?: string;
}

export interface LnAddressState {
  lnurl: string | null;
  lnAddress: string | null;
  bip353Address: string | null;
  status: LnAddressStatus;
  updateStatus: LnAddressUpdateStatus;
  error: Error | null;
}

const initialState: LnAddressState = {
  lnurl: null,
  lnAddress: null,
  bip353Address: null,
  status: LnAddressStatus.Initial,
  updateStatus: { status: UpdateStatus.Idle },
  error: null
};

// Create the writable store
function createLnAddressStore() {
  const { subscribe, set, update } = writable<LnAddressState>(initialState);

  return {
    subscribe,

    // Set loading state for new registration or recovery
    setLoading: () => update(state => ({
      ...state,
      status: LnAddressStatus.Loading,
      error: null
    })),

    // Set loading state for username update
    setUpdateLoading: () => update(state => ({
      ...state,
      updateStatus: { status: UpdateStatus.Loading }
    })),

    // Set success state
    setSuccess: (lnurl: string, lnAddress: string, bip353Address?: string) => update(state => ({
      ...state,
      lnurl,
      lnAddress,
      bip353Address: bip353Address || null,
      status: LnAddressStatus.Success,
      error: null
    })),

    // Set update success
    setUpdateSuccess: (lnurl: string, lnAddress: string, bip353Address?: string) => update(state => ({
      ...state,
      lnurl,
      lnAddress,
      bip353Address: bip353Address || null,
      updateStatus: { status: UpdateStatus.Success }
    })),

    // Set error state
    setError: (error: Error) => update(state => ({
      ...state,
      status: LnAddressStatus.Error,
      error
    })),

    // Set update error
    setUpdateError: (error: Error, errorMessage?: string) => update(state => ({
      ...state,
      updateStatus: {
        status: UpdateStatus.Error,
        error,
        errorMessage: errorMessage || error.message
      }
    })),

    // Clear update status
    clearUpdateStatus: () => update(state => ({
      ...state,
      updateStatus: { status: UpdateStatus.Idle }
    })),

    // Clear error
    clearError: () => update(state => ({
      ...state,
      error: null
    })),

    // Initialize with existing data
    initialize: (lnurl: string | null, lnAddress: string | null, bip353Address?: string | null) => {
      set({
        lnurl,
        lnAddress,
        bip353Address: bip353Address || null,
        status: lnAddress ? LnAddressStatus.Success : LnAddressStatus.Initial,
        updateStatus: { status: UpdateStatus.Idle },
        error: null
      });
    },

    // Reset to initial state
    reset: () => set(initialState)
  };
}

export const lnAddressStore = createLnAddressStore();

// Derived stores for common checks
export const hasValidAddress = derived(
  lnAddressStore,
  $store => !!$store.lnAddress && $store.lnAddress.length > 0
);

export const isLoading = derived(
  lnAddressStore,
  $store => $store.status === LnAddressStatus.Loading
);

export const isUpdating = derived(
  lnAddressStore,
  $store => $store.updateStatus.status === UpdateStatus.Loading
);

export const hasError = derived(
  lnAddressStore,
  $store => $store.status === LnAddressStatus.Error || !!$store.error
);

// Extract username from lightning address
export const username = derived(
  lnAddressStore,
  $store => {
    if (!$store.lnAddress) return null;
    const parts = $store.lnAddress.split('@');
    return parts.length > 0 ? parts[0] : null;
  }
);

// Extract domain from lightning address
export const domain = derived(
  lnAddressStore,
  $store => {
    if (!$store.lnAddress) return null;
    const parts = $store.lnAddress.split('@');
    return parts.length > 1 ? parts[1] : null;
  }
);
