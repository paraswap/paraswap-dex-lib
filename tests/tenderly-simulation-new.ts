/* eslint-disable no-console */
import 'dotenv/config';
import axios from 'axios';
import { ethers } from 'ethers';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ETHER_ADDRESS } from '../src/constants';

const TENDERLY_TOKEN = process.env.TENDERLY_TOKEN!;
const TENDERLY_ACCOUNT_ID = process.env.TENDERLY_ACCOUNT_ID!;
const TENDERLY_PROJECT = process.env.TENDERLY_PROJECT!;

interface StorageOverride {
  storage: Record<string, string>; // storage slot -> value
}
export type StateOverride = Record<string, StorageOverride>; // contract -> storage override

interface TokenStorageSlots {
  balanceSlot: string;
  allowanceSlot: string;
}

interface SimulateTransactionRequest {
  from: string | null;
  to: string | null;
  data: string;
  chainId: number;
  timestamp?: number;
  blockNumber?: number;
  stateOverride?: StateOverride;
}

// not fully complete
interface SimulatedTransactionCall {
  hash: string;
  contract_name: string;
  function_name: string;
  function_pc: number;
  function_op: string;
  function_file_index: number;
  function_code_start: number;
  function_line_number: number;
  function_code_length: number;
  absolute_position: number;
  caller_pc: number;
  caller_op: string;
  call_type: string;
  address: string;
  from: string;
  from_balance: string;
  to: string;
  to_balance: string;
  value: string | null;
  caller: {
    address: string;
    balance: string;
  };
  block_timestamp: string;
  gas: number;
  gas_used: number;
  intrinsic_gas: number;
  storage_address: string;
  input: string;
  storage_slot: string[] | undefined;
  calls: SimulatedTransactionCall[] | null;
}

// not fully complete
interface Simulation {
  id: string;
  project_id: string;
  owner_id: string;
  network_id: string;
  block_number: number;
  transaction_index: number;
  from: string;
  to: string;
  input: string;
  gas: number;
  gas_price: string;
  gas_used: number;
  value: string;
  method: string;
  status: boolean;
}

// not complete, all details include a lot more info
interface SimulatedTransactionDetails {
  transaction: {
    hash: string;
    block_hash: string;
    block_number: number;
    from: string;
    gas: number;
    gas_price: number;
    gas_fee_cap: number;
    gas_tip_cap: number;
    cumulative_gas_used: number;
    gas_used: number;
    effective_gas_price: number;
    input: string;
    nonce: number;
    to: string;
    index: number;
    value: string;
    access_list: null;
    status: boolean;
    transaction_info: {
      call_trace: SimulatedTransactionCall;
    };
  };
}

export class TenderlySimulatorNew {
  private static instance: TenderlySimulatorNew;

  private constructor() {}

  public static getInstance(): TenderlySimulatorNew {
    if (!TenderlySimulatorNew.instance) {
      TenderlySimulatorNew.instance = new TenderlySimulatorNew();
    }

    return TenderlySimulatorNew.instance;
  }

  public async simulateTransaction(
    request: SimulateTransactionRequest,
  ): Promise<Simulation> {
    const data = {
      network_id: request.chainId,
      from: request.from,
      to: request.to,
      input: request.data,
      save: true,
      save_if_fails: true,
      state_objects: request.stateOverride,
    };

    console.log('Sending transaction simulation with params:');
    console.log(JSON.stringify(data, null, 2));

    const response = await axios.request({
      method: 'POST',
      url: `https://api.tenderly.co/api/v1/account/${TENDERLY_ACCOUNT_ID}/project/${TENDERLY_PROJECT}/simulate`,
      headers: {
        'X-Access-Key': TENDERLY_TOKEN,
      },
      data,
    });

    const simulation = response.data.simulation as Simulation;
    const url = `https://dashboard.tenderly.co/${TENDERLY_ACCOUNT_ID}/${TENDERLY_PROJECT}/simulator/${simulation.id}`;

    console.log('Successfully simulated a transaction:');
    console.log(`Simulation URL - ${url}`);

    return simulation;
  }

