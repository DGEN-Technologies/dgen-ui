import type * as breezSdk from '@breeztech/breez-sdk-liquid/web';

// Mainnet Asset IDs
export const ASSET_IDS = {
  LBTC: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d',
  USDT: 'ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2'
} as const;

// Asset metadata
export const ASSET_METADATA: breezSdk.AssetMetadata[] = [
  {
    assetId: ASSET_IDS.LBTC,
    name: 'Bitcoin',
    ticker: 'BTC',
    precision: 8
  },
  {
    assetId: ASSET_IDS.USDT,
    name: 'Tether USD',
    ticker: 'USDT',
    precision: 8,
    fiatId: 'USD'
  }
];

// Helper to get asset metadata by ID
export function getAssetMetadata(assetId: string): breezSdk.AssetMetadata | undefined {
  return ASSET_METADATA.find(a => a.assetId === assetId);
}

// Helper to format asset amount with proper precision
export function formatAssetAmount(
  amount: number,
  assetId: string,
  includeSymbol: boolean = true
): string {
  const metadata = getAssetMetadata(assetId);
  if (!metadata) return amount.toString();

  const formattedAmount = (amount / Math.pow(10, metadata.precision)).toFixed(metadata.precision);
  return includeSymbol ? `${formattedAmount} ${metadata.ticker}` : formattedAmount;
}

// Helper to parse asset amount to satoshis
export function parseAssetAmount(amount: number, assetId: string): number {
  const metadata = getAssetMetadata(assetId);
  if (!metadata) return amount;
  return Math.floor(amount * Math.pow(10, metadata.precision));
}

// Check if asset supports fee payment
export function supportsAssetFees(assetId: string): boolean {
  const metadata = getAssetMetadata(assetId);
  return !!metadata?.fiatId;
}

// Get asset display name
export function getAssetDisplayName(assetId: string): string {
  const metadata = getAssetMetadata(assetId);
  return metadata?.name || 'Unknown Asset';
}

// Get asset ticker
export function getAssetTicker(assetId: string): string {
  const metadata = getAssetMetadata(assetId);
  return metadata?.ticker || 'UNKNOWN';
}
