/* eslint-disable no-console */
import { Interface } from '@ethersproject/abi';
import { Provider } from '@ethersproject/providers';
import {
  IParaSwapSDK,
  LocalParaswapSDK,
} from '../src/implementations/local-paraswap-sdk';
import { TenderlySimulation } from './tenderly-simulation';
import {
  SwapSide,
  ETHER_ADDRESS,
  MAX_UINT,
  Network,
  ContractMethod,
} from '../src/constants';
import {
  OptimalRate,
  TxObject,
  Address,
  Token,
  TransferFeeParams,
  Config,
} from '../src/types';
import Erc20ABI from '../src/abi/erc20.json';
import AugustusABI from '../src/abi/augustus.json';
import { generateConfig } from '../src/config';
import { DummyLimitOrderProvider } from '../src/dex-helper';
import { constructSimpleSDK, SimpleFetchSDK } from '@paraswap/sdk';
import axios from 'axios';
import { SmartToken, StateOverrides } from './smart-tokens';
import { GIFTER_ADDRESS } from './constants-e2e';
import { sleep } from './utils';

export const testingEndpoint = process.env.E2E_TEST_ENDPOINT;

const adapterBytecode = '';

const erc20Interface = new Interface(Erc20ABI);
const augustusInterface = new Interface(AugustusABI);

const DEPLOYER_ADDRESS: { [nid: number]: string } = {
  [Network.MAINNET]: '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8',
  [Network.BSC]: '0xf68a4b64162906eff0ff6ae34e2bb1cd42fef62d',
  [Network.POLYGON]: '0x05182E579FDfCf69E4390c3411D8FeA1fb6467cf',
  [Network.FANTOM]: '0x05182E579FDfCf69E4390c3411D8FeA1fb6467cf',
  [Network.AVALANCHE]: '0xD6216fC19DB775Df9774a6E33526131dA7D19a2c',
  [Network.OPTIMISM]: '0xf01121e808F782d7F34E857c27dA31AD1f151b39',
  [Network.ARBITRUM]: '0xb38e8c17e38363af6ebdcb3dae12e0243582891d',
};

const MULTISIG: { [nid: number]: string } = {
  [Network.MAINNET]: '0x36fEDC70feC3B77CAaf50E6C524FD7e5DFBD629A',
  [Network.BSC]: '0xf14bed2cf725E79C46c0Ebf2f8948028b7C49659',
  [Network.POLYGON]: '0x46DF4eb6f7A3B0AdF526f6955b15d3fE02c618b7',
  [Network.FANTOM]: '0xECaB2dac955b94e49Ec09D6d68672d3B397BbdAd',
  [Network.AVALANCHE]: '0x1e2ECA5e812D08D2A7F8664D69035163ff5BfEC2',
  [Network.OPTIMISM]: '0xf01121e808F782d7F34E857c27dA31AD1f151b39',
  [Network.ARBITRUM]: '0x90DfD8a6454CFE19be39EaB42ac93CD850c7f339',
};

class APIParaswapSDK implements IParaSwapSDK {
  paraSwap: SimpleFetchSDK;

  constructor(protected network: number, protected dexKey: string) {
    this.paraSwap = constructSimpleSDK({
      chainId: network,
      axios,
      apiURL: testingEndpoint,
    });
  }

  async getPrices(
    from: Token,
    to: Token,
    amount: bigint,
    side: SwapSide,
    contractMethod: ContractMethod,
    _poolIdentifiers?: string[],
  ): Promise<OptimalRate> {
    if (_poolIdentifiers)
      throw new Error('PoolIdentifiers is not supported by the API');

    const priceRoute = await this.paraSwap.swap.getRate({
      srcToken: from.address,
      destToken: to.address,
      side,
      amount: amount.toString(),
      options: {
        includeDEXS: [this.dexKey],
        includeContractMethods: [contractMethod],
        partner: 'any',
      },
      srcDecimals: from.decimals,
      destDecimals: to.decimals,
    });
    return priceRoute as OptimalRate;
  }

