import { DeepReadonly } from 'ts-essentials';
import { Address, Token } from '../../types';
import { lens } from '../../lens';
import { PlatypusAssetSubscriber } from './asset';
import { PlatypusPoolSubscriber } from './pool-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PlatypusPurePoolState, PlatypusPurePoolConfigInfo } from './types';
import { getBigIntPow } from '../../utils';
import { PlatypusPoolBase, calcPrice } from './pool-base';

export class PlatypusPurePool extends PlatypusPoolBase<PlatypusPurePoolState> {
  constructor(
    dexKey: string,
    network: number,
    name: string,
    poolAddress: Address,
    poolCfg: PlatypusPurePoolConfigInfo,
    dexHelper: IDexHelper,
  ) {
    super(
      dexKey,
      network,
      name,
      dexHelper,
      [
        new PlatypusPoolSubscriber<PlatypusPurePoolState>(
          poolAddress,
          lens<DeepReadonly<PlatypusPurePoolState>>().params,
          dexHelper.getLogger(`${dexKey}-${network} Params ${name}`),
        ),
        ...Object.entries(poolCfg.tokens).map(
          ([tokenAddress, c]) =>
            new PlatypusAssetSubscriber<PlatypusPurePoolState>(
              c.assetAddress,
              lens<DeepReadonly<PlatypusPurePoolState>>().asset[tokenAddress],
              dexHelper.getLogger(
                `${dexKey}-${network} ${c.tokenSymbol} asset ${name}`,
              ),
            ),
        ),
      ],
      {
        params: {
          paused: false,
          slippageParamK: 0n,
          slippageParamN: 0n,
          c1: 0n,
          xThreshold: 0n,
          haircutRate: 0n,
          retentionRatio: 0n,
          maxPriceDeviation: 0n,
        },
        asset: {},
      },
    );
  }

  public computePrices(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    state: PlatypusPurePoolState,
  ): bigint[] {
    return amounts.map(fromAmount => {
      const idealToAmount =
        (fromAmount * getBigIntPow(destToken.decimals)) /
        getBigIntPow(srcToken.decimals);
      return calcPrice(srcToken, destToken, fromAmount, idealToAmount, state);
    });
  }
}
