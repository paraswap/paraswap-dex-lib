export const ZERO_BYTE = 4;
export const NONZERO_BYTE = 16;

export function wordNonZeroBytes(nonZeroBytes: number) {
  return (32 - nonZeroBytes) * ZERO_BYTE + nonZeroBytes * NONZERO_BYTE;
}

export const FUNCTION_SELECTOR = 4 * NONZERO_BYTE;
export const ADDRESS = wordNonZeroBytes(20);
export const BOOL = wordNonZeroBytes(1);
export const TIMESTAMP = wordNonZeroBytes(4);
export const LENGTH_SMALL = wordNonZeroBytes(1);
export const LENGTH_LARGE = wordNonZeroBytes(2);
export const INDEX = wordNonZeroBytes(1);
export const ZERO = wordNonZeroBytes(0);
export const FULL_WORD = wordNonZeroBytes(32);
export const OFFSET_SMALL = wordNonZeroBytes(1);
export const OFFSET_LARGE = wordNonZeroBytes(2);
// Give enough room for amounts of 1000000e18
export const AMOUNT = wordNonZeroBytes(10);
export const BPS = wordNonZeroBytes(2);
export const UUID = wordNonZeroBytes(16);

export const DEX_OVERHEAD =
  OFFSET_LARGE + INDEX + ADDRESS + BPS + OFFSET_SMALL + ZERO;
export const DEX_NO_PAYLOAD = DEX_OVERHEAD + ZERO;
