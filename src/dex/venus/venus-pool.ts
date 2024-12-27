import { chunk } from 'lodash';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { ObjWithUpdateInfo } from '../../lib/stateful-rpc-poller/types';
import {
  // DecimalInfo,
  DexParams,
  MulticallResultOutputs,
  PoolState,
  PoolConfig,
  // TokenState,
} from './types';
import { StatefulRpcPoller } from '../../lib/stateful-rpc-poller/stateful-rpc-poller';
import TokenConverter from '../../abi/venus/token-converter.json';
import { pollingManagerCbExtractor } from '../../lib/stateful-rpc-poller/utils';
import { StatePollingManager } from '../../lib/stateful-rpc-poller/state-polling-manager';
import { MultiCallParams, MultiResult } from '../../lib/multi-wrapper';
import { uint256ToBigInt } from '../../lib/decoders';
import { decodeAmountOut } from './utils';
import { parseUnits, Interface } from 'ethers/lib/utils';
import erc20ABI from '../../abi/erc20.json';
import resilientOracleABI from '../../abi/venus/resilient-oracle.json';

export class VenusPollingPool extends StatefulRpcPoller<
  PoolState,
  MulticallResultOutputs
> {
  constructor(
    dexKey: string,
    poolIdentifier: string,
    dexHelper: IDexHelper,
    protected config: DexParams,
    protected tokenConverter: PoolConfig,
  ) {
    const callbacks = pollingManagerCbExtractor(
      StatePollingManager.getInstance(dexHelper),
    );

    super(dexKey, poolIdentifier, dexHelper, 0, 0, false, callbacks);
  }

  protected _getFetchStateMultiCalls(): MultiCallParams<MulticallResultOutputs>[] {
    const erc20Iface = new Interface(erc20ABI);
    const tokenConverterIface = new Interface(TokenConverter);
    const resilientOracleIface = new Interface(resilientOracleABI);
    const multicalls = this.tokenConverter.configs
      .map(
        ({
          tokenOut: { address: tokenOutAddress },
          tokenIn: { address: tokenInAddress, decimals: tokenInDecimals },
        }) => [
          {
            target: this.tokenConverter.address,
            callData: tokenConverterIface.encodeFunctionData(
              'getUpdatedAmountOut',
              [
                parseUnits('1', tokenInDecimals),
                tokenInAddress,
                tokenOutAddress,
              ],
            ),
            decodeFunction: decodeAmountOut,
          },
          {
            target: tokenOutAddress,
            callData: erc20Iface.encodeFunctionData('balanceOf', [
              this.tokenConverter.address,
            ]),
            decodeFunction: uint256ToBigInt,
          },
          {
            target: this.tokenConverter.priceOracleAddress,
            callData: resilientOracleIface.encodeFunctionData('getPrice', [
              tokenOutAddress,
            ]),
            decodeFunction: uint256ToBigInt,
          },
        ],
      )
      .flat();

    return multicalls;
  }

  protected _parseStateFromMultiResults(
    multiOutputs: MulticallResultOutputs[],
  ): PoolState {
    const poolState: PoolState = {};

    chunk(multiOutputs, 3).forEach((chunk, i) => {
      const {
        tokenOut: { address },
      } = this.tokenConverter.configs[i];
      const [amounts, balance, price] = chunk as [
        [bigint, bigint],
        bigint,
        bigint,
      ];

      poolState[address] = {
        balance,
        price,
        amountConverted: amounts[0],
        amountOut: amounts[1],
      };
    });

    return poolState;
  }

  async fetchLatestStateFromRpc(): Promise<ObjWithUpdateInfo<PoolState> | null> {
    const multiCalls = this.getFetchStateWithBlockInfoMultiCalls();
    try {
      const lastUpdatedAtMs = Date.now();
      const aggregatedResults = (await this.dexHelper.multiWrapper.tryAggregate<
        number | MulticallResultOutputs
      >(
        true,
        multiCalls as MultiCallParams<MulticallResultOutputs | number>[],
        undefined,
        20,
      )) as [MultiResult<number>, ...MultiResult<MulticallResultOutputs>[]];

      return this.parseStateFromMultiResultsWithBlockInfo(
        aggregatedResults,
        lastUpdatedAtMs,
      );
    } catch (e) {
      this._logMessageWithSuppression('ERROR_FETCHING_STATE_FROM_RPC', e);
    }

    return null;
  }
}
