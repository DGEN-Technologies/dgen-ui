export const NETWORKS = [
  "bitcoin",
  "liquid",
  "testnet",
  "liquidtestnet",
] as const;
export type Network = (typeof NETWORKS)[number];

export interface TxStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

export interface Utxo {
  txid: string;
  vout: number;
  status: TxStatus;
  value: number;
}
