/* eslint-disable no-console */
import axios, { AxiosError } from 'axios';
import { TxObject } from '../src/types';
import { StateOverrides } from './smart-tokens';
import { Provider, StaticJsonRpcProvider } from '@ethersproject/providers';
import { ethers } from 'ethers';
import { Network } from '../build/constants';

const TENDERLY_TOKEN = process.env.TENDERLY_TOKEN;
const TENDERLY_ACCOUNT_ID = process.env.TENDERLY_ACCOUNT_ID;
const TENDERLY_PROJECT = process.env.TENDERLY_PROJECT;
const TENDERLY_VNET_ID = process.env.TENDERLY_VNET_ID;

export type SimulationResult = {
  success: boolean;
  gasUsed?: string;
  url?: string;
  transaction?: any;
};

export interface TransactionSimulator {
  vnetId: string;
  setup(): Promise<void>;

  simulate(
    params: TxObject,
    stateOverrides?: StateOverrides,
  ): Promise<SimulationResult>;
}

export class EstimateGasSimulation implements TransactionSimulator {
  vnetId: string = '0';

  constructor(private provider: Provider) {}

  async setup() {}

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
  vnetId: string = '';
  maxGasLimit = 80000000;

  private readonly chainIdToChainNameMap: { [key: number]: string } = {
    [Network.MAINNET]: 'mainnet',
    [Network.BSC]: 'bnb',
    [Network.POLYGON]: 'polygon',
    [Network.AVALANCHE]: 'avalanche-mainnet',
    [Network.FANTOM]: 'fantom',
    [Network.ARBITRUM]: 'arbitrum',
    [Network.OPTIMISM]: 'optimistic',
    [Network.GNOSIS]: 'gnosis-chain',
    [Network.BASE]: 'base',
  };

  constructor(private network: number = 1, vnetId?: string) {
    if (vnetId) {
      this.vnetId = vnetId;
    }
  }

  async setup() {
    if (!TENDERLY_TOKEN)
      throw new Error(
        `TenderlySimulation_setup: TENDERLY_TOKEN not found in the env`,
      );

    if (this.vnetId) return;

    if (TENDERLY_VNET_ID) {
      this.vnetId = TENDERLY_VNET_ID;
      return;
    }

    try {
      await process.nextTick(() => {}); // https://stackoverflow.com/questions/69169492/async-external-function-leaves-open-handles-jest-supertest-express
      let res = await axios.post(
        `https://api.tenderly.co/api/v1/account/${TENDERLY_ACCOUNT_ID}/project/${TENDERLY_PROJECT}/vnets`,
        {
          slug: `e2e-tests-testnetwork-${this.network.toString()}-${Date.now()}`,
          fork_config: {
            network_id: this.network,
          },
          virtual_network_config: {
            chain_config: {
              chain_id: this.network,
            },
          },
          sync_state_config: {
            enabled: false,
          },
          explorer_page_config: {
            enabled: true,
            verification_visibility: 'bytecode',
          },
        },
        {
          timeout: 200000,
          headers: {
            'X-Access-Key': TENDERLY_TOKEN,
          },
        },
      );
      this.vnetId = res.data.id;
    } catch (e) {
      console.error(`TenderlySimulation_setup:`, e);
      throw e;
    }
  }

  async simulate(params: TxObject, stateOverrides?: StateOverrides) {
    try {
      await process.nextTick(() => {}); // https://stackoverflow.com/questions/69169492/async-external-function-leaves-open-handles-jest-supertest-express
      const { data } = await axios.post(
        `https://api.tenderly.co/api/v1/account/${TENDERLY_ACCOUNT_ID}/project/${TENDERLY_PROJECT}/vnets/${this.vnetId}/transactions`,
        {
          callArgs: {
            from: params.from,
            to: params.to,
            value:
              params.value === '0'
                ? '0x0'
                : ethers.utils.hexStripZeros(
                    ethers.utils.hexlify(BigInt(params.value)),
                  ),
            gas: ethers.utils.hexStripZeros(
              ethers.utils.hexlify(BigInt(this.maxGasLimit)),
            ),
            data: params.data,
          },
          blockNumber: 'pending',
        },
        {
          timeout: 30 * 1000,
          headers: {
            'x-access-key': TENDERLY_TOKEN!,
          },
        },
      );

      if (data.status === 'success') {
        return {
          success: true,
          gasUsed: data.gasUsed,
          url: `https://dashboard.tenderly.co/${TENDERLY_ACCOUNT_ID}/${TENDERLY_PROJECT}/testnet/${
            this.vnetId
          }/tx/${this.chainIdToChainNameMap[this.network]}/${data.id}`,
          transaction: data.input,
        };
      } else {
        return {
          success: false,
          url: `https://dashboard.tenderly.co/${TENDERLY_ACCOUNT_ID}/${TENDERLY_PROJECT}/testnet/${
            this.vnetId
          }/tx/${this.chainIdToChainNameMap[this.network]}/${data.id}`,
          error: `Simulation failed`,
        };
      }
    } catch (e) {
      return {
        success: false,
      };
    }
  }
}
