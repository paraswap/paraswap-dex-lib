/* eslint-disable no-console */
import { Interface } from '@ethersproject/abi';
import { Provider } from '@ethersproject/providers';
import {
  IParaSwapSDK,
  LocalParaswapSDK,
} from '../src/implementations/local-paraswap-sdk';
import {
  EstimateGasSimulation,
  TenderlySimulation,
  TransactionSimulator,
} from './tenderly-simulation';
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
import { DummyDexHelper, DummyLimitOrderProvider } from '../src/dex-helper';
import { constructSimpleSDK, SimpleFetchSDK } from '@paraswap/sdk';
import axios from 'axios';
import { SmartToken, StateOverrides } from './smart-tokens';
import { GIFTER_ADDRESS } from './constants-e2e';
import { generateDeployBytecode, sleep } from './utils';
import { assert } from 'ts-essentials';

export const testingEndpoint = process.env.E2E_TEST_ENDPOINT;

const testContractProjectRootPath = process.env.TEST_CONTRACT_PROJECT_ROOT_PATH;
const testContractName = process.env.TEST_CONTRACT_NAME;
const testContractConfigFileName = process.env.TEST_CONTRACT_CONFIG_FILE_NAME;
const testContractRelativePath = process.env.TEST_CONTRACT_RELATIVE_PATH;
// Comma separated fields from config or actual values
const testContractDeployArgs = process.env.TEST_CONTRACT_DEPLOY_ARGS;

// If you want to test against deployed and verified contract
const deployedTestContractAddress = process.env.DEPLOYED_TEST_CONTRACT_ADDRESS;
const testContractType = process.env.TEST_CONTRACT_TYPE;

// Only for router tests
const testDirectRouterAbiPath = process.env.TEST_DIRECT_ROUTER_ABI_PATH;

const directRouterIface = new Interface(
  testDirectRouterAbiPath ? require(testDirectRouterAbiPath) : '[]',
);

const testContractBytecode = generateDeployBytecode(
  testContractProjectRootPath,
  testContractName,
  testContractConfigFileName,
  testContractRelativePath,
  testContractDeployArgs,
  testContractType,
);

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

function deployContractParams(bytecode: string, network = Network.MAINNET) {
  const ownerAddress = DEPLOYER_ADDRESS[network];
  if (!ownerAddress) throw new Error('No deployer address set for network');
  return {
    from: ownerAddress,
    data: bytecode,
    value: '0',
  };
}

function augustusSetImplementationParams(
  contractAddress: Address,
  network: Network,
  functionName: string,
) {
  const augustusAddress = generateConfig(network).augustusAddress;
  if (!augustusAddress) throw new Error('No whitelist address set for network');
  const ownerAddress = MULTISIG[network];
  if (!ownerAddress) throw new Error('No whitelist owner set for network');

  return {
    from: ownerAddress,
    to: augustusAddress,
    data: augustusInterface.encodeFunctionData('setImplementation', [
      directRouterIface.getSighash(functionName),
      contractAddress,
    ]),
    value: '0',
  };
}

