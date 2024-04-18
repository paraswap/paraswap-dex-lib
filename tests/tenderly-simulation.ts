/* eslint-disable no-console */
import { Provider } from '@ethersproject/providers';
import { Address } from '@paraswap/core';
import axios from 'axios';
import { TxObject } from '../src/types';
import { StateOverrides, StateSimulateApiOverride } from './smart-tokens';
import { fixHexStringForTenderly } from './utils';

const TENDERLY_TOKEN = process.env.TENDERLY_TOKEN;
const TENDERLY_ACCOUNT_ID = process.env.TENDERLY_ACCOUNT_ID;
const TENDERLY_PROJECT = process.env.TENDERLY_PROJECT;
const TENDERLY_FORK_ID = process.env.TENDERLY_FORK_ID;
const TENDERLY_FORK_LAST_TX_ID = process.env.TENDERLY_FORK_LAST_TX_ID;

export type SimulationResult = {
  success: boolean;
  gasUsed?: string;
  url?: string;
  transaction?: any;
};

type FundingResult = {
  success: boolean;
  url?: string;
};

export interface TransactionSimulator {
  forkId: string;
  setup(): Promise<void>;

  simulate(
    params: TxObject,
    stateOverrides?: StateOverrides,
  ): Promise<SimulationResult>;

  addBalance(address: Address, amount: string): Promise<FundingResult>;
}

export class EstimateGasSimulation implements TransactionSimulator {
  forkId: string = '0';

  constructor(private provider: Provider) {}

  async setup() {}

  async addBalance(): Promise<FundingResult> {
    return { success: true };
  }

  async simulate(
    params: TxObject,
    _: StateOverrides,
  ): Promise<SimulationResult> {
    try {
      const result = await this.provider.estimateGas(params);
      return {
        success: true,
        gasUsed: result.toNumber().toString(),
      };
    } catch (e) {
      console.error(`Estimate gas simulation failed:`, e);
      return {
        success: false,
      };
    }
  }
}

export class TenderlySimulation implements TransactionSimulator {
  lastTx: string = '';
  forkId: string = '';
  maxGasLimit = 80000000;

  constructor(private network: Number = 1) {}

  async setup() {
    // Fork the mainnet
    if (!TENDERLY_TOKEN)
      throw new Error(
        `TenderlySimulation_setup: TENDERLY_TOKEN not found in the env`,
      );

    if (TENDERLY_FORK_ID) {
      if (!TENDERLY_FORK_LAST_TX_ID) throw new Error('Always set last tx id');
      this.forkId = TENDERLY_FORK_ID;
      this.lastTx = TENDERLY_FORK_LAST_TX_ID;
      return;
    }

    try {
      await process.nextTick(() => {}); // https://stackoverflow.com/questions/69169492/async-external-function-leaves-open-handles-jest-supertest-express
      let res = await axios.post(
        `https://api.tenderly.co/api/v1/account/${TENDERLY_ACCOUNT_ID}/project/${TENDERLY_PROJECT}/fork`,
        {
          network_id: this.network.toString(),
        },
        {
          timeout: 20000,
          headers: {
            'x-access-key': TENDERLY_TOKEN,
          },
        },
      );
      this.forkId = res.data.simulation_fork.id;
      this.lastTx = res.data.root_transaction.id;
    } catch (e) {
      console.error(`TenderlySimulation_setup:`, e);
      throw e;
    }
  }

  async simulate(params: TxObject, stateOverrides?: StateOverrides) {
    let _params = {
      from: params.from,
      to: params.to,
      save: true,
      root: this.lastTx,
      value: params.value || '0',
      gas: this.maxGasLimit,
      input: params.data,
      state_objects: {},
    };
    try {
      if (stateOverrides) {
        await process.nextTick(() => {}); // https://stackoverflow.com/questions/69169492/async-external-function-leaves-open-handles-jest-supertest-express
        const result = await axios.post(
          `
        https://api.tenderly.co/api/v1/account/${TENDERLY_ACCOUNT_ID}/project/${TENDERLY_PROJECT}/contracts/encode-states`,
          stateOverrides,
          {
            headers: {
              'x-access-key': TENDERLY_TOKEN!,
            },
          },
        );

        // if encode states fail, the simulation will most likely faily due to allowance/balance checks.
        if (result.status !== 200) {
          console.error(`TenderlySimulation_encodeStates`, result.data);
          return {
            success: false,
          };
        }

        _params.state_objects = Object.keys(result.data.stateOverrides).reduce(
          (acc, contract) => {
            const _storage = result.data.stateOverrides[contract].value;

            acc[contract] = {
              storage: _storage,
            };
            return acc;
          },
          {} as Record<Address, StateSimulateApiOverride>,
        );
      }

      await process.nextTick(() => {}); // https://stackoverflow.com/questions/69169492/async-external-function-leaves-open-handles-jest-supertest-express
      const { data } = await axios.post(
        `https://api.tenderly.co/api/v1/account/${TENDERLY_ACCOUNT_ID}/project/${TENDERLY_PROJECT}/fork/${this.forkId}/simulate`,
        _params,
        {
          timeout: 20 * 1000,
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
          url: `https://dashboard.tenderly.co/${TENDERLY_ACCOUNT_ID}/${TENDERLY_PROJECT}/fork/${this.forkId}/simulation/${lastTx}`,
          transaction: data.transaction,
        };
      } else {
        return {
          success: false,
          url: `https://dashboard.tenderly.co/${TENDERLY_ACCOUNT_ID}/${TENDERLY_PROJECT}/fork/${this.forkId}/simulation/${lastTx}`,
          error: `Simulation failed: ${data.transaction.error_info.error_message} at ${data.transaction.error_info.address}`,
        };
      }
    } catch (e) {
      console.error(`TenderlySimulation_simulate:`, e);
      return {
        success: false,
      };
    }
  }

  // Override the balance of an address (native token).
  // NOTE: you probably can't find these transactions on the dashboard as Tenderly does not include them in the list of transactions.
  async addBalance(address: string, amount: string): Promise<any> {
    try {
      const { data } = await axios.post(
        `https://rpc.tenderly.co/fork/${this.forkId}`,
        {
          method: 'tenderly_addBalance',
          params: [[address], fixHexStringForTenderly(amount)],
          id: this.network.toString(),
          jsonrpc: '2.0',
        },
        { headers: { 'Content-Type': 'application/json' } },
      );

      if ('error' in data) {
        console.error('addBalance error', data.error);
        return {
          success: false,
        };
      }

      let res = await axios.get(
        `https://api.tenderly.co/api/v1/account/paraswap/project/paraswap/fork/${this.forkId}/transactions`,
        {
          headers: { 'x-access-key': TENDERLY_TOKEN! },
          params: {
            page: 1,
            perPage: 1,
            exclude_internal: false,
          },
        },
      );
      this.lastTx = res.data.fork_transactions[0].id;
      // console.log(
      //   'Add Balance Success',
      //   `https://dashboard.tenderly.co/${TENDERLY_ACCOUNT_ID}/${TENDERLY_PROJECT}/fork/${this.forkId}/simulation/${this.lastTx}`,
      // );
      return {
        success: true,
      };
    } catch (err) {
      console.error(`TenderlySimulation_addBalance:`, err);
      return {
        success: false,
        url: `https://dashboard.tenderly.co/${TENDERLY_ACCOUNT_ID}/${TENDERLY_PROJECT}/fork/${this.forkId}/simulation/${this.lastTx}`,
      };
    }
  }
}
