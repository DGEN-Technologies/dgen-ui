const isDev =
  (typeof process !== "undefined" && process.env?.NODE_ENV === "development") ||
  import.meta.env?.MODE === "development" ||
  import.meta.env?.DEV === true;

export const MIN_BTC_ONCHAIN_RECEIVE_SATS = isDev ? 25000 : 25000;

type NumericLike = number | string | bigint | null | undefined;
type OnchainLimitsLike = {
  receive?: { minSat?: NumericLike; maxSat?: NumericLike };
  minSat?: NumericLike;
  maxSat?: NumericLike;
};

const toFiniteNumber = (value: NumericLike): number | null => {
  if (value === null || value === undefined) return null;
  const num = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(num) ? num : null;
};

const getBaseMinSat = (): number =>
  Number.isFinite(MIN_BTC_ONCHAIN_RECEIVE_SATS)
    ? MIN_BTC_ONCHAIN_RECEIVE_SATS
    : 25000;

export const getEffectiveOnchainReceiveMinSat = (
  onchainLimits?: OnchainLimitsLike
): number => {
  const baseMin = getBaseMinSat();
  const sdkMin = toFiniteNumber(
    onchainLimits?.receive?.minSat ?? onchainLimits?.minSat
  );

  // Always prefer local minimum over SDK minimum
  // WARNING: This may cause SDK errors if amount is below SDK's minimum
  return baseMin;
};

export const getOnchainReceiveMaxSat = (
  onchainLimits?: OnchainLimitsLike
): number | null =>
  toFiniteNumber(onchainLimits?.receive?.maxSat ?? onchainLimits?.maxSat);
