import _ from 'lodash';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  DecimalInfo,
  DexParams,
  MulticallResultOutputs,
  PoolState,
  TokenInfo,
  TokenState,
} from './types';
import { StatefulRpcPoller } from '../../lib/stateful-rpc-poller/stateful-rpc-poller';
import { pollingManagerCbExtractor } from '../../lib/stateful-rpc-poller/utils';
import { StatePollingManager } from '../../lib/stateful-rpc-poller/state-polling-manager';
import { MultiCallParams } from '../../lib/multi-wrapper';
import { booleanDecode, uint256ToBigInt } from '../../lib/decoders';
import { ifaces } from './utils';
import { Token } from '../../types';
import { decimalInfoDecoder, stateDecoder, tokenInfoDecoder } from './decoders';

export class WooFiV2PollingPool extends StatefulRpcPoller<
  PoolState,
  MulticallResultOutputs
> {
  constructor(
    dexKey: string,
    poolIdentifier: string,
    dexHelper: IDexHelper,
    protected config: DexParams,
    // It already includes quoteToken
    protected tokens: Token[],
  ) {
    const callbacks = pollingManagerCbExtractor(
      StatePollingManager.getInstance(dexHelper),
    );

    super(dexKey, poolIdentifier, dexHelper, 0, 0, false, callbacks);
  }

  protected _getFetchStateMultiCalls(): MultiCallParams<MulticallResultOutputs>[] {
    return (
      [
        {
          target: this.config.wooPPV2Address,
          callData: ifaces.PPV2.encodeFunctionData('paused', []),
          decodeFunction: booleanDecode,
        },
        {
          target: this.config.wooOracleV2Address,
          callData: ifaces.PPV2.encodeFunctionData('timestamp', []),
          decodeFunction: uint256ToBigInt,
        },
      ] as MultiCallParams<MulticallResultOutputs>[]
    ).concat(
      this.tokens
        .map(t => [
          {
            target: this.config.wooPPV2Address,
            callData: ifaces.PPV2.encodeFunctionData('tokenInfos', [t.address]),
            decodeFunction: tokenInfoDecoder,
          },
          {
            target: this.config.wooPPV2Address,
            callData: ifaces.PPV2.encodeFunctionData('decimalInfo', [
              t.address,
            ]),
            decodeFunction: decimalInfoDecoder,
          },
          {
            target: this.config.wooOracleV2Address,
            callData: ifaces.PPV2.encodeFunctionData('state', [t.address]),
            decodeFunction: stateDecoder,
          },
        ])
        .flat(),
    );
  }

  protected _parseStateFromMultiResults(
    multiOutputs: MulticallResultOutputs[],
  ): PoolState {
    const [isPaused, oracleTimestamp, ...remained] = multiOutputs as [
      boolean,
      bigint,
      ...MulticallResultOutputs[],
    ];

    const tokenInfos: Record<string, TokenInfo> = {};
    const decimals: Record<string, DecimalInfo> = {};
    const tokenStates: Record<string, TokenState> = {};

    _.chunk(remained, 3).forEach((chunk, i) => {
      const [tokenInfo, decimalInfo, tokenState] = chunk as [
        TokenInfo,
        DecimalInfo,
        TokenState,
      ];
      const token = this.tokens[i];

      tokenInfos[token.address] = tokenInfo;
      decimals[token.address] = decimalInfo;
      tokenStates[token.address] = tokenState;
    });

    return {
      tokenInfos,
      tokenStates,
      decimals,
      oracleTimestamp,
      isPaused,
    };
  }
}
