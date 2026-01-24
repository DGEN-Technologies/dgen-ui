import { writable } from "svelte/store";
import type { RefundableSwap } from "@breeztech/breez-sdk-liquid/web";
import {
  listRefundables,
  rescanOnchainSwaps,
  waitForSdk,
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
      (a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0),
    );

    set({ items: sortedRefundables, loading: false, error: null });
  } catch (error) {
    console.error("[RefundablesStore] Failed to refresh:", error);
    set({ ...initialState, error: "Failed to load refundables" });
  }
};

export const refundablesStore = {
  subscribe,
  refresh,
};
