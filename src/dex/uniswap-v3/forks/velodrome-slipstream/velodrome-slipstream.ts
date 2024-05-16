import {
  UniswapV3,
  UNISWAPV3_CLEAN_NOT_EXISTING_POOL_TTL_MS,
  UNISWAPV3_CLEAN_NOT_EXISTING_POOL_INTERVAL_MS,
} from '../../uniswap-v3';
import { Network, SwapSide } from '../../../../constants';
import { IDexHelper } from '../../../../dex-helper';
import { Adapters, UniswapV3Config } from '../../config';
import { Interface } from '@ethersproject/abi';
import UniswapV3RouterABI from '../../../../abi/uniswap-v3/UniswapV3Router.abi.json';
import UniswapV3QuoterV2ABI from '../../../../abi/uniswap-v3/UniswapV3QuoterV2.abi.json';
import { getDexKeysWithNetwork } from '../../../../utils';
import _ from 'lodash';
import { Address, NumberAsString, Token } from '../../../../types';
import { pack } from '@ethersproject/solidity';
import { PoolState } from '../../types';
import { VelodromeSlipstreamEventPool } from './velodrome-slipstream-pool';
import { UniswapV3EventPool } from '../../uniswap-v3-pool';

type VelodromeSlipstreamData = {
  path: {
    tokenIn: Address;
    tokenOut: Address;
    fee: NumberAsString;
    currentFee?: NumberAsString;
    tickSpacing?: NumberAsString;
  }[];
  isApproved?: boolean;
};

export class VelodromeSlipstream extends UniswapV3 {
  readonly eventPools: Record<string, VelodromeSlipstreamEventPool | null> = {};

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly routerIface = new Interface(UniswapV3RouterABI),
    readonly quoterIface = new Interface(UniswapV3QuoterV2ABI),
    protected config = UniswapV3Config[dexKey][network],
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
    getDexKeysWithNetwork(
      _.pick(UniswapV3Config, ['VelodromeSlipstream', 'AerodromeSlipstream']),
    );

  async initializePricing(blockNumber: number) {
    // Init listening to new pools creation
    await this.factory.initialize(blockNumber);

    if (!this.dexHelper.config.isSlave) {
      const cleanExpiredNotExistingPoolsKeys = async () => {
        const maxTimestamp =
          Date.now() - UNISWAPV3_CLEAN_NOT_EXISTING_POOL_TTL_MS;
        await this.dexHelper.cache.zremrangebyscore(
          this.notExistingPoolSetKey,
          0,
          maxTimestamp,
        );
      };

      this.intervalTask = setInterval(
        cleanExpiredNotExistingPoolsKeys.bind(this),
        UNISWAPV3_CLEAN_NOT_EXISTING_POOL_INTERVAL_MS,
      );
    }
  }

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

    const pools = (
      await Promise.all(
        this.config.tickSpacings!.map(async tickSpacing =>
          this.getPool(
            _srcAddress,
            _destAddress,
            this.config.tickSpacingsToFees![tickSpacing.toString()],
            blockNumber,
            tickSpacing,
          ),
        ),
      )
    ).filter(pool => pool);

    if (pools.length === 0) return [];

    return pools.map(pool =>
      this.getPoolIdentifier(_srcAddress, _destAddress, pool!.feeCode),
    );
  }

  protected _encodePath(
    path: {
      tokenIn: Address;
      tokenOut: Address;
      tickSpacing: NumberAsString;
      fee: NumberAsString;
    }[],
    side: SwapSide,
  ): string {
    if (path.length === 0) {
      this.logger.error(
        `${this.dexKey}: Received invalid path=${path} for side=${side} to encode`,
      );
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
            types: ['address', 'uint24', 'address'],
            _path: [curr.tokenIn, curr.tickSpacing, curr.tokenOut],
          };
        } else {
          return {
            types: [...types, 'uint24', 'address'],
            _path: [..._path, curr.tickSpacing, curr.tokenOut],
          };
        }
      },
      { _path: [], types: [] },
    );

    return side === SwapSide.BUY
      ? pack(types.reverse(), _path.reverse())
      : pack(types, _path);
  }

  protected prepareData(
    srcAddress: string,
    destAddress: string,
    pool: UniswapV3EventPool,
    state: PoolState,
  ): VelodromeSlipstreamData {
    return {
      path: [
        {
          tokenIn: srcAddress,
          tokenOut: destAddress,
          fee: pool.feeCode.toString(),
          currentFee: state.fee.toString(),
          tickSpacing: state.tickSpacing!.toString(),
        },
      ],
    };
  }

  protected getPoolInstance(
    token0: string,
    token1: string,
    fee: bigint,
    tickSpacing?: bigint,
  ) {
    return new VelodromeSlipstreamEventPool(
      this.dexHelper,
      this.dexKey,
      this.stateMultiContract,
      this.config.decodeStateMultiCallResultWithRelativeBitmaps,
      this.erc20Interface,
      this.config.factory,
      fee,
      token0,
      token1,
      this.logger,
      this.cacheStateKey,
      this.config.initHash,
      tickSpacing!,
    );
  }
}
