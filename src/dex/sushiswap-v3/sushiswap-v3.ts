import _ from 'lodash';
import { createPublicClient, http } from 'viem';
import { DataFetcher, LiquidityProviders, Router, RPParams,  } from '@sushiswap/router';
import { Token as SushiToken } from '@sushiswap/currency';
import { SushiSwapV3Config, Adapters } from './config';
import { UniswapV3 } from '../uniswap-v3/uniswap-v3';
import { getViemChain } from './constants';
import { Network, SwapSide } from '../../constants';
import { getDexKeysWithNetwork, Utils } from '../../utils';
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
import { getLocalDeadlineAsFriendlyPlaceholder } from '../simple-exchange';
import { OptimalSwapExchange } from '@paraswap/core';
import { assert } from 'ts-essentials';
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

    assert(
      optimalSwapExchange.data !== undefined,
      `preProcessTransaction: data field is missing`,
    );

    if(options.isDirectMethod) {
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

      return [
        {
          ...optimalSwapExchange,
          data: {
            ...optimalSwapExchange.data,
            isApproved,
          },
        },
        {
          deadline: BigInt(getLocalDeadlineAsFriendlyPlaceholder()),
        },
      ];
    }

    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);

    console.log('DATA: ', options);

    console.log('_src token: ', _srcToken);
    console.log('_dest token: ', _destToken);
    console.log('side: ', side);

    const web3Client = createPublicClient({
      transport: http(generateConfig(this.network).privateHttpProvider),
      chain: getViemChain(this.network),
    });

    const dataFetcher = new DataFetcher(
      this.network,
      web3Client,
    );

    dataFetcher.startDataFetching([LiquidityProviders.SushiSwapV3]);

    const callData: MultiCallParams<number>[] = [
      {
        target: _srcToken.address,
        callData: this.erc20Interface.encodeFunctionData('decimals'),
        decodeFunction: uint256DecodeToNumber,
      },
      {
        target: _destToken.address,
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

    const fromToken = new SushiToken({
      address: _srcToken.address,
      decimals: decimals0.returnData,
      chainId: this.network,
    });

    const toToken = new SushiToken({
      address: _destToken.address,
      decimals: decimals1.returnData,
      chainId: this.network,
    });

    await dataFetcher.fetchPoolsForToken(fromToken, toToken);

    const pcMap = dataFetcher.getCurrentPoolCodeMap(fromToken, toToken);

    const route = Router.findBestRoute(
      pcMap,
      this.network,
      fromToken,
      BigNumber.from(optimalSwapExchange.srcAmount),
      toToken,
      50e9,
      [LiquidityProviders.SushiSwapV3],
    );

    console.log('ROUTE: ', route);

    const routerParams = Router.routeProcessor2Params(
      pcMap,
      route,
      fromToken,
      toToken,
      this.augustusAddress,
      this.config.router,
    );

    return [
      {
        ...optimalSwapExchange,
        data: {
          ...optimalSwapExchange.data,
          routerParams,
        },
      },
      {
        deadline: BigInt(getLocalDeadlineAsFriendlyPlaceholder()),
      },
    ];
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV3Data,
    side: SwapSide,
  ): AdapterExchangeParam {

    console.log('DATA ROUTE PARAMS: ', data.routerParams);

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
        tokenIn: data.routerParams!.tokenIn,
        amountIn: data.routerParams!.amountIn,
        tokenOut: data.routerParams!.tokenOut,
        amountOutMin: data.routerParams!.amountOutMin,
        to: data.routerParams!.to,
        route: data.routerParams!.routeCode,
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
    data: UniswapV3Data,
  ): Promise<SimpleExchangeParam> {
    const web3Client = createPublicClient({
      transport: http(generateConfig(this.network).privateHttpProvider),
      chain: getViemChain(this.network),
    });

    const dataFetcher = new DataFetcher(
      this.network,
      web3Client,
    );

    dataFetcher.startDataFetching([LiquidityProviders.SushiSwapV3]);

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

    const routerParams = Router.routeProcessor2Params(
      pcMap,
      route,
      fromToken,
      toToken,
      this.augustusAddress,
      this.config.router,
    );

    const swapData = this.routerIface.encodeFunctionData('processRoute', [
      routerParams.tokenIn,
      routerParams.amountIn,
      routerParams.tokenOut,
      routerParams.amountOutMin,
      routerParams.to,
      routerParams.routeCode,
    ]);

    dataFetcher.stopDataFetching();

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
