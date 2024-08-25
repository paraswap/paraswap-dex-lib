import { UniswapV2, UniswapV2Pair } from './uniswap-v2';
import {
  DEST_TOKEN_PARASWAP_TRANSFERS,
  Network,
  SRC_TOKEN_PARASWAP_TRANSFERS,
} from '../../constants';
import {
  Address,
  DexConfigMap,
  Token,
  ExchangePrices,
  TransferFeeParams,
} from '../../types';
import { IDexHelper } from '../../dex-helper/index';
import { AbiCoder, Interface } from '@ethersproject/abi';
import { DexParams, UniswapV2Data } from './types';
import uniswapV2ABI from '../../abi/uniswap-v2/uniswap-v2-pool.json';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { UniswapV2PoolOrderedParams } from './types';
import { AkronswapConstantProductPool } from './akronswap-constant-product-pool';
import { SwapSide } from '@paraswap/core';
import { applyTransferFee } from '../../lib/token-transfer-fee';
import erc20ABI from '../../abi/erc20.json';
import _ from 'lodash';

export const AkronswapConfig: DexConfigMap<DexParams> = {
  Akronswap: {
    [Network.MAINNET]: {
      factoryAddress: '0xAf39606bec181887951Ab6912Ac7EA216Bd6E4B4',
      initCode:
        '0x207e00cb099b76f581c479b9e20c11280ed52e93ab7003d58600ec82fb71b23b',
      feeCode: 0,
    },
    [Network.BASE]: {
      factoryAddress: '0xAf39606bec181887951Ab6912Ac7EA216Bd6E4B4',
      initCode:
        '0x207e00cb099b76f581c479b9e20c11280ed52e93ab7003d58600ec82fb71b23b',
      feeCode: 0,
    },
    [Network.ARBITRUM]: {
      factoryAddress: '0xAf39606bec181887951Ab6912Ac7EA216Bd6E4B4',
      initCode:
        '0x207e00cb099b76f581c479b9e20c11280ed52e93ab7003d58600ec82fb71b23b',
      feeCode: 0,
    },
    [Network.BSC]: {
      factoryAddress: '0xAf39606bec181887951Ab6912Ac7EA216Bd6E4B4',
      initCode:
        '0x207e00cb099b76f581c479b9e20c11280ed52e93ab7003d58600ec82fb71b23b',
      feeCode: 0,
    },
  },
};

interface UniswapV2PoolState {
  reserves0: string;
  reserves1: string;
  feeCode: number;
}

const erc20iface = new Interface(erc20ABI);
const coder = new AbiCoder();

