import { SwapSide, MAX_UINT_BIGINT } from '../../constants';

const ZERO_UINT = BigInt('0');

// We assume that the rate always gets worse when be go bigger in volume.
// Both oldVolume and newVolume are sorted
// Considering these assumption, whenver we don't have a price we consider
// the price for the next volume price available and interpolate linearly.
// Interpolate can be usefull in two cases
// -> you have a smaller chunked prices and you want go to a higher chunked prices
// -> you have a linear prices and you want go to a not skewed prices
// -> could be used by the order book exchanges as an orderbook works almost with the same principles.
// p = p[i-1] + (p[i] - p[i-1])/(q[i]-q[i-1])*(v-q[i-1])
export function interpolate(
  oldVolume: bigint[],
  oldPrices: bigint[],
  newVolume: bigint[],
  side: SwapSide,
): bigint[] {
  let maxPrice = oldPrices[0];
  let isValid = [true];
  for (let p of oldPrices.slice(1)) {
    if (p >= maxPrice) {
      maxPrice = p;
      isValid.push(true);
    } else {
      isValid.push(false);
    }
  }

  let i = 0;
  return newVolume.map(v => {
    if (v === ZERO_UINT) return ZERO_UINT;

    while (i < oldVolume.length && v > oldVolume[i]) i++;

    // if we dont have any more prices for a bigger volume return last price for sell and infinity for buy
    if (i >= oldVolume.length) {
      return !isValid[oldPrices.length - 1]
        ? ZERO_UINT
        : side === SwapSide.SELL
        ? oldPrices[oldPrices.length - 1]
        : MAX_UINT_BIGINT;
    }

    if (!isValid[i]) return ZERO_UINT;

    // if the current volume is equal to oldVolume then just use that
    if (oldVolume[i] === v) return oldPrices[i];

    if (i > 0 && !isValid[i - 1]) return ZERO_UINT;

    // As we know that derivative of the prices can't go up we apply a linear interpolation
    const lastOldVolume = i > 0 ? oldVolume[i - 1] : ZERO_UINT;
    const lastOldPrice = i > 0 ? oldPrices[i - 1] : ZERO_UINT;

    // Old code - this doesn't work because slope can be very small and gets
    // rounded badly in bignumber.js, so need to do the division later
    //const slope = oldPrices[i]
    //  .minus(lastOldPrice)
    //  .div(oldVolume[i].minus(lastOldVolume));
    //return lastOldPrice.plus(slope.times(v.minus(lastOldVolume)));

    return (
      lastOldPrice +
      ((oldPrices[i] - lastOldPrice) * (v - lastOldVolume)) /
        (oldVolume[i] - lastOldVolume)
    );
  });
}
