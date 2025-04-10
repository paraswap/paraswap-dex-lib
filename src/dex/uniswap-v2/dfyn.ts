import { UniswapV2 } from './uniswap-v2';
import { Network, ETHER_ADDRESS, SwapSide } from '../../constants';
import {
  Address,
  DexConfigMap,
  Token,
  ExchangePrices,
  DexExchangeParam,
} from '../../types';
import { IDexHelper } from '../../dex-helper/index';
import { Interface } from '@ethersproject/abi';
import { DexParams, UniswapData, UniswapV2Data } from './types';
import { getDexKeysWithNetwork, isETHAddress } from '../../utils';
import { NumberAsString } from '@paraswap/core';

export const DfynConfig: DexConfigMap<DexParams> = {
  Dfyn: {
    [Network.POLYGON]: {
      subgraphURL: 'Dizc6HBJZWB276wcyycYMxN8FMKeKb7RpSvwu83F4gTc',
      factoryAddress: '0xE7Fb3e833eFE5F9c441105EB65Ef8b261266423B',
      initCode:
        '0xf187ed688403aa4f7acfada758d8d53698753b998a3071b06f1b777f4330eaf3',
      feeCode: 30,
    },
  },
};

const DfynWETH = {
  address: '0x4c28f48448720e9000907bc2611f73022fdce1fa',
  decimals: 18,
};

const WrapDfynWETH = (token: Token) =>
  token.address.toLowerCase() === ETHER_ADDRESS.toLowerCase()
    ? DfynWETH
    : token;

export class Dfyn extends UniswapV2 {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(DfynConfig);

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      false,
      DfynConfig[dexKey][network].factoryAddress,
      DfynConfig[dexKey][network].subgraphURL,
      DfynConfig[dexKey][network].initCode,
      DfynConfig[dexKey][network].feeCode,
      DfynConfig[dexKey][network].poolGasCost,
    );
  }

  getPoolIdentifiers(
    from: Token,
    to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const _from = WrapDfynWETH(from);
    const _to = WrapDfynWETH(to);
    return super.getPoolIdentifiers(_from, _to, side, blockNumber);
  }

  async getPricesVolume(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<ExchangePrices<UniswapV2Data> | null> {
    const _from = WrapDfynWETH(from);
    const _to = WrapDfynWETH(to);
    const prices = await super.getPricesVolume(
      _from,
      _to,
      amounts,
      side,
      blockNumber,
      limitPools,
    );

    return prices
      ? prices.map(p => ({ ...p, data: { ...p.data, weth: DfynWETH.address } }))
      : null;
  }

  public getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: UniswapData,
    side: SwapSide,
  ): DexExchangeParam {
    const _srcToken =
      this.isWETH(srcToken) || isETHAddress(srcToken)
        ? DfynWETH.address
        : srcToken;
    const _destToken =
      this.isWETH(destToken) || isETHAddress(destToken)
        ? DfynWETH.address
        : destToken;

    const param = super.getDexParam(
      _srcToken,
      _destToken,
      srcAmount,
      destAmount,
      recipient,
      data,
      side,
    );

    return {
      ...param,
      wethAddress: DfynWETH.address,
    };
  }
}
