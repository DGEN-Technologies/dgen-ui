import { isTxSeen, type Network } from "./esplora/EsploraClient";
import { sdkLogger } from "./logger";
import { writable } from "svelte/store";

const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 15 * 60 * 1000; // 15 minutes max wait

type SendGateState = {
  status: "idle" | "waiting";
  txid?: string;
  since?: number;
};

export const sendGateStore = writable<SendGateState>({ status: "idle" });

let pending: { txid: string; network: Network; since: number } | null = null;
let waitPromise: Promise<void> | null = null;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function trackOutgoingTx(
  txid: string,
  network: Network = "liquid",
): void {
  pending = { txid, network, since: Date.now() };
}

export async function waitForOutgoingSlot(): Promise<void> {
  if (!pending) return;
  if (waitPromise) return waitPromise;

  const { txid, network } = pending;

  waitPromise = (async () => {
    sendGateStore.set({ status: "waiting", txid, since: Date.now() });
    sdkLogger.info("Send gate active, waiting for tx in mempool:", txid);
    const start = Date.now();
    while (MAX_WAIT_MS === 0 || Date.now() - start < MAX_WAIT_MS) {
      try {
        const seen = await isTxSeen(txid, network);
        if (seen) {
          pending = null;
          sendGateStore.set({ status: "idle" });
          return;
        }
      } catch (error) {
        sdkLogger.warn("Send gate status check failed:", error);
      }
      await sleep(POLL_INTERVAL_MS);
    }
    if (MAX_WAIT_MS > 0) {
      sdkLogger.warn(
        "Send gate timeout, proceeding without mempool visibility",
      );
      pending = null;
      sendGateStore.set({ status: "idle" });
    }
  })().finally(() => {
    sendGateStore.set({ status: "idle" });
    waitPromise = null;
  });

  return waitPromise;
}
