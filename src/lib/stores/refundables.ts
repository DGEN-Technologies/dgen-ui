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
let autoRescanAttempted = false;

const refresh = async (options: { rescan?: boolean } = {}): Promise<void> => {
  set({ ...initialState, loading: true });

  try {
    const ready = await waitForSdk();
    if (!ready) {
      set({ ...initialState, error: "Wallet SDK not connected" });
      return;
    }

    if (options.rescan) {
      try {
        await rescanOnchainSwaps();
      } catch (error) {
        console.warn("[RefundablesStore] Rescan failed:", error);
      }
      autoRescanAttempted = true;
    }

    let refundables = await listRefundables();
    if (refundables.length === 0 && !autoRescanAttempted) {
      autoRescanAttempted = true;
      try {
        await rescanOnchainSwaps();
      } catch (error) {
        console.warn("[RefundablesStore] Auto rescan failed:", error);
      }
      refundables = await listRefundables();
    }

    const sortedRefundables = [...refundables].sort(
      (a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0),
    );

    set({ items: sortedRefundables, loading: false, error: null });
  } catch (error) {
    console.error("[RefundablesStore] Failed to refresh:", error);
    const message = error instanceof Error ? error.message : String(error);
    set({ ...initialState, error: message || "Failed to load refundables" });
  }
};

export const refundablesStore = {
  subscribe,
  refresh,
};
