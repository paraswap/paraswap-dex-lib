export { lens } from 'lens.ts';
import { LensImpl } from 'lens.ts';

// This file only exists because these types weren't exported from the package itself
export type Lens<T, U> = LensImpl<T, U> & LensProxy<T, U>;
export type LensProxy<T, U> = { readonly [K in keyof U]: Lens<T, U[K]> };