  public async getSimulatedTransactionDetails(
    id: string,
  ): Promise<SimulatedTransactionDetails | null> {
    try {
      const { data } = await axios.post(
        `https://api.tenderly.co/api/v1/account/${TENDERLY_ACCOUNT_ID}/project/${TENDERLY_PROJECT}/simulations/${id}`,
        {},
        { headers: { 'X-Access-Key': TENDERLY_TOKEN } },
      );

      return data;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  getSLOADCalls = (
    callTrace: SimulatedTransactionCall,
  ): SimulatedTransactionCall[] => {
    const results: SimulatedTransactionCall[] = [];

    if (callTrace.call_type === 'SLOAD') {
      results.push(callTrace);
    }

    if (callTrace.calls) {
      for (const call of callTrace.calls) {
        results.push(...this.getSLOADCalls(call));
      }
    }

    return results;
  };

  /**
   *
   * @param balanceOfSlot storage slot of `balanceOf` mapping
   * @param owner account's address
   */
  calculateAddressBalanceSlot(balanceOfSlot: string, owner: string) {
    return ethers.utils.keccak256(
      ethers.utils.concat([ethers.utils.hexZeroPad(owner, 32), balanceOfSlot]),
    );
  }

  /**
   *
   * @param allowanceSlot storage slot of `allowance` mapping
   * @param owner account's address
   * @param spender spender's address
   */
  calculateAddressAllowanceSlot(
    allowanceSlot: string,
    owner: string,
    spender: string,
  ) {
    const slotHash = ethers.utils.keccak256(
      ethers.utils.concat([
        ethers.utils.hexZeroPad(owner, 32),
        ethers.utils.hexZeroPad(allowanceSlot, 32),
      ]),
    );

    return ethers.utils.keccak256(
      ethers.utils.concat([ethers.utils.hexZeroPad(spender, 32), slotHash]),
    );
  }

  buildBalanceOfSimulationRequest(
    chainId: number,
    token: string,
    owner: string,
  ): SimulateTransactionRequest {
    const iface = new ethers.utils.Interface([
      'function balanceOf(address owner) view returns (uint)',
    ]);

    return {
      from: ethers.constants.AddressZero,
      to: token,
      data: iface.encodeFunctionData('balanceOf', [owner]),
      chainId,
    };
  }

  buildAllowanceSimulationRequest(
    chainId: number,
    token: string,
    owner: string,
    spender: string,
  ): SimulateTransactionRequest {
    const iface = new ethers.utils.Interface([
      'function allowance(address owner, address spender) view returns (uint)',
    ]);

    return {
      from: ethers.constants.AddressZero,
      to: token,
      data: iface.encodeFunctionData('allowance', [owner, spender]),
      chainId,
    };
  }

  async findTokenBalanceOfSlot(
    chainId: number,
    token: string,
  ): Promise<string> {
    const account = ethers.constants.AddressZero;

    const balanceOfSimulationRequest = this.buildBalanceOfSimulationRequest(
      chainId,
      token,
      account,
    );

    const { id: simulationId } = await this.simulateTransaction(
      balanceOfSimulationRequest,
    );

    const simulationDetails = await this.getSimulatedTransactionDetails(
      simulationId,
    );

    if (!simulationDetails) {
      throw `No simulation with id ${simulationId} details found`;
    }

    const callTrace = simulationDetails.transaction.transaction_info.call_trace;

    const sloadCalls = this.getSLOADCalls(callTrace);
    // token's storage slots that were read during the `balanceOf` call
    const readSlots = sloadCalls
      .map(call => call.storage_slot?.[0])
      .filter<string>((slot): slot is string => !!slot);

    for (let i = 0; i < 1_000; i += 1) {
      const candidateSlot = ethers.utils.defaultAbiCoder.encode(['uint'], [i]);
      const balanceOfSlot = this.calculateAddressBalanceSlot(
        candidateSlot,
        account,
      );

      if (readSlots.includes(balanceOfSlot)) {
        return candidateSlot;
      }
    }

    throw new Error(
      `Could not find a 'balanceOf' mapping slot for token ${token} on chain ${chainId}`,
    );
  }

  async findTokenAllowanceSlot(
    chainId: number,
    token: string,
  ): Promise<string> {
    const account = ethers.constants.AddressZero;
    const spender = ethers.constants.AddressZero.slice(0, -2) + '01';

    const allowanceSimulationRequest = this.buildAllowanceSimulationRequest(
      chainId,
      token,
      account,
      spender,
    );

    const { id: simulationId } = await this.simulateTransaction(
      allowanceSimulationRequest,
    );

    const simulationDetails = await this.getSimulatedTransactionDetails(
      simulationId,
    );

    if (!simulationDetails) {
      throw `No simulation with id ${simulationId} details found`;
    }

    const callTrace = simulationDetails.transaction.transaction_info.call_trace;

    const sloadCalls = this.getSLOADCalls(callTrace);
    // token's storage slots that were read during the `allowance` call
    const readSlots = sloadCalls
      .map(call => call.storage_slot?.[0])
      .filter<string>((slot): slot is string => !!slot);

    for (let i = 0; i < 1_000; i += 1) {
      const candidateSlot = ethers.utils.defaultAbiCoder.encode(['uint'], [i]);
      const balanceOfSlot = this.calculateAddressAllowanceSlot(
        candidateSlot,
        account,
        spender,
      );

      if (readSlots.includes(balanceOfSlot)) {
        return candidateSlot;
      }
    }

    throw new Error(
      `Could not find a 'allowance' mapping slot for token ${token} on chain ${chainId}`,
    );
  }

  async getTokenStorageSlots(
    chainId: number,
    token: string,
  ): Promise<TokenStorageSlots> {
    const normalizedToken = token.toLowerCase();

    if (normalizedToken === ETHER_ADDRESS) {
      throw new Error('Cannot provide storage slots for native token');
    }

    const jsonPath = path.join(__dirname, 'token-storage-slots.json');

    const chainSlots = JSON.parse(
      await fs.readFile(jsonPath, { encoding: 'utf-8' }),
    ) as Record<number, Record<string, TokenStorageSlots>>;

    if (chainSlots[chainId]?.[normalizedToken]) {
      return chainSlots[chainId][normalizedToken];
    }

    // find the slots
    const [balanceSlot, allowanceSlot] = await Promise.all([
      this.findTokenBalanceOfSlot(chainId, token),
      this.findTokenAllowanceSlot(chainId, token),
    ]);

    // save the slots and return
    const slots: TokenStorageSlots = {
      balanceSlot,
      allowanceSlot,
    };

    chainSlots[chainId] ||= {};
    chainSlots[chainId][normalizedToken] = slots;
    const stringified = JSON.stringify(chainSlots, null, 2);
    await fs.writeFile(jsonPath, stringified, { encoding: 'utf-8' });

    return chainSlots[chainId][normalizedToken];
  }
}
