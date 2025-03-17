import { defaultAbiCoder } from '@ethersproject/abi';
import { AsyncOrSync } from 'ts-essentials';
import { AbiItem } from 'web3-utils';
import { pack } from '@ethersproject/solidity';
import _ from 'lodash';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  TransferFeeParams,
  Logger,
  DexExchangeParam,
  NumberAsString,
} from '../../types';
import {
  SwapSide,
  Network,
  SUBGRAPH_TIMEOUT,
  DEST_TOKEN_DEX_TRANSFERS,
  SRC_TOKEN_DEX_TRANSFERS,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { Interface } from 'ethers/lib/utils';
import { Contract } from 'web3-eth-contract';
import { BalanceRequest, getBalances } from '../../lib/tokens/balancer-fetcher';
import SwapRouter from '../../abi/algebra-integral/SwapRouter.abi.json';
import AlgebraQuoterABI from '../../abi/algebra-integral/Quoter.abi.json';
import UniswapV3MultiABI from '../../abi/uniswap-v3/UniswapMulti.abi.json';
import {
  _require,
  getBigIntPow,
  getDexKeysWithNetwork,
  interpolate,
  isDestTokenTransferFeeToBeExchanged,
  isSrcTokenTransferFeeToBeExchanged,
} from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { AlgebraIntegralData, Pool, AlgebraIntegralFunctions } from './types';
import {
  SimpleExchange,
  getLocalDeadlineAsFriendlyPlaceholder,
} from '../simple-exchange';
import { applyTransferFee } from '../../lib/token-transfer-fee';
import { AlgebraIntegralConfig } from './config';
import {
  AssetType,
  DEFAULT_ID_ERC20,
  DEFAULT_ID_ERC20_AS_STRING,
} from '../../lib/tokens/types';
import { extractReturnAmountPosition } from '../../executor/utils';

const ALGEBRA_QUOTE_GASLIMIT = 2_000_000;
const ALGEBRA_EFFICIENCY_FACTOR = 3;
export class AlgebraIntegral
  extends SimpleExchange
  implements IDex<AlgebraIntegralData>
{
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = true;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AlgebraIntegralConfig);

  logger: Logger;

  private uniswapMulti: Contract;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    readonly routerIface = new Interface(SwapRouter),
    readonly quoterIface = new Interface(AlgebraQuoterABI),
    readonly config = AlgebraIntegralConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.uniswapMulti = new this.dexHelper.web3Provider.eth.Contract(
      UniswapV3MultiABI as AbiItem[],
      this.config.uniswapMulticall,
    );
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  getPoolIdentifier(
    srcAddress: Address,
    destAddress: Address,
    deployerAddress: Address,
  ) {
    const tokenAddresses = this._sortTokens(srcAddress, destAddress).join('_');
    return `${this.dexKey}_${tokenAddresses}_${deployerAddress}`;
  }

  async initializePricing(blockNumber: number) {}

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);

    const [_srcAddress, _destAddress] = this._getLoweredAddresses(
      _srcToken,
      _destToken,
    );

    if (_srcAddress === _destAddress) return [];

    const pools = await this.getAvailablePools(_srcAddress, _destAddress);

    if (pools.length === 0) return [];

    return pools.map(pool =>
      this.getPoolIdentifier(_srcAddress, _destAddress, pool!.deployer),
    );
  }

  async getPricingFromRpc(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    pools: Pool[],
    transferFees: TransferFeeParams = {
      srcFee: 0,
      destFee: 0,
      srcDexFee: 0,
      destDexFee: 0,
    },
  ): Promise<ExchangePrices<AlgebraIntegralData> | null> {
    if (pools.length === 0) {
      return null;
    }
    this.logger.warn(`fallback to rpc for ${pools.length} pool(s)`);

    const requests = pools.map<BalanceRequest>(
      pool => ({
        owner: pool.poolAddress,
        asset: side == SwapSide.SELL ? from.address : to.address,
        assetType: AssetType.ERC20,
        ids: [
          {
            id: DEFAULT_ID_ERC20,
            spenders: [],
          },
        ],
      }),
      [],
    );

    const balances = await getBalances(this.dexHelper.multiWrapper, requests);

    pools = pools.filter((pool, index) => {
      const balance = balances[index].amounts[DEFAULT_ID_ERC20_AS_STRING];
      if (balance >= amounts[amounts.length - 1]) {
        return true;
      }
      this.logger.warn(
        `[${this.network}] have no balance ${pool.poolAddress} ${from.address} ${to.address}. (Balance: ${balance})`,
      );
      return false;
    });

    pools.forEach(pool => {
      this.logger.warn(
        `[${this.network}] fallback to rpc for ${pool.poolAddress} ${from.address} ${to.address}`,
      );
    });

    const _isSrcTokenTransferFeeToBeExchanged =
      isSrcTokenTransferFeeToBeExchanged(transferFees);
    const _isDestTokenTransferFeeToBeExchanged =
      isDestTokenTransferFeeToBeExchanged(transferFees);

    if (_isSrcTokenTransferFeeToBeExchanged && side == SwapSide.BUY) {
      this.logger.error(
        `DEX doesn't support buy for tax srcToken ${from.address}`,
      );
      return null;
    }

    const unitVolume = getBigIntPow(
      (side === SwapSide.SELL ? from : to).decimals,
    );

    const chunks = amounts.length - 1;

    const _width = Math.floor(chunks / this.config.chunksCount);

    const _amounts = [unitVolume].concat(
      Array.from(Array(this.config.chunksCount).keys()).map(
        i => amounts[(i + 1) * _width],
      ),
    );

    const _amountsWithFee = _isSrcTokenTransferFeeToBeExchanged
      ? applyTransferFee(
          _amounts,
          side,
          transferFees.srcDexFee,
          SRC_TOKEN_DEX_TRANSFERS,
        )
      : _amounts;

    const calldata = pools.map(pool =>
      _amountsWithFee.map(_amount => ({
        target: this.config.quoter,
        gasLimit: ALGEBRA_QUOTE_GASLIMIT,
        callData:
          side === SwapSide.SELL
            ? this.quoterIface.encodeFunctionData('quoteExactInputSingle', [
                from.address,
                to.address,
                pool.deployer,
                _amount.toString(),
                0, //sqrtPriceLimitX96
              ])
            : this.quoterIface.encodeFunctionData('quoteExactOutputSingle', [
                from.address,
                to.address,
                pool.deployer,
                _amount.toString(),
                0, //sqrtPriceLimitX96
              ]),
      })),
    );

    const data = await this.uniswapMulti.methods
      .multicall(calldata.flat())
      .call();

    let totalGasCost = 0;
    let totalSuccessFullSwaps = 0;
    const decode = (j: number): bigint => {
      const { success, gasUsed, returnData } = data.returnData[j];

      if (!success) {
        return 0n;
      }
      const decoded = defaultAbiCoder.decode(['uint256'], returnData);
      totalGasCost += +gasUsed;
      totalSuccessFullSwaps++;

      return BigInt(decoded[0].toString());
    };

    const averageGasCost = !totalSuccessFullSwaps
      ? ALGEBRA_QUOTE_GASLIMIT
      : Math.round(totalGasCost / totalSuccessFullSwaps);

    let i = 0;
    const result = pools.map(pool => {
      const _rates = _amountsWithFee.map(() => decode(i++));

      const _ratesWithFee = _isDestTokenTransferFeeToBeExchanged
        ? applyTransferFee(
            _rates,
            side,
            transferFees.destDexFee,
            DEST_TOKEN_DEX_TRANSFERS,
          )
        : _rates;

      const unit: bigint = _ratesWithFee[0];

      const prices = interpolate(
        _amountsWithFee.slice(1),
        _ratesWithFee.slice(1),
        amounts,
        side,
      );

      return {
        prices,
        unit,
        data: {
          feeOnTransfer: _isSrcTokenTransferFeeToBeExchanged,
          path: [
            {
              tokenIn: from.address,
              tokenOut: to.address,
              deployer: pool.deployer,
            },
          ],
        },
        poolIdentifier: this.getPoolIdentifier(
          pool.token0,
          pool.token1,
          pool.deployer,
        ),
        exchange: this.dexKey,
        gasCost: prices.map(p => (p === 0n ? 0 : averageGasCost)),
        poolAddresses: [pool.poolAddress],
      };
    });
    return result;
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
    transferFees: TransferFeeParams = {
      srcFee: 0,
      destFee: 0,
      srcDexFee: 0,
      destDexFee: 0,
    },
  ): Promise<null | ExchangePrices<AlgebraIntegralData>> {
    try {
      const _srcToken = this.dexHelper.config.wrapETH(srcToken);
      const _destToken = this.dexHelper.config.wrapETH(destToken);

      const [_srcAddress, _destAddress] = this._getLoweredAddresses(
        _srcToken,
        _destToken,
      );

      if (_srcAddress === _destAddress) return null;

      const pools = await this.getAvailablePools(_srcAddress, _destAddress);

      const rpcPrice = await this.getPricingFromRpc(
        _srcToken,
        _destToken,
        amounts,
        side,
        pools,
        transferFees,
      );

      return rpcPrice;
    } catch (e) {
      this.logger.error(
        `Error_getPricesVolume ${srcToken.symbol || srcToken.address}, ${
          destToken.symbol || destToken.address
        }, ${side}:`,
        e,
      );
      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<AlgebraIntegralData>,
  ): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: AlgebraIntegralData,
    side: SwapSide,
  ): DexExchangeParam {
    let swapFunction;
    let swapFunctionParams;

    if (data.feeOnTransfer) {
      _require(
        data.path.length === 1,
        `LOGIC ERROR: multihop is not supported for feeOnTransfer token, passed: ${data.path
          .map(p => `${p?.tokenIn}->${p?.tokenOut}`)
          .join(' ')}`,
      );
      swapFunction = AlgebraIntegralFunctions.exactInputWithFeeToken;
      swapFunctionParams = {
        limitSqrtPrice: '0',
        recipient: recipient,
        deadline: getLocalDeadlineAsFriendlyPlaceholder(),
        amountIn: srcAmount,
        amountOutMinimum: destAmount,
        tokenIn: data.path[0].tokenIn,
        tokenOut: data.path[0].tokenOut,
        deployer: data.path[0].deployer,
      };
    } else {
      swapFunction =
        side === SwapSide.SELL
          ? AlgebraIntegralFunctions.exactInput
          : AlgebraIntegralFunctions.exactOutput;
      const path = this._encodePath(data.path, side);
      swapFunctionParams =
        side === SwapSide.SELL
          ? {
              recipient: recipient,
              deadline: getLocalDeadlineAsFriendlyPlaceholder(),
              amountIn: srcAmount,
              amountOutMinimum: destAmount,
              path,
            }
          : {
              recipient: recipient,
              deadline: getLocalDeadlineAsFriendlyPlaceholder(),
              amountOut: destAmount,
              amountInMaximum: srcAmount,
              path,
            };
    }

    const exchangeData = this.routerIface.encodeFunctionData(swapFunction, [
      swapFunctionParams,
    ]);

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData,
      targetExchange: this.config.router,
      returnAmountPos:
        side === SwapSide.SELL
          ? extractReturnAmountPosition(
              this.routerIface,
              swapFunction,
              'amountOut',
            )
          : undefined,
    };
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AlgebraIntegralData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: this.config.router,
      payload,
      networkFee: '0',
    };
  }

  async getAvailablePools(
    srcToken: Address,
    destToken: Address,
  ): Promise<Pool[]> {
    // fetch only pools with positive totalValueLockedUSD
    const availablePoolsQuery = `query ($token0: Bytes!, $token1: Bytes!) {
      pools (where :{token0: $token0, token1: $token1, totalValueLockedUSD_gt: 0}, orderBy: totalValueLockedUSD, orderDirection: desc) { 
         id
         deployer
         token0{
          id 
          decimals
         }
         token1{
          id 
          decimals
         }
      }
   }`;

    const [token0, token1] =
      parseInt(srcToken, 16) < parseInt(destToken, 16)
        ? [srcToken, destToken]
        : [destToken, srcToken];

    const { data } = await this.dexHelper.httpRequest.querySubgraph<{
      data: {
        pools: {
          id: string;
          deployer: string;
        }[];
      };
    }>(
      this.config.subgraphURL,
      {
        query: availablePoolsQuery,
        variables: { token0, token1 },
      },
      { timeout: SUBGRAPH_TIMEOUT },
    );
    return data.pools.map(pool => ({
      poolAddress: pool.id,
      token0: token0,
      token1: token1,
      deployer: pool.deployer,
    }));
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const _tokenAddress = tokenAddress.toLowerCase();

    const res = await this._querySubgraph(
      `query ($token: Bytes!, $count: Int) {
                pools0: pools(first: $count, orderBy: totalValueLockedUSD, orderDirection: desc, where: {token0: $token}) {
                id
                deployer
                token0 {
                  id
                  decimals
                }
                token1 {
                  id
                  decimals
                }
                totalValueLockedUSD
              }
              pools1: pools(first: $count, orderBy: totalValueLockedUSD, orderDirection: desc, where: {token1: $token}) {
                id
                deployer
                token0 {
                  id
                  decimals
                }
                token1 {
                  id
                  decimals
                }
                totalValueLockedUSD
              }
            }`,
      {
        token: _tokenAddress,
        count: limit,
      },
    );

    if (!(res && res.pools0 && res.pools1)) {
      this.logger.error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );
      return [];
    }

    const pools0 = _.map(res.pools0, pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: [
        {
          address: pool.token1.id.toLowerCase(),
          decimals: parseInt(pool.token1.decimals),
        },
      ],
      liquidityUSD:
        parseFloat(pool.totalValueLockedUSD) * ALGEBRA_EFFICIENCY_FACTOR,
    }));

    const pools1 = _.map(res.pools1, pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: [
        {
          address: pool.token0.id.toLowerCase(),
          decimals: parseInt(pool.token0.decimals),
        },
      ],
      liquidityUSD:
        parseFloat(pool.totalValueLockedUSD) * ALGEBRA_EFFICIENCY_FACTOR,
    }));

    const pools = _.slice(
      _.sortBy(_.concat(pools0, pools1), [pool => -1 * pool.liquidityUSD]),
      0,
      limit,
    );
    return pools;
  }

  private async _querySubgraph(
    query: string,
    variables: Object,
    timeout = 30000,
  ) {
    try {
      const res = await this.dexHelper.httpRequest.querySubgraph(
        this.config.subgraphURL,
        { query, variables },
        { timeout },
      );
      return res.data;
    } catch (e) {
      this.logger.error(`${this.dexKey}: can not query subgraph: `, e);
      return {};
    }
  }

  private _encodePath(
    path: {
      tokenIn: Address;
      tokenOut: Address;
      deployer: Address;
    }[],
    side: SwapSide,
  ): string {
    if (path.length === 0) {
      return '0x';
    }

    const { _path, types } = path.reduce(
      (
        { _path, types }: { _path: string[]; types: string[] },
        curr,
        index,
      ): { _path: string[]; types: string[] } => {
        if (index === 0) {
          return {
            types: ['address', 'address', 'address'],
            _path: [curr.tokenIn, curr.deployer, curr.tokenOut],
          };
        } else {
          return {
            types: [...types, 'address', 'address'],
            _path: [..._path, curr.deployer, curr.tokenOut],
          };
        }
      },
      { _path: [], types: [] },
    );

    return side === SwapSide.BUY
      ? pack(types.reverse(), _path.reverse())
      : pack(types, _path);
  }

  private _sortTokens(srcAddress: Address, destAddress: Address) {
    return [srcAddress, destAddress].sort((a, b) => (a < b ? -1 : 1));
  }

  private _getLoweredAddresses(srcToken: Token, destToken: Token) {
    return [srcToken.address.toLowerCase(), destToken.address.toLowerCase()];
  }
}
