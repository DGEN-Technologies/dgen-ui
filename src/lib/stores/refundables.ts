import { writable } from "svelte/store";
import type { RefundableSwap } from "@breeztech/breez-sdk-liquid/web";
import {
  isConnected,
  listRefundables,
  rescanOnchainSwaps,
} from "$lib/walletService";

type RefundablesState = {
  items: RefundableSwap[];
  loading: boolean;
  error: string | null;
};

const initialState: RefundablesState = {
  items: [],
  loading: false,
  error: null,
};

const { subscribe, set } = writable<RefundablesState>(initialState);

const refresh = async (options: { rescan?: boolean } = {}): Promise<void> => {
  if (!isConnected()) {
    set({ ...initialState, error: "Wallet SDK not connected" });
    return;
  }

  set({ ...initialState, loading: true });

  try {
    if (options.rescan) {
      await rescanOnchainSwaps();
    }

    const refundables = await listRefundables();
    refundables.sort((a, b) => b.timestamp - a.timestamp);

    set({ items: refundables, loading: false, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    set({ ...initialState, error: message });
  }
};

export const refundablesStore = {
  subscribe,
  refresh,
};
