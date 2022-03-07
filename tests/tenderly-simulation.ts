import axios from 'axios';
import { TxObject } from '../src/types';

const TENDERLY_TOKEN = process.env.TENDERLY_TOKEN;

export class TenderlySimulation {
  lastTx: string = '';
  forkId: string = '';
  maxGasLimit = 8000000;

  constructor(private network: Number = 1) {}

  async setup() {
    // Fork the mainnet
    if (!TENDERLY_TOKEN)
      throw new Error(
        `TenderlySimulation_setup: TENDERLY_TOKEN not found in the env`,
      );

    try {
      let res = await axios.post(
        `https://api.tenderly.co/api/v1/account/paraswap/project/paraswap/fork`,
        {
          network_id: this.network.toString(),
        },
        {
          timeout: 10000,
          headers: {
            'x-access-key': TENDERLY_TOKEN,
          },
        },
      );
      this.forkId = res.data.simulation_fork.id;
      this.lastTx = res.data.root_transaction.id;
    } catch (e) {
      console.error(`TenderlySimulation_setup: ${e.message}`, e.trace);
      throw e;
    }
  }

  async simulate(params: TxObject) {
    let _params = {
      from: params.from,
      to: params.to,
      save: true,
      root: this.lastTx,
      value: params.value || '0',
      gas: this.maxGasLimit,
      input: params.data,
    };
    try {
      const { data } = await axios.post(
        `https://api.tenderly.co/api/v1/account/paraswap/project/paraswap/fork/${this.forkId}/simulate`,
        _params,
        {
          timeout: 10 * 1000,
          headers: {
            'x-access-key': TENDERLY_TOKEN!,
          },
        },
      );
      const lastTx = data.simulation.id;
      if (data.transaction.status) {
        this.lastTx = lastTx;
        return {
          success: true,
          gasUsed: data.transaction.gas_used,
          tenderlyUrl: `https://dashboard.tenderly.co/paraswap/paraswap/fork/${this.forkId}/simulation/${lastTx}`,
          transaction: data.transaction,
        };
      } else {
        return {
          success: false,
          tenderlyUrl: `https://dashboard.tenderly.co/paraswap/paraswap/fork/${this.forkId}/simulation/${lastTx}`,
          error: `Simulation failed: ${data.transaction.error_info.error_message} at ${data.transaction.error_info.address}`,
        };
      }
    } catch (e) {
      console.error(`TenderlySimulation_simulate: ${e.message}`, e.trace);
      return {
        success: false,
        error: e.message,
        tenderlyUrl: '',
      };
    }
  }
}
