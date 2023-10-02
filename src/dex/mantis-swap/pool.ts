import { DeepReadonly } from 'ts-essentials';
import { Address, Token } from '../../types';
import { lens } from '../../lens';
import { ChainLinkSubscriber } from '../../lib/chainlink';
import { MantisLPSubscriber } from './lp';
import { MantisPoolSubscriber } from './pool-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { MantisPoolState, MantisPoolConfigInfo } from './types';
import { getBigIntPow } from '../../utils';
import { MantisPoolBase, calcPrice, ONE_18 } from './pool-base';

export class MantisPool extends MantisPoolBase<MantisPoolState> {
  constructor(
    dexKey: string,
    network: number,
    name: string,
    poolAddress: Address,
    poolCfg: MantisPoolConfigInfo,
    dexHelper: IDexHelper,
  ) {
    super(
      dexKey,
      network,
      name,
      dexHelper,
      [
        new MantisPoolSubscriber<MantisPoolState>(
          poolAddress,
          poolCfg.tokens,
          lens<DeepReadonly<MantisPoolState>>().params,
          dexHelper.getLogger(`${dexKey}-${network} Params ${name}`),
        ),
        ...Object.entries(poolCfg.tokens)
          .map(([tokenAddress, c]) => [
            new MantisLPSubscriber<MantisPoolState>(
              c.lpAddress,
              lens<DeepReadonly<MantisPoolState>>().asset[tokenAddress],
              dexHelper.getLogger(
                `${dexKey}-${network} ${c.tokenSymbol} asset ${name}`,
              ),
            ),
            new ChainLinkSubscriber<MantisPoolState>(
              c.chainlink.proxyAddress,
              c.chainlink.aggregatorAddress,
              lens<DeepReadonly<MantisPoolState>>().chainlink[tokenAddress],
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
          slippageA: 0n,
          slippageN: 0n,
          slippageK: 0n,
          baseFee: 0n,
          lpRatio: 0n,
          riskProfile: {},
        },
        asset: {},
        chainlink: {},
      },
    );
  }

  public computePrices(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    state: MantisPoolState,
  ): bigint[] {
    return amounts.map(fromAmount => {
      const idealToAmount =
        (fromAmount * getBigIntPow(destToken.decimals)) /
        getBigIntPow(srcToken.decimals);
      return calcPrice(srcToken, destToken, fromAmount, idealToAmount, state);
    });
  }
}
