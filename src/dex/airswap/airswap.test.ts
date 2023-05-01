import { SwapSide } from '@paraswap/core';
import { computePricesFromLevels, mapMakerResponse } from './airswap-tools';
import { BN_1 } from '../../bignumber-constants';
import { Tokens } from '../../../tests/constants-e2e';
import { Network } from '../../constants';
import { PriceLevel } from './types';
import BigNumber from 'bignumber.js';

describe('airswap', () => {
    it('unit price', () => {
        const amounts = [BN_1];
        const levels = [{ level: '1', price: '1' }];
        const srcToken = Tokens[Network.MAINNET].USDC;
        const destToken = Tokens[Network.MAINNET].USDT;
        const prices = computePricesFromLevels(
            amounts,
            levels,
            srcToken,
            destToken,
            SwapSide.SELL,
        );
        expect(prices).toEqual([1000000n]);
    });

    it('amount prices', () => {
        const amounts = [
            0n,
            2000n,
            4000n,
            6000n,
            8000n,
            10000n,
            12000n,
            14000n,
            16000n,
            18000n,
            20000n,
        ].map(amount => new BigNumber(amount.toString()).dividedBy(18));
        const levels = mapMakerResponse([
                [
                    1,
                    1.0000804135489818
                ],
                [
                    28632.23189406919,
                    1.000031329146842
                ],
                [
                    60127.68697754531,
                    0.9999282642399678
                ],
                [
                    94772.68756936904,
                    0.9998149093727866
                ],
                [
                    132882.18822037516,
                    0.9996902412973147
                ],
                [
                    174802.63893648188,
                    0.9995531333644397
                ],
                [
                    220915.13472419925,
                    0.9994023472389632
                ]
            ]);
        const srcToken = Tokens[Network.MAINNET].USDC;
        const destToken = Tokens[Network.MAINNET].USDT;
        const prices = computePricesFromLevels(
            amounts,
            levels,
            srcToken,
            destToken,
            SwapSide.SELL,
        );
        expect(prices).toEqual([
            111083207n,
            222166413n,
            333249619n,
            444332825n,
            555416031n,
            666499238n,
            777582444n,
            888665650n,
            999748856n,
            1110832062n
        ]);
    });
});

