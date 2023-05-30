export class DfynMath{
    static sqrt(x: bigint): bigint {
        let z: bigint = 1n;
      
        if (x >= 0x100000000000000000000000000000000n) {
          x >>= 128n;
          z <<= 64n;
        }
        if (x >= 0x10000000000000000n) {
          x >>= 64n;
          z <<= 32n;
        }
        if (x >= 0x100000000n) {
          x >>= 32n;
          z <<= 16n;
        }
        if (x >= 0x10000n) {
          x >>= 16n;
          z <<= 8n;
        }
        if (x >= 0x100n) {
          x >>= 8n;
          z <<= 4n;
        }
        if (x >= 0x10n) {
          x >>= 4n;
          z <<= 2n;
        }
        if (x >= 0x8n) {
          z <<= 1n;
        }
      
        z = (z + x / z) >> 1n;
        z = (z + x / z) >> 1n;
        z = (z + x / z) >> 1n;
        z = (z + x / z) >> 1n;
        z = (z + x / z) >> 1n;
        z = (z + x / z) >> 1n;
        z = (z + x / z) >> 1n;
      
        let zRoundDown: bigint = x / z;
        if (zRoundDown < z) {
          z = zRoundDown;
        }
      
        return z;
      }
      
    static priceFromSqrtprice(tickZeroPrice: bigint, sqrtPrice: bigint): bigint {
        let price: bigint = (sqrtPrice * 1000000n) / tickZeroPrice;
        if (sqrtPrice % tickZeroPrice !== 0n) {
          price += 1n;
        }
      
        return price;
      }
      
    static sqrtPriceFromPrice(tickZeroPrice: bigint, price: bigint): bigint {
        return tickZeroPrice * price;
      }
      
}