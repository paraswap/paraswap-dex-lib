import { DeepReadonly } from 'ts-essentials';
import { Address, Token } from '../../types';
import { lens } from '../../lens';
import { StakedAvaxSubscriber } from '../../lib/benqi/staked-avax';
import { PlatypusAssetSubscriber } from './asset';
import { PlatypusPoolSubscriber } from './pool-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PlatypusAvaxPoolState, PlatypusAvaxPoolConfigInfo } from './types';
import { PlatypusPoolBase, calcPrice, WAD, wmul, wdiv } from './pool-base';

export class PlatypusAvaxPool extends PlatypusPoolBase<PlatypusAvaxPoolState> {
  constructor(
    dexKey: string,
    network: number,
    name: string,
    poolAddress: Address,
    poolCfg: PlatypusAvaxPoolConfigInfo,
    dexHelper: IDexHelper,
  ) {
    super(
      dexKey,
      network,
      name,
      dexHelper,
      [
        new PlatypusPoolSubscriber<PlatypusAvaxPoolState>(
          poolAddress,
          lens<DeepReadonly<PlatypusAvaxPoolState>>().params,
          dexHelper.getLogger(`${dexKey}-${network} Params ${name}`),
        ),
        new StakedAvaxSubscriber<PlatypusAvaxPoolState>(
          poolCfg.priceOracleAddress,
          lens<DeepReadonly<PlatypusAvaxPoolState>>().stakedAvax,
          dexHelper.getLogger(`Staked AVAX for ${dexKey}-${network} ${name}`),
        ),
        ...Object.entries(poolCfg.tokens).map(
          ([tokenAddress, c]) =>
            new PlatypusAssetSubscriber<PlatypusAvaxPoolState>(
              c.assetAddress,
              lens<DeepReadonly<PlatypusAvaxPoolState>>().asset[tokenAddress],
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
        stakedAvax: {
          totalPooledAvax: 0n,
          totalShares: 0n,
        },
      },
    );
  }

  public computePrices(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    state: PlatypusAvaxPoolState,
  ): bigint[] {
    let fromShares: boolean;
    if (this.dexHelper.config.isWETH(destToken.address)) {
      fromShares = true;
    } else if (this.dexHelper.config.isWETH(srcToken.address)) {
      fromShares = false;
    } else {
      throw new Error(`Unexpected tokens being swapped in ${this.name}`);
    }
    const sAvaxRate = StakedAvaxSubscriber.getPooledAvaxByShares(
      WAD,
      state.stakedAvax,
    );
    return amounts.map(fromAmount => {
      const idealToAmount = fromShares
        ? wmul(fromAmount, sAvaxRate)
        : wdiv(fromAmount, sAvaxRate);
      return calcPrice(srcToken, destToken, fromAmount, idealToAmount, state);
    });
  }
}