  async buildTransaction(
    priceRoute: OptimalRate,
    _minMaxAmount: BigInt,
    userAddress: Address,
  ): Promise<TxObject> {
    const minMaxAmount = _minMaxAmount.toString();
    const swapParams = await this.paraSwap.swap.buildTx(
      {
        srcToken: priceRoute.srcToken,
        srcDecimals: priceRoute.srcDecimals,
        destDecimals: priceRoute.destDecimals,
        destToken: priceRoute.destToken,
        srcAmount:
          priceRoute.side === SwapSide.SELL
            ? priceRoute.srcAmount
            : minMaxAmount,
        destAmount:
          priceRoute.side === SwapSide.SELL
            ? minMaxAmount
            : priceRoute.destAmount,
        priceRoute,
        userAddress,
        partner: 'paraswap.io',
      },
      {
        ignoreChecks: true,
      },
    );
    return swapParams as TxObject;
  }
}

function allowTokenTransferProxyParams(
  tokenAddress: Address,
  holderAddress: Address,
  network: Network,
) {
  const tokenTransferProxy = generateConfig(network).tokenTransferProxyAddress;
  return {
    from: holderAddress,
    to: tokenAddress,
    data: erc20Interface.encodeFunctionData('approve', [
      tokenTransferProxy,
      MAX_UINT,
    ]),
    value: '0',
  };
}

function deployAdapterParams(bytecode: string, network = Network.MAINNET) {
  const ownerAddress = DEPLOYER_ADDRESS[network];
  if (!ownerAddress) throw new Error('No deployer address set for network');
  return {
    from: ownerAddress,
    data: bytecode,
    value: '0',
  };
}

function whiteListAdapterParams(contractAddress: Address, network: Network) {
  const augustusAddress = generateConfig(network).augustusAddress;
  if (!augustusAddress) throw new Error('No whitelist address set for network');
  const ownerAddress = MULTISIG[network];
  if (!ownerAddress) throw new Error('No whitelist owner set for network');
  const role =
    '0x8429d542926e6695b59ac6fbdcd9b37e8b1aeb757afab06ab60b1bb5878c3b49';
  return {
    from: ownerAddress,
    to: augustusAddress,
    data: augustusInterface.encodeFunctionData('grantRole', [
      role,
      contractAddress,
    ]),
    value: '0',
  };
}

