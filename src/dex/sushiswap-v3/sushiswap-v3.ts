import _ from 'lodash';
import { createPublicClient, http } from 'viem';
import { DataFetcher, LiquidityProviders, Router, RPParams } from '@sushiswap/router';
import { Token as SushiToken } from '@sushiswap/currency';
import { SushiSwapV3Config, Adapters } from './config';
import { UniswapV3 } from '../uniswap-v3/uniswap-v3';
import { getViemChain } from './constants';
import { Network, SwapSide } from '../../constants';
import { getDexKeysWithNetwork } from '../../utils';
import SushiswapV3RouterABI from '../../abi/sushiswap-v3/RouterProcessor3.json';
import SushiswapV3QuoterV2ABI from '../../abi/sushiswap-v3/QuoterV2.json';
import { IDexHelper } from '../../dex-helper';
import { Interface } from '@ethersproject/abi';
import {
  AdapterExchangeParam,
  ExchangeTxInfo,
  PreprocessTransactionOptions,
  SimpleExchangeParam,
  Token,
} from '../../types';
import { generateConfig } from '../../config';
import { BigNumber } from 'ethers';
import { getLocalDeadlineAsFriendlyPlaceholder, SimpleExchange } from '../simple-exchange';
import { OptimalSwapExchange } from '@paraswap/core';
import { assert } from 'ts-essentials';
import { SushiSwapV3Data } from './types';
import { UniswapV3Data} from '../uniswap-v3/types';
import { MultiCallParams } from '../../lib/multi-wrapper';
import { uint256DecodeToNumber } from '../../lib/decoders';

export class SushiSwapV3 extends UniswapV3 {

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly routerIface = new Interface(SushiswapV3RouterABI),
    readonly quoterIface = new Interface(SushiswapV3QuoterV2ABI),
    protected config = SushiSwapV3Config[dexKey][network],
    protected poolsToPreload = [],
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      adapters,
      routerIface,
      quoterIface,
      config,
      poolsToPreload,
    );
  }

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(SushiSwapV3Config, ['SushiSwapV3']));

  async preProcessTransaction(
    optimalSwapExchange: OptimalSwapExchange<UniswapV3Data>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<UniswapV3Data>, ExchangeTxInfo]> {
    if (!options.isDirectMethod) {
      return [
        optimalSwapExchange,
        {
          deadline: BigInt(getLocalDeadlineAsFriendlyPlaceholder()),
        },
      ];
    }

    assert(
      optimalSwapExchange.data !== undefined,
      `preProcessTransaction: data field is missing`,
    );

    let isApproved: boolean | undefined;

    try {
      this.erc20Contract.options.address =
        this.dexHelper.config.wrapETH(srcToken).address;
      const allowance = await this.erc20Contract.methods
        .allowance(this.augustusAddress, this.config.router)
        .call(undefined, 'latest');
      isApproved =
        BigInt(allowance.toString()) >= BigInt(optimalSwapExchange.srcAmount);
    } catch (e) {
      this.logger.error(
        `preProcessTransaction failed to retrieve allowance info: `,
        e,
      );
    }

    const rpParams = await this.getSushiV3Params(
      srcToken.address,
      destToken.address,
      optimalSwapExchange.srcAmount,
    );

    console.log('preprocess tx: ', rpParams);

    return [
      {
        ...optimalSwapExchange,
        data: {
          ...optimalSwapExchange.data,
          isApproved,
          rpParams,
        },
      },
      {
        deadline: BigInt(getLocalDeadlineAsFriendlyPlaceholder()),
      },
    ];
  }

  async getSushiV3Params(
    srcToken: string,
    destToken: string,
    srcAmount: string,
  ): Promise<RPParams> {
    const web3Client = createPublicClient({
      transport: http(generateConfig(this.network).privateHttpProvider),
      chain: getViemChain(this.network),
    });

    const dataFetcher = new DataFetcher(
      this.network,
      web3Client,
    );

    const callData: MultiCallParams<number>[] = [
      {
        target: srcToken,
        callData: this.erc20Interface.encodeFunctionData('decimals'),
        decodeFunction: uint256DecodeToNumber,
      },
      {
        target: destToken,
        callData: this.erc20Interface.encodeFunctionData('decimals'),
        decodeFunction: uint256DecodeToNumber,
      }
    ];

    const [decimals0, decimals1] =
      await this.dexHelper.multiWrapper.tryAggregate<number>(
        false,
        callData,
        undefined,
        this.dexHelper.multiWrapper.defaultBatchSize,
        false,
      );

    dataFetcher.startDataFetching([LiquidityProviders.SushiSwapV3]);

    const fromToken = new SushiToken({
      address: srcToken,
      decimals: decimals0.returnData,
      chainId: this.network,
    });

    const toToken = new SushiToken({
      address: destToken,
      decimals: decimals1.returnData,
      chainId: this.network,
    });

    await dataFetcher.fetchPoolsForToken(fromToken, toToken);

    const pcMap = dataFetcher.getCurrentPoolCodeMap(fromToken, toToken);

    const route = Router.findBestRoute(
      pcMap,
      this.network,
      fromToken,
      BigNumber.from(srcAmount),
      toToken,
      50e9,
      [LiquidityProviders.SushiSwapV3],
    );

    console.log('ROUTE: ', route);

    const rpParams = Router.routeProcessor2Params(
      pcMap,
      route,
      fromToken,
      toToken,
      this.augustusAddress,
      this.config.router,
    );

    dataFetcher.stopDataFetching();

    return rpParams;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SushiSwapV3Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    console.log('getAdapterParam: ', data.rpParams);

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          tokenIn: 'address',
          amountIn: 'uint256',
          tokenOut: 'address',
          amountOutMin: 'uint256',
          to: 'address',
          route: 'bytes',
        },
      },
      {
        tokenIn: data.rpParams!.tokenIn,
        amountIn: data.rpParams!.amountIn,
        tokenOut: data.rpParams!.tokenOut,
        amountOutMin: data.rpParams!.amountOutMin,
        to: data.rpParams!.to,
        route: data.rpParams!.routeCode,
      },
    );

    return {
      targetExchange: this.config.router,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SushiSwapV3Data,
  ): Promise<SimpleExchangeParam> {

    const routerParams = await this.getSushiV3Params(srcToken, destToken, destAmount);

    console.log('getSimpleParam: ', routerParams);

    const swapData = this.routerIface.encodeFunctionData('processRoute', [
      routerParams.tokenIn,
      routerParams.amountIn,
      routerParams.tokenOut,
      routerParams.amountOutMin,
      routerParams.to,
      routerParams.routeCode,
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.config.router,
    );
  }
}