export class Akronswap extends UniswapV2 {
  akronswapPool: Interface;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AkronswapConfig);

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected isDynamicFees = false,
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      true,
      AkronswapConfig[dexKey][network].factoryAddress,
      AkronswapConfig[dexKey][network].subgraphURL,
      AkronswapConfig[dexKey][network].initCode,
      AkronswapConfig[dexKey][network].feeCode,
      AkronswapConfig[dexKey][network].poolGasCost,
    );
    this.akronswapPool = new Interface(uniswapV2ABI);
  }

  async getBuyPrice(
    priceParams: UniswapV2PoolOrderedParams,
    destAmount: bigint,
  ): Promise<bigint> {
    return AkronswapConstantProductPool.getBuyPrice(priceParams, destAmount);
  }

  async getSellPrice(
    priceParams: UniswapV2PoolOrderedParams,
    srcAmount: bigint,
  ): Promise<bigint> {
    return AkronswapConstantProductPool.getSellPrice(priceParams, srcAmount);
  }

  async getManyPoolReserves(
    pairs: UniswapV2Pair[],
    blockNumber: number,
  ): Promise<UniswapV2PoolState[]> {
    try {
      const calldata = pairs
        .map((pair, i) => {
          let calldata = [
            {
              target: pair.token0.address,
              callData: erc20iface.encodeFunctionData('balanceOf', [
                pair.exchange!,
              ]),
            },
            {
              target: pair.token1.address,
              callData: erc20iface.encodeFunctionData('balanceOf', [
                pair.exchange!,
              ]),
            },
          ];

          return calldata;
        })
        .flat();

      const data: { returnData: any[] } =
        await this.dexHelper.multiContract.methods
          .aggregate(calldata)
          .call({}, blockNumber);

      const returnData = _.chunk(data.returnData, 2);

      return pairs.map((pair, i) => ({
        reserves0: coder.decode(['uint256'], returnData[i][0])[0].toString(),
        reserves1: coder.decode(['uint256'], returnData[i][1])[0].toString(),
        feeCode: this.feeCode,
      }));
    } catch (e) {
      this.logger.error(
        `Error_getManyPoolReserves could not get reserves with error:`,
        e,
      );
      return [];
    }
  }

  async getPricesVolume(
    _from: Token,
    _to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    // list of pool identifiers to use for pricing, if undefined use all pools
    limitPools?: string[],
    transferFees: TransferFeeParams = {
      srcFee: 0,
      destFee: 0,
      srcDexFee: 0,
      destDexFee: 0,
    },
  ): Promise<ExchangePrices<UniswapV2Data> | null> {
    try {
      const from = this.dexHelper.config.wrapETH(_from);
      const to = this.dexHelper.config.wrapETH(_to);

      if (from.address.toLowerCase() === to.address.toLowerCase()) {
        return null;
      }

      const tokenAddress = [
        from.address.toLowerCase(),
        to.address.toLowerCase(),
      ]
        .sort((a, b) => (a > b ? 1 : -1))
        .join('_');

      const poolIdentifier = `${this.dexKey}_${tokenAddress}`;
      if (limitPools && limitPools.every(p => p !== poolIdentifier))
        return null;

      await this.batchCatchUpPairs([[from, to]], blockNumber);
      const isSell = side === SwapSide.SELL;
      const pairParam = await this.getPairOrderedParams(
        from,
        to,
        blockNumber,
        transferFees.srcDexFee,
      );

      if (!pairParam) return null;

      const unitAmount = getBigIntPow(isSell ? from.decimals : to.decimals);

      const [unitVolumeWithFee, ...amountsWithFee] = applyTransferFee(
        [unitAmount, ...amounts],
        side,
        isSell ? transferFees.srcFee : transferFees.destFee,
        isSell ? SRC_TOKEN_PARASWAP_TRANSFERS : DEST_TOKEN_PARASWAP_TRANSFERS,
      );

      const unit = isSell
        ? await this.getSellPricePath(unitVolumeWithFee, [pairParam])
        : await this.getBuyPricePath(unitVolumeWithFee, [pairParam]);

      const prices = isSell
        ? await Promise.all(
            amountsWithFee.map(amount =>
              this.getSellPricePath(amount, [pairParam]),
            ),
          )
        : await Promise.all(
            amountsWithFee.map(amount =>
              this.getBuyPricePath(amount, [pairParam]),
            ),
          );

      const [unitOutWithFee, ...outputsWithFee] = applyTransferFee(
        [unit, ...prices],
        side,
        // This part is confusing, because we treat differently SELL and BUY fees
        // If Buy, we should apply transfer fee on srcToken on top of dexFee applied earlier
        // But for Sell we should apply only one dexFee
        isSell ? transferFees.destDexFee : transferFees.srcFee,
        isSell ? this.DEST_TOKEN_DEX_TRANSFERS : SRC_TOKEN_PARASWAP_TRANSFERS,
      );

      // As uniswapv2 just has one pool per token pair
      return [
        {
          prices: outputsWithFee,
          unit: unitOutWithFee,
          data: {
            router: this.router,
            path: [from.address.toLowerCase(), to.address.toLowerCase()],
            factory: this.factoryAddress,
            initCode: this.initCode,
            feeFactor: this.feeFactor,
            pools: [
              {
                address: pairParam.exchange,
                fee: parseInt(pairParam.fee),
                direction: pairParam.direction,
              },
            ],
          },
          exchange: this.dexKey,
          poolIdentifier,
          gasCost: this.poolGasCost,
          poolAddresses: [pairParam.exchange],
        },
      ];
    } catch (e) {
      if (blockNumber === 0)
        this.logger.error(
          `Error_getPricesVolume: Aurelius block manager not yet instantiated`,
        );
      this.logger.error(`Error_getPrices:`, e);
      return null;
    }
  }
}
