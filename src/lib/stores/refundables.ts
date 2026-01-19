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

const waitForSdk = async (): Promise<boolean> => {
  let attempts = 0;
  while (!isConnected() && attempts < 20) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    attempts += 1;
  }
  return isConnected();
};

const refresh = async (options: { rescan?: boolean } = {}): Promise<void> => {
  set({ ...initialState, loading: true });

  try {
    const ready = await waitForSdk();
    if (!ready) {
      set({ ...initialState, error: "Wallet SDK not connected" });
      return;
    }

    if (options.rescan) {
      await rescanOnchainSwaps();
    }

    const refundables = await listRefundables();
    const sortedRefundables = [...refundables].sort(
      (a, b) => b.timestamp - a.timestamp,
    );

    set({ items: sortedRefundables, loading: false, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    set({ ...initialState, error: message });
  }
};

export const refundablesStore = {
  subscribe,
  refresh,
};