function augustusGrantRoleParams(
  contractAddress: Address,
  network: Network,
  type: string = 'adapter',
) {
  const augustusAddress = generateConfig(network).augustusAddress;
  if (!augustusAddress) throw new Error('No whitelist address set for network');
  const ownerAddress = MULTISIG[network];
  if (!ownerAddress) throw new Error('No whitelist owner set for network');

  let role: string;
  switch (type) {
    case 'adapter':
      role =
        '0x8429d542926e6695b59ac6fbdcd9b37e8b1aeb757afab06ab60b1bb5878c3b49';
      break;
    case 'router':
      role =
        '0x7a05a596cb0ce7fdea8a1e1ec73be300bdb35097c944ce1897202f7a13122eb2';
      break;
    default:
      throw new Error(`Unrecognized type ${type}`);
  }

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

export function formatDeployMessage(
  type: 'router' | 'adapter',
  address: Address,
  forkId: string,
  contractName: string,
  contractPath: string,
) {
  // This formatting is useful for verification on Tenderly
  return `Deployed ${type} contract with env params:
    TENDERLY_FORK_ID=${forkId}
    TENDERLY_VERIFY_CONTRACT_ADDRESS=${address}
    TENDERLY_VERIFY_CONTRACT_NAME=${contractName}
    TENDERLY_VERIFY_CONTRACT_PATH=${contractPath}`;
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
  _0: Provider,
  poolIdentifiers?: string[],
  limitOrderProvider?: DummyLimitOrderProvider,
  transferFees?: TransferFeeParams,
  // Specified in BPS: part of 10000
  slippage?: number,
  sleepMs?: number,
  replaceTenderlyWithEstimateGas?: boolean,
) {
  const amount = BigInt(_amount);

  const ts: TransactionSimulator = replaceTenderlyWithEstimateGas
    ? new EstimateGasSimulation(new DummyDexHelper(network).provider)
    : new TenderlySimulation(network);
  await ts.setup();

  if (srcToken.address.toLowerCase() !== ETHER_ADDRESS.toLowerCase()) {
    const allowanceTx = await ts.simulate(
      allowTokenTransferProxyParams(srcToken.address, senderAddress, network),
    );
    if (!allowanceTx.success) console.log(allowanceTx.url);
    expect(allowanceTx!.success).toEqual(true);
  }

  if (deployedTestContractAddress) {
    const whitelistTx = await ts.simulate(
      augustusGrantRoleParams(
        deployedTestContractAddress,
        network,
        testContractType || 'adapter',
      ),
    );
    expect(whitelistTx.success).toEqual(true);
    console.log(`Successfully whitelisted ${deployedTestContractAddress}`);

    if (testContractType === 'router') {
      const setImplementationTx = await ts.simulate(
        augustusSetImplementationParams(
          deployedTestContractAddress,
          network,
          contractMethod,
        ),
      );
      expect(setImplementationTx.success).toEqual(true);
    }
  } else if (testContractBytecode) {
    const deployTx = await ts.simulate(
      deployContractParams(testContractBytecode, network),
    );

    expect(deployTx.success).toEqual(true);

    const contractAddress =
      deployTx.transaction?.transaction_info.contract_address;
    console.log(
      formatDeployMessage(
        'adapter',
        contractAddress,
        ts.forkId,
        testContractName || '',
        testContractRelativePath || '',
      ),
    );
    const whitelistTx = await ts.simulate(
      augustusGrantRoleParams(
        contractAddress,
        network,
        testContractType || 'adapter',
      ),
    );
    expect(whitelistTx.success).toEqual(true);

    if (testContractType === 'router') {
      const setImplementationTx = await ts.simulate(
        augustusSetImplementationParams(
          contractAddress,
          network,
          contractMethod,
        ),
      );
      expect(setImplementationTx.success).toEqual(true);
    }
  }

  const useAPI = testingEndpoint && !poolIdentifiers;
  // The API currently doesn't allow for specifying poolIdentifiers
  const paraswap: IParaSwapSDK = useAPI
    ? new APIParaswapSDK(network, dexKey)
    : new LocalParaswapSDK(network, dexKey, '', limitOrderProvider);

  if (paraswap.initializePricing) await paraswap.initializePricing();

  if (sleepMs) {
    await sleep(sleepMs);
  }

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
    if (useAPI) {
      const gasUsed = swapTx.gasUsed || '0';
      console.log(
        `Gas Estimate API: ${priceRoute.gasCost}, Simulated: ${
          swapTx!.gasUsed
        }, Difference: ${parseInt(priceRoute.gasCost) - parseInt(gasUsed)}`,
      );
    }
    console.log(`Tenderly URL: ${swapTx!.url}`);
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

  if (useTenderly && testContractBytecode) {
    assert(
      ts instanceof TenderlySimulation,
      '`ts`  is not an instance of TenderlySimulation',
    );
    const deployTx = await ts.simulate(
      deployContractParams(testContractBytecode, network),
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
      augustusGrantRoleParams(adapterAddress, network),
    );
    expect(whitelistTx.success).toEqual(true);
  }

  if (useTenderly && thirdPartyAddress) {
    assert(
      destToken instanceof SmartToken,
      '`destToken` is not an instance of SmartToken',
    );
    assert(
      ts instanceof TenderlySimulation,
      '`ts` is not an instance of TenderlySimulation',
    );

    const stateOverrides: StateOverrides = {
      networkID: `${network}`,
      stateOverrides: {},
    };

    destToken.addBalance(GIFTER_ADDRESS, MAX_UINT);
    destToken.applyOverrides(stateOverrides);

    const giftTx = makeFakeTransferToSenderAddress(
      thirdPartyAddress,
      destToken.token,
      swapSide === SwapSide.SELL
        ? twiceAmount.toString()
        : (BigInt(MAX_UINT) / 4n).toString(),
    );

    await ts.simulate(giftTx, stateOverrides);
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
      assert(
        srcToken instanceof SmartToken,
        '`srcToken` is not an instance of SmartToken',
      );
      assert(
        destToken instanceof SmartToken,
        '`destToken` is not an instance of SmartToken',
      );
      assert(
        ts instanceof TenderlySimulation,
        '`ts` is not an instance of TenderlySimulation',
      );

      const stateOverrides: StateOverrides = {
        networkID: `${network}`,
        stateOverrides: {},
      };
      srcToken.applyOverrides(stateOverrides);
      destToken.applyOverrides(stateOverrides);

      if (swapSide === SwapSide.SELL) {
        srcToken
          .addBalance(senderAddress, twiceAmount.toString())
          .addAllowance(
            senderAddress,
            config.tokenTransferProxyAddress,
            amount.toString(),
          );
      } else {
        srcToken
          .addBalance(senderAddress, MAX_UINT)
          .addAllowance(
            senderAddress,
            config.tokenTransferProxyAddress,
            (BigInt(MAX_UINT) / 8n).toString(),
          );
      }

      srcToken.applyOverrides(stateOverrides);
      destToken.applyOverrides(stateOverrides);

      const swapTx = await ts.simulate(swapParams, stateOverrides);
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
      console.log(`Tenderly URL: ${swapTx!.url}`);
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