export async function testE2E(
  srcToken: Token,
  destToken: Token,
  senderAddress: Address,
  _amount: string,
  swapSide = SwapSide.SELL,
  dexKey: string,
  contractMethod: ContractMethod,
  network: Network = Network.MAINNET,
  provider: Provider,
  poolIdentifiers?: string[],
  limitOrderProvider?: DummyLimitOrderProvider,
  transferFees?: TransferFeeParams,
  // Specified in BPS: part of 10000
  slippage?: number,
) {
  const amount = BigInt(_amount);
  const ts = new TenderlySimulation(network);
  await ts.setup();

  if (srcToken.address.toLowerCase() !== ETHER_ADDRESS.toLowerCase()) {
    const allowanceTx = await ts.simulate(
      allowTokenTransferProxyParams(srcToken.address, senderAddress, network),
    );
    if (!allowanceTx.success) console.log(allowanceTx.tenderlyUrl);
    expect(allowanceTx!.success).toEqual(true);
  }

  if (adapterBytecode) {
    const deployTx = await ts.simulate(
      deployAdapterParams(adapterBytecode, network),
    );

    expect(deployTx.success).toEqual(true);
    const adapterAddress =
      deployTx.transaction.transaction_info.contract_address;
    console.log(
      'Deployed adapter to address',
      adapterAddress,
      'used',
      deployTx.gasUsed,
      'gas',
    );

    const whitelistTx = await ts.simulate(
      whiteListAdapterParams(adapterAddress, network),
    );
    expect(whitelistTx.success).toEqual(true);
  }

  const useAPI = testingEndpoint && !poolIdentifiers;
  // The API currently doesn't allow for specifying poolIdentifiers
  const paraswap: IParaSwapSDK = useAPI
    ? new APIParaswapSDK(network, dexKey)
    : new LocalParaswapSDK(network, dexKey, '', limitOrderProvider);

  if (paraswap.initializePricing) await paraswap.initializePricing();

  if (paraswap.dexHelper?.replaceProviderWithRPC) {
    paraswap.dexHelper?.replaceProviderWithRPC(
      `https://rpc.tenderly.co/fork/${ts.forkId}`,
    );
  }

  try {
    const priceRoute = await paraswap.getPrices(
      srcToken,
      destToken,
      amount,
      swapSide,
      contractMethod,
      poolIdentifiers,
      transferFees,
    );
    expect(parseFloat(priceRoute.destAmount)).toBeGreaterThan(0);

    // Calculate slippage. Default is 1%
    const _slippage = slippage || 100;
    const minMaxAmount =
      (swapSide === SwapSide.SELL
        ? BigInt(priceRoute.destAmount) * (10000n - BigInt(_slippage))
        : BigInt(priceRoute.srcAmount) * (10000n + BigInt(_slippage))) / 10000n;
    const swapParams = await paraswap.buildTransaction(
      priceRoute,
      minMaxAmount,
      senderAddress,
    );

    const swapTx = await ts.simulate(swapParams);
    // Only log gas estimate if testing against API
    if (useAPI)
      console.log(
        `Gas Estimate API: ${priceRoute.gasCost}, Simulated: ${
          swapTx!.gasUsed
        }, Difference: ${
          parseInt(priceRoute.gasCost) - parseInt(swapTx!.gasUsed)
        }`,
      );
    console.log(`Tenderly URL: ${swapTx!.tenderlyUrl}`);
    expect(swapTx!.success).toEqual(true);
  } finally {
    if (paraswap.releaseResources) {
      await paraswap.releaseResources();
    }
  }
}

export type TestParamE2E = {
  config: Config;
  srcToken: Token | SmartToken;
  destToken: Token | SmartToken;
  senderAddress: Address;
  thirdPartyAddress?: Address;
  _amount: string;
  swapSide: SwapSide;
  dexKey: string;
  contractMethod: ContractMethod;
  network: Network;
  poolIdentifiers?: string[];
  limitOrderProvider?: DummyLimitOrderProvider;
  transferFees?: TransferFeeParams;
  srcTokenBalanceOverrides?: Record<Address, string>;
  srcTokenAllowanceOverrides?: Record<Address, string>;
  destTokenBalanceOverrides?: Record<Address, string>;
  destTokenAllowanceOverrides?: Record<Address, string>;
  sleepMs?: number;
  skipTenderly?: boolean;
};

const makeFakeTransferToSenderAddress = (
  senderAddress: string,
  token: Token,
  amount: string,
) => {
  return {
    from: GIFTER_ADDRESS,
    to: token.address,
    data: erc20Interface.encodeFunctionData('transfer', [
      senderAddress,
      amount,
    ]),
    value: '0',
  };
};

