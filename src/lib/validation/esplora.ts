import { NETWORKS, type Network } from "@dgen/esplora-types";

// Client-side validation is intentionally minimal; server remains authoritative.
export { NETWORKS, type Network };

export const VALID_NETWORKS = new Set<Network>(NETWORKS);
const TXID_REGEX = /^[a-fA-F0-9]{64}$/;

export const isValidNetwork = (value: string | undefined): value is Network =>
  !!value && VALID_NETWORKS.has(value as Network);

export const validateNetwork = (
  network: string,
): asserts network is Network => {
  if (!isValidNetwork(network)) {
    throw new Error("Invalid network");
  }
};

export const isValidTxid = (value?: string): value is string =>
  !!value && TXID_REGEX.test(value);

export const validateTxid = (txid: string): void => {
  if (!isValidTxid(txid)) {
    throw new Error("Invalid txid format");
  }
};
