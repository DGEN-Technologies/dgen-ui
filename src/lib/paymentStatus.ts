type PaymentLike = {
  status?: string;
  details?: {
    refundTxId?: string | null;
    refundTxAmountSat?: number | string | bigint | null;
  };
};

const hasRefundAmount = (
  value: PaymentLike["details"]["refundTxAmountSat"],
) => {
  if (value === null || value === undefined) return false;
  const num = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(num) && num > 0;
};

export const resolvePaymentStatus = (
  payment?: PaymentLike | null,
): string | undefined => {
  if (!payment) return undefined;
  const { status, details } = payment;
  const refundTxId = details?.refundTxId;
  if (
    status === "failed" &&
    (refundTxId || hasRefundAmount(details?.refundTxAmountSat))
  ) {
    return "refunded";
  }
  return status;
};
