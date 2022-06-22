import { DeepReadonly } from 'ts-essentials';
import { Address, Token } from '../../types';
import { lens } from '../../lens';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import { PlatypusAssetSubscriber } from './asset';
import { PlatypusPoolSubscriber } from './pool-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PlatypusPoolState, PlatypusPoolConfigInfo } from './types';
import { getBigIntPow } from '../../utils';
import { PlatypusPoolBase, calcPrice, ETH_UNIT } from './pool-base';

export class PlatypusPool extends PlatypusPoolBase<PlatypusPoolState> {
  constructor(
    dexKey: string,
    network: number,
    name: string,
    poolAddress: Address,
    poolCfg: PlatypusPoolConfigInfo,
    dexHelper: IDexHelper,
  ) {
    super(
      dexKey,
      network,
      name,
      dexHelper,
      [
        new PlatypusPoolSubscriber<PlatypusPoolState>(
          poolAddress,
          lens<DeepReadonly<PlatypusPoolState>>().params,
          dexHelper.getLogger(`${dexKey}-${network} Params ${name}`),
        ),
        ...Object.entries(poolCfg.tokens)
          .map(([tokenAddress, c]) => [
            new PlatypusAssetSubscriber<PlatypusPoolState>(
              c.assetAddress,
              lens<DeepReadonly<PlatypusPoolState>>().asset[tokenAddress],
              dexHelper.getLogger(
                `${dexKey}-${network} ${c.tokenSymbol} asset ${name}`,
              ),
            ),
            new ChainLinkSubscriber<PlatypusPoolState>(
              c.chainlink.proxyAddress,
              c.chainlink.aggregatorAddress,
              lens<DeepReadonly<PlatypusPoolState>>().chainlink[tokenAddress],
              dexHelper.getLogger(
                `${c.tokenSymbol} ChainLink for ${dexKey}-${network} ${name}`,
              ),
            ),
          ])
          .flat(),
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
        chainlink: {},
        asset: {},
      },
    );
  }

  public computePrices(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    state: PlatypusPoolState,
  ): bigint[] {
    const tokenAPrice = state.chainlink[srcToken.address].answer;
    const tokenBPrice = state.chainlink[destToken.address].answer;
    if (tokenBPrice > tokenAPrice) {
      if (
        ((tokenBPrice - tokenAPrice) * ETH_UNIT) / tokenBPrice >
        state.params.maxPriceDeviation
      ) {
        return Array(amounts.length).fill(0n);
      }
    } else {
      if (
        ((tokenAPrice - tokenBPrice) * ETH_UNIT) / tokenAPrice >
        state.params.maxPriceDeviation
      ) {
        return Array(amounts.length).fill(0n);
      }
    }
    return amounts.map(fromAmount => {
      const idealToAmount =
        (fromAmount * getBigIntPow(destToken.decimals)) /
        getBigIntPow(srcToken.decimals);
      return calcPrice(srcToken, destToken, fromAmount, idealToAmount, state);
    });
  }
}
