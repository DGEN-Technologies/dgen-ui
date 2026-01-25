// Client-side validation is intentionally format-only; server enforces checksums.
const MAX_ADDRESS_LENGTH = 120;
const base58Address = /^[1-9A-HJ-NP-Za-km-z]{25,90}$/;
const bech32Address = /^(bc1|tb1|bcrt1|lq1|tlq1|ex1|tex1)[0-9a-z]{6,}$/i;

export const isValidAddress = (
  address: string | undefined,
): address is string => {
  if (!address) return false;
  if (address.length < 14 || address.length > MAX_ADDRESS_LENGTH) return false;
  if (!/^[a-zA-Z0-9]+$/.test(address)) return false;
  return base58Address.test(address) || bech32Address.test(address);
};
