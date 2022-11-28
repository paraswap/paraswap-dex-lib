import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState } from './types';

export class AirSwapEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<PoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  constructor(
    public parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected airswapIface = new Interface(
      '[{"inputs":[{"internalType":"uint256","name":"_protocolFee","type":"uint256"},{"internalType":"uint256","name":"_protocolFeeLight","type":"uint256"},{"internalType":"address","name":"_protocolFeeWallet","type":"address"},{"internalType":"uint256","name":"_rebateScale","type":"uint256"},{"internalType":"uint256","name":"_rebateMax","type":"uint256"},{"internalType":"address","name":"_staking","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"signer","type":"address"},{"indexed":true,"internalType":"address","name":"signerWallet","type":"address"}],"name":"Authorize","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"nonce","type":"uint256"},{"indexed":true,"internalType":"address","name":"signerWallet","type":"address"}],"name":"Cancel","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"signer","type":"address"},{"indexed":true,"internalType":"address","name":"signerWallet","type":"address"}],"name":"Revoke","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"protocolFee","type":"uint256"}],"name":"SetProtocolFee","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"protocolFeeLight","type":"uint256"}],"name":"SetProtocolFeeLight","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"feeWallet","type":"address"}],"name":"SetProtocolFeeWallet","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"rebateMax","type":"uint256"}],"name":"SetRebateMax","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"rebateScale","type":"uint256"}],"name":"SetRebateScale","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"staking","type":"address"}],"name":"SetStaking","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"nonce","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"},{"indexed":true,"internalType":"address","name":"signerWallet","type":"address"},{"indexed":false,"internalType":"address","name":"signerToken","type":"address"},{"indexed":false,"internalType":"uint256","name":"signerAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"protocolFee","type":"uint256"},{"indexed":true,"internalType":"address","name":"senderWallet","type":"address"},{"indexed":false,"internalType":"address","name":"senderToken","type":"address"},{"indexed":false,"internalType":"uint256","name":"senderAmount","type":"uint256"}],"name":"Swap","type":"event"},{"inputs":[],"name":"DOMAIN_CHAIN_ID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DOMAIN_NAME","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DOMAIN_SEPARATOR","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DOMAIN_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DOMAIN_VERSION","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"FEE_DIVISOR","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ORDER_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"signer","type":"address"}],"name":"authorize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"authorized","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"address","name":"signerWallet","type":"address"},{"internalType":"address","name":"signerToken","type":"address"},{"internalType":"uint256","name":"signerID","type":"uint256"},{"internalType":"address","name":"senderToken","type":"address"},{"internalType":"uint256","name":"senderAmount","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"buyNFT","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"stakingBalance","type":"uint256"},{"internalType":"uint256","name":"feeAmount","type":"uint256"}],"name":"calculateDiscount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"wallet","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"calculateProtocolFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256[]","name":"nonces","type":"uint256[]"}],"name":"cancel","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"senderWallet","type":"address"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"address","name":"signerWallet","type":"address"},{"internalType":"address","name":"signerToken","type":"address"},{"internalType":"uint256","name":"signerAmount","type":"uint256"},{"internalType":"address","name":"senderToken","type":"address"},{"internalType":"uint256","name":"senderAmount","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"check","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"bytes32[]","name":"","type":"bytes32[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getChainId","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"address","name":"signerWallet","type":"address"},{"internalType":"address","name":"signerToken","type":"address"},{"internalType":"uint256","name":"signerAmount","type":"uint256"},{"internalType":"address","name":"senderToken","type":"address"},{"internalType":"uint256","name":"senderAmount","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"light","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"signer","type":"address"},{"internalType":"uint256","name":"nonce","type":"uint256"}],"name":"nonceUsed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"protocolFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"protocolFeeLight","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"protocolFeeWallet","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rebateMax","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rebateScale","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"revoke","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"address","name":"signerWallet","type":"address"},{"internalType":"address","name":"signerToken","type":"address"},{"internalType":"uint256","name":"signerAmount","type":"uint256"},{"internalType":"address","name":"senderToken","type":"address"},{"internalType":"uint256","name":"senderID","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"sellNFT","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_protocolFee","type":"uint256"}],"name":"setProtocolFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_protocolFeeLight","type":"uint256"}],"name":"setProtocolFeeLight","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_protocolFeeWallet","type":"address"}],"name":"setProtocolFeeWallet","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rebateMax","type":"uint256"}],"name":"setRebateMax","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rebateScale","type":"uint256"}],"name":"setRebateScale","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newstaking","type":"address"}],"name":"setStaking","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"staking","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"address","name":"signerWallet","type":"address"},{"internalType":"address","name":"signerToken","type":"address"},{"internalType":"uint256","name":"signerAmount","type":"uint256"},{"internalType":"address","name":"senderToken","type":"address"},{"internalType":"uint256","name":"senderAmount","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"swap","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"address","name":"signerWallet","type":"address"},{"internalType":"address","name":"signerToken","type":"address"},{"internalType":"uint256","name":"signerID","type":"uint256"},{"internalType":"address","name":"senderToken","type":"address"},{"internalType":"uint256","name":"senderID","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"swapNFTs","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}]',
    ), // TODO: add any additional params required for event subscriber
  ) {
    super(parentName, parentName, dexHelper, logger);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.airswapIface.parseLog(log);
    this.addressesSubscribed = [
      /* subscribed addresses */
    ];

    // Add handlers
    this.handlers['Swap'] = this.handleSwap.bind(this);
  }

  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    // TODO: complete me!
    return {};
  }

  // Its just a dummy example
  handleSwap(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }
}
