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

export const getEffectiveOnchainReceiveMinSat = (
  onchainLimits?: OnchainLimitsLike,
): number | null =>
  toFiniteNumber(onchainLimits?.receive?.minSat ?? onchainLimits?.minSat);

export const getOnchainReceiveMaxSat = (
  onchainLimits?: OnchainLimitsLike,
): number | null =>
  toFiniteNumber(onchainLimits?.receive?.maxSat ?? onchainLimits?.maxSat);