export async function newTestE2E({
  config,
  srcToken,
  destToken,
  senderAddress,
  thirdPartyAddress,
  _amount,
  swapSide,
  dexKey,
  contractMethod,
  network,
  poolIdentifiers,
  limitOrderProvider,
  transferFees,
  sleepMs,
  skipTenderly,
}: TestParamE2E) {
  const useTenderly = !skipTenderly;
  const amount = BigInt(_amount);
  const twiceAmount = BigInt(_amount) * 2n;
  let ts: TenderlySimulation | undefined = undefined;
  if (useTenderly) {
    ts = new TenderlySimulation(network);
    await ts.setup();
  }

  if (useTenderly && adapterBytecode) {
    const deployTx = await (ts as TenderlySimulation).simulate(
      deployAdapterParams(adapterBytecode, network),
    );

    expect(deployTx.success).toEqual(true);
    const adapterAddress =
      deployTx.transaction.transaction_info.contract_address;
    console.log(
      'Deployed adapter to address',
      adapterAddress,
      'used',
      deployTx.gasUsed,
      'gas',
    );

    const whitelistTx = await (ts as TenderlySimulation).simulate(
      whiteListAdapterParams(adapterAddress, network),
    );
    expect(whitelistTx.success).toEqual(true);
  }

  if (useTenderly && thirdPartyAddress) {
    const stateOverrides: StateOverrides = {
      networkID: `${network}`,
      stateOverrides: {},
    };

    (destToken as SmartToken).addBalance(GIFTER_ADDRESS, MAX_UINT);
    (destToken as SmartToken).applyOverrides(stateOverrides);

    const giftTx = makeFakeTransferToSenderAddress(
      thirdPartyAddress,
      (destToken as SmartToken).token,
      swapSide === SwapSide.SELL
        ? twiceAmount.toString()
        : (BigInt(MAX_UINT) / 4n).toString(),
    );

    await (ts as TenderlySimulation).simulate(giftTx, stateOverrides);
  }

  const useAPI = testingEndpoint && !poolIdentifiers;
  // The API currently doesn't allow for specifying poolIdentifiers
  const paraswap: IParaSwapSDK = new LocalParaswapSDK(
    network,
    dexKey,
    '',
    limitOrderProvider,
  );

  if (paraswap.initializePricing) await paraswap.initializePricing();

  if (sleepMs) {
    await sleep(sleepMs);
  }
  try {
    const priceRoute = await paraswap.getPrices(
      skipTenderly ? (srcToken as Token) : (srcToken as SmartToken).token,
      skipTenderly ? (destToken as Token) : (destToken as SmartToken).token,
      amount,
      swapSide,
      contractMethod,
      poolIdentifiers,
      transferFees,
    );

    console.log(JSON.stringify(priceRoute));

    expect(parseFloat(priceRoute.destAmount)).toBeGreaterThan(0);

    // Slippage to be 7%
    const minMaxAmount =
      (swapSide === SwapSide.SELL
        ? BigInt(priceRoute.destAmount) * 93n
        : BigInt(priceRoute.srcAmount) * 107n) / 100n;

    const swapParams = await paraswap.buildTransaction(
      priceRoute,
      minMaxAmount,
      senderAddress,
    );

    if (useTenderly) {
      const stateOverrides: StateOverrides = {
        networkID: `${network}`,
        stateOverrides: {},
      };
      (srcToken as SmartToken).applyOverrides(stateOverrides);
      (destToken as SmartToken).applyOverrides(stateOverrides);

      if (swapSide === SwapSide.SELL) {
        (srcToken as SmartToken)
          .addBalance(senderAddress, twiceAmount.toString())
          .addAllowance(
            senderAddress,
            config.tokenTransferProxyAddress,
            amount.toString(),
          );
      } else {
        (srcToken as SmartToken)
          .addBalance(senderAddress, MAX_UINT)
          .addAllowance(
            senderAddress,
            config.tokenTransferProxyAddress,
            (BigInt(MAX_UINT) / 8n).toString(),
          );
      }

      (srcToken as SmartToken).applyOverrides(stateOverrides);
      (destToken as SmartToken).applyOverrides(stateOverrides);

      const swapTx = await (ts as TenderlySimulation).simulate(
        swapParams,
        stateOverrides,
      );
      console.log(`${srcToken.address}_${destToken.address}_${dexKey!}`);
      // Only log gas estimate if testing against API
      if (useAPI)
        console.log(
          `Gas Estimate API: ${priceRoute.gasCost}, Simulated: ${
            swapTx!.gasUsed
          }, Difference: ${
            parseInt(priceRoute.gasCost) - parseInt(swapTx!.gasUsed)
          }`,
        );
      console.log(`Tenderly URL: ${swapTx!.tenderlyUrl}`);
      expect(swapTx!.success).toEqual(true);
    }
  } finally {
    if (paraswap.releaseResources) {
      await paraswap.releaseResources();
    }
  }
}

export const getEnv = (envName: string, optional: boolean = false): string => {
  if (!process.env[envName]) {
    if (optional) {
      return '';
    }
    throw new Error(`Missing ${envName}`);
  }

  return process.env[envName]!;
};
