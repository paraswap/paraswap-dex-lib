import { MAX_INT } from './constants';

export const BI_MINUS_ONE = BigInt(-1);
export const BI_0 = BigInt(0);
export const BI_1 = BigInt(1);
export const BI_2 = BigInt(2);
export const BI_3 = BigInt(3);
export const BI_4 = BigInt(4);
export const BI_5 = BigInt(5);
export const BI_6 = BigInt(6);
export const BI_7 = BigInt(7);
export const BI_8 = BigInt(8);
export const BI_9 = BigInt(9);
export const BI_10 = BigInt(10);
export const BI_11 = BigInt(11);
export const BI_12 = BigInt(12);
export const BI_13 = BigInt(13);
export const BI_14 = BigInt(14);
export const BI_15 = BigInt(15);
export const BI_20 = BigInt(20);
export const BI_30 = BigInt(30);
export const BI_93 = BigInt(93);
export const BI_99 = BigInt(99);
export const BI_100 = BigInt(100);
export const BI_101 = BigInt(101);
export const BI_107 = BigInt(107);
export const BI_160 = BigInt(160);
export const BI_161 = BigInt(161);
export const BI_248 = BigInt(248);

// Used only on API side
export const BI_200_000 = BigInt(200 * 1000);

export const BI_POW_3 = BigInt(10 ** 3);
export const BI_POW_4 = BigInt(10 ** 4);
export const BI_POW_5 = BigInt(10 ** 5);
export const BI_POW_6 = BigInt(10 ** 6);
export const BI_POW_7 = BigInt(10 ** 7);
export const BI_POW_8 = BigInt(10 ** 8);
export const BI_POW_9 = BigInt(10 ** 9);
export const BI_POW_10 = BigInt(10 ** 10);
export const BI_POW_11 = BigInt(10 ** 11);
export const BI_POW_12 = BigInt(10 ** 12);
export const BI_POW_13 = BigInt(10 ** 13);
export const BI_POW_14 = BigInt(10 ** 14);
export const BI_POW_15 = BigInt(10 ** 15);
export const BI_POW_16 = BigInt(10 ** 16);
export const BI_POW_17 = BigInt(10 ** 17);
export const BI_POW_18 = BigInt(10 ** 18);
export const BI_POW_19 = BigInt(10 ** 19);
export const BI_POW_20 = BigInt(10 ** 20);

// Not safe to use number for initialization
export const BI_POW_36 = BigInt(
  '1' + '0000000000' + '0000000000' + '0000000000' + '000000',
);

export const BI_MAX_INT = BigInt(MAX_INT);
export const BI_MAX_UINT = BI_2 ** BigInt(256) - BI_1;
