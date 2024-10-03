import dotenv from 'dotenv';
dotenv.config();

/* eslint-disable no-console */
import { Interface } from '@ethersproject/abi';
import { Provider, StaticJsonRpcProvider } from '@ethersproject/providers';

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
  NULL_ADDRESS,
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
import {
  DummyDexHelper,
  DummyLimitOrderProvider,
  IDexHelper,
} from '../src/dex-helper';
import {
  AddressOrSymbol,
  constructSimpleSDK,
  SimpleFetchSDK,
} from '@paraswap/sdk';
import { ParaSwapVersion } from '@paraswap/core';
import axios from 'axios';
import { SmartToken, StateOverrides } from './smart-tokens';
import {
  GIFTER_ADDRESS,
  Holders,
  NativeTokenSymbols,
  Tokens,
  WrappedNativeTokenSymbols,
} from './constants-e2e';
import { generateDeployBytecode, sleep } from './utils';
import { assert } from 'ts-essentials';
import * as util from 'util';
import { GenericSwapTransactionBuilder } from '../src/generic-swap-transaction-builder';
import { DexAdapterService, PricingHelper } from '../src';
import { v4 as uuid } from 'uuid';
import { OptimalRoute } from '../build/types';

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
  [Network.OPTIMISM]: '0x3b28A6f6291f7e8277751f2911Ac49C585d049f6',
  [Network.ARBITRUM]: '0x90DfD8a6454CFE19be39EaB42ac93CD850c7f339',
  [Network.BASE]: '0x6C674c8Df1aC663b822c4B6A56B4E5e889379AE0',
};

class APIParaswapSDK implements IParaSwapSDK {
  paraSwap: SimpleFetchSDK;
  dexKeys: string[];
  dexHelper: IDexHelper;
  pricingHelper: PricingHelper;
  transactionBuilder: GenericSwapTransactionBuilder;
  dexAdapterService: DexAdapterService;

  constructor(
    protected network: number,
    dexKeys: string | string[],
    rpcUrl: string,
  ) {
    this.dexKeys = Array.isArray(dexKeys) ? dexKeys : [dexKeys];

    console.log('testingEndpoint: ', testingEndpoint);
    console.log('this.dexKeys: ', this.dexKeys);

    this.paraSwap = constructSimpleSDK({
      version: ParaSwapVersion.V6,
      chainId: network,
      axios,
      apiURL: testingEndpoint,
    });
    this.dexHelper = new DummyDexHelper(this.network, rpcUrl);

    this.dexAdapterService = new DexAdapterService(
      this.dexHelper,
      this.network,
    );
    this.transactionBuilder = new GenericSwapTransactionBuilder(
      this.dexAdapterService,
    );
    this.pricingHelper = new PricingHelper(
      this.dexAdapterService,
      this.dexHelper.getLogger,
    );
  }

  async initializePricing() {
    const blockNumber = await this.dexHelper.web3Provider.eth.getBlockNumber();
    await this.pricingHelper.initialize(blockNumber, this.dexKeys);
  }

  async getPrices(
    from: Token,
    to: Token,
    amount: bigint,
    side: SwapSide,
    // contractMethod: ContractMethod,
    contractMethod: any,
    _poolIdentifiers?: { [key: string]: string[] | null } | null,
    transferFees?: TransferFeeParams,
    forceRoute?: AddressOrSymbol[],
  ): Promise<OptimalRate> {
    if (_poolIdentifiers)
      throw new Error('PoolIdentifiers is not supported by the API');

    let priceRoute;
    console.log('forceRoute: ', forceRoute);
    if (forceRoute && forceRoute.length > 0) {
      const options = {
        route: forceRoute,
        amount: amount.toString(),
        side,
        srcDecimals: from.decimals,
        destDecimals: to.decimals,
        options: {
          includeDEXS: this.dexKeys,
          includeContractMethods: [contractMethod],
          partner: 'paraswap.io-staging',
          maxImpact: 100,
        },
        ...transferFees,
      };
      priceRoute = await this.paraSwap.swap.getRateByRoute(options);
    } else {
      const options = {
        srcToken: from.address,
        destToken: to.address,
        side,
        amount: amount.toString(),
        options: {
          includeDEXS: this.dexKeys,
          includeContractMethods: [contractMethod],
          partner: 'paraswap.io-staging',
          maxImpact: 100,
        },
        ...transferFees,
        srcDecimals: from.decimals,
        destDecimals: to.decimals,
      };
      priceRoute = await this.paraSwap.swap.getRate(options);
    }

    return priceRoute as OptimalRate;
  }

  async buildTransaction(
    priceRoute: OptimalRate,
    _minMaxAmount: BigInt,
    userAddress: Address,
  ): Promise<TxObject> {
    const minMaxAmount = _minMaxAmount.toString();
    let deadline = Number((Math.floor(Date.now() / 1000) + 10 * 60).toFixed());

    return await this.transactionBuilder.build({
      priceRoute,
      minMaxAmount: minMaxAmount.toString(),
      userAddress,
      partnerAddress: NULL_ADDRESS,
      partnerFeePercent: '0',
      deadline: deadline.toString(),
      uuid: uuid(),
    });
  }
}

function send1WeiTo(token: Address, to: Address, network: Network) {
  const tokens = Tokens[network];

  const tokenSymbol = Object.keys(tokens).find(tokenSymbol => {
    const curToken = tokens[tokenSymbol];
    return curToken.address === token;
  });

  const holders = Holders[network];
  const holder = holders[tokenSymbol!];

  return {
    from: holder,
    to: token,
    data: erc20Interface.encodeFunctionData('transfer', [to, '1']),
    value: '0',
  };
}

function checkBalanceOf(token: Address, holder: Address) {
  return {
    from: NULL_ADDRESS,
    to: token,
    data: erc20Interface.encodeFunctionData('balanceOf', [holder]),
    value: '0',
  };
}

function allowAugustusV6(
  tokenAddress: Address,
  holderAddress: Address,
  network: Network,
) {
  const augustusV6Address = generateConfig(network).augustusV6Address;

  return {
    from: holderAddress,
    to: tokenAddress,
    data: erc20Interface.encodeFunctionData('approve', [
      augustusV6Address,
      MAX_UINT,
    ]),
    value: '0',
  };
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
  dexKeys: string | string[],
  contractMethod: ContractMethod,
  network: Network = Network.MAINNET,
  _0: Provider,
  poolIdentifiers?: { [key: string]: string[] | null } | null,
  limitOrderProvider?: DummyLimitOrderProvider,
  transferFees?: TransferFeeParams,
  // Specified in BPS: part of 10000
  slippage?: number,
  sleepMs?: number,
  replaceTenderlyWithEstimateGas?: boolean,
  forceRoute?: AddressOrSymbol[],
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
    const augustusV6Allowance = await ts.simulate(
      allowAugustusV6(srcToken.address, senderAddress, network),
    );
    if (!allowanceTx.success) console.log(allowanceTx.url);
    if (!augustusV6Allowance.success) console.log(augustusV6Allowance.url);
    expect(allowanceTx!.success).toEqual(true);
    expect(augustusV6Allowance!.success).toEqual(true);
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
    ? new APIParaswapSDK(network, dexKeys, '')
    : new LocalParaswapSDK(network, dexKeys, '', limitOrderProvider);

  await paraswap.initializePricing?.();

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
      forceRoute,
    );

    // const priceRoute = {
    //   blockNumber: 20879357,
    //   network: 1,
    //   srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    //   srcDecimals: 18,
    //   srcAmount: '100000000000000000000',
    //   destToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //   destDecimals: 6,
    //   destAmount: '243963352377',
    //   bestRoute: [
    //     {
    //       percent: 64,
    //       swaps: [
    //         {
    //           srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    //           srcDecimals: 18,
    //           destToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //           destDecimals: 6,
    //           swapExchanges: [
    //             {
    //               exchange: 'SwaapV2',
    //               srcAmount: '32000000000000000000',
    //               destAmount: '78071021726',
    //               percent: 50,
    //               data: {
    //                 tokenIn: '0x0000000000000000000000000000000000000000',
    //                 tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //                 gasUSD: '14.750987',
    //               },
    //             },
    //             {
    //               exchange: 'SwaapV2',
    //               srcAmount: '32000000000000000000',
    //               destAmount: '78071021726',
    //               percent: 50,
    //               data: {
    //                 tokenIn: '0x0000000000000000000000000000000000000000',
    //                 tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //                 gasUSD: '14.750987',
    //               },
    //             },
    //           ],
    //         },
    //       ],
    //     },
    //     {
    //       percent: 36,
    //       swaps: [
    //         {
    //           srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    //           srcDecimals: 18,
    //           destToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    //           destDecimals: 6,
    //           swapExchanges: [
    //             {
    //               exchange: 'Hashflow',
    //               srcAmount: '20001600000000000000',
    //               destAmount: '48806377303',
    //               percent: 55.56,
    //               poolAddresses: ['0x55084eE0fEf03f14a305cd24286359A35D735151'],
    //               data: {
    //                 mm: 'mm12_1',
    //                 tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //                 tokenOut: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    //                 gasUSD: '9.833991',
    //               },
    //             },
    //             {
    //               exchange: 'Hashflow',
    //               srcAmount: '15998400000000000000',
    //               destAmount: '39024672766',
    //               percent: 44.44,
    //               poolAddresses: ['0x55084eE0fEf03f14a305cd24286359A35D735151'],
    //               data: {
    //                 mm: 'mm21_1',
    //                 tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //                 tokenOut: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    //                 gasUSD: '9.833991',
    //               },
    //             },
    //           ],
    //         },
    //         {
    //           srcToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    //           srcDecimals: 6,
    //           destToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //           destDecimals: 6,
    //           swapExchanges: [
    //             {
    //               exchange: 'Hashflow',
    //               srcAmount: '87831050069',
    //               destAmount: '87821308925',
    //               percent: 100,
    //               poolAddresses: ['0x55084eE0fEf03f14a305cd24286359A35D735151'],
    //               data: {
    //                 mm: 'mm12_1',
    //                 tokenIn: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    //                 tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //                 gasUSD: '9.833991',
    //               },
    //             },
    //           ],
    //         },
    //       ],
    //     },
    //   ],
    //   gasCostUSD: '69.533199',
    //   gasCost: '707070',
    //   others: [],
    //   side: 'SELL',
    //   version: '6.2',
    //   contractAddress: '0x6a000f20005980200259b80c5102003040001068',
    //   tokenTransferProxy: '0x6a000f20005980200259b80c5102003040001068',
    //   contractMethod: 'swapExactAmountIn',
    //   partnerFee: 0.15,
    //   srcUSD: '243235.0000000000',
    //   destUSD: '243039.7071249007',
    //   partner: 'paraswap.io-staging',
    //   maxImpactReached: false,
    //   hmac: '4509f8cd893cf95801c781ace09e43a504198b4c',
    // } as OptimalRate;
    // DAI -> USDC -> WETH
    // const priceRoute = {
    //   blockNumber: 20829396,
    //   network: 1,
    //   srcToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //   srcDecimals: 18,
    //   srcAmount: '22675013677618734169',
    //   destToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //   destDecimals: 18,
    //   destAmount: '8740886723958239',
    //   bestRoute: [
    //     {
    //       percent: 100,
    //       swaps: [
    //         {
    //           srcToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //           srcDecimals: 18,
    //           destToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //           destDecimals: 6,
    //           swapExchanges: [
    //             {
    //               exchange: 'Hashflow',
    //               srcAmount: '22675013677618734169',
    //               destAmount: '22653896',
    //               percent: 100,
    //               poolAddresses: ['0x55084eE0fEf03f14a305cd24286359A35D735151'],
    //               data: {
    //                 mm: 'mm21_1',
    //                 tokenIn: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //                 tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //                 gasUSD: '9.106871',
    //               },
    //             },
    //           ],
    //         },
    //         {
    //           srcToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //           srcDecimals: 6,
    //           destToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //           destDecimals: 18,
    //           swapExchanges: [
    //             {
    //               exchange: 'Hashflow',
    //               srcAmount: '22653896',
    //               destAmount: '8740886723958239',
    //               percent: 100,
    //               poolAddresses: ['0x55084eE0fEf03f14a305cd24286359A35D735151'],
    //               data: {
    //                 mm: 'mm30_302',
    //                 tokenIn: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //                 tokenOut: '0x0000000000000000000000000000000000000000',
    //                 gasUSD: '9.106871',
    //               },
    //             },
    //           ],
    //         },
    //       ],
    //     },
    //   ],
    //   gasCostUSD: '23.654185',
    //   gasCost: '259740',
    //   others: [],
    //   side: 'SELL',
    //   version: '6.2',
    //   contractAddress: '0x6a000f20005980200259b80c5102003040001068',
    //   tokenTransferProxy: '0x6a000f20005980200259b80c5102003040001068',
    //   contractMethod: 'swapExactAmountIn',
    //   partnerFee: 0,
    //   srcUSD: '22.6576219421',
    //   destUSD: '22.5361037872',
    //   partner: 'paraswap.io-staging',
    //   maxImpactReached: false,
    //   hmac: 'a02dfe3450127b33a601d46c0385c8229428e134',
    // } as OptimalRate;

    // DAI -> ETH -> USDC
    // const priceRoute = {
    //   blockNumber: 20834880,
    //   network: 1,
    //   srcToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //   srcDecimals: 18,
    //   srcAmount: '22675013677618734169',
    //   destToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //   destDecimals: 18,
    //   destAmount: '8560020040357109',
    //   bestRoute: [
    //     {
    //       percent: 100,
    //       swaps: [
    //         {
    //           srcToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //           srcDecimals: 18,
    //           destToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //           destDecimals: 6,
    //           swapExchanges: [
    //             {
    //               exchange: 'Hashflow',
    //               srcAmount: '22675013677618734169',
    //               destAmount: '22654007',
    //               percent: 100,
    //               poolAddresses: ['0x55084eE0fEf03f14a305cd24286359A35D735151'],
    //               data: {
    //                 mm: 'mm21_1',
    //                 tokenIn: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //                 tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //                 gasUSD: '5.806315',
    //               },
    //             },
    //           ],
    //         },
    //         {
    //           srcToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //           srcDecimals: 6,
    //           destToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //           destDecimals: 18,
    //           swapExchanges: [
    //             {
    //               exchange: 'Hashflow',
    //               srcAmount: '22654007',
    //               destAmount: '8560020040357109',
    //               percent: 100,
    //               poolAddresses: ['0x55084eE0fEf03f14a305cd24286359A35D735151'],
    //               data: {
    //                 mm: 'mm30_302',
    //                 tokenIn: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //                 tokenOut: '0x0000000000000000000000000000000000000000',
    //                 gasUSD: '5.806315',
    //               },
    //             },
    //           ],
    //         },
    //       ],
    //     },
    //   ],
    //   gasCostUSD: '15.081322',
    //   gasCost: '259740',
    //   others: [],
    //   side: 'SELL',
    //   version: '6.2',
    //   contractAddress: '0x6a000f20005980200259b80c5102003040001068',
    //   tokenTransferProxy: '0x6a000f20005980200259b80c5102003040001068',
    //   contractMethod: 'swapExactAmountIn',
    //   partnerFee: 0,
    //   srcUSD: '22.6976886913',
    //   destUSD: '22.5707184416',
    //   partner: 'paraswap.io-staging',
    //   maxImpactReached: false,
    //   hmac: 'e46183c5d45132b9275006da4b94b902c2988c51',
    // } as OptimalRate;

    // USDC -> ETH -> DAI
    // const priceRoute = {
    //   blockNumber: 20834863,
    //   network: 1,
    //   srcToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //   srcDecimals: 6,
    //   srcAmount: '22943400',
    //   destToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //   destDecimals: 18,
    //   destAmount: '22799985410708408682',
    //   bestRoute: [
    //     {
    //       percent: 100,
    //       swaps: [
    //         {
    //           srcToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //           srcDecimals: 6,
    //           destToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    //           destDecimals: 18,
    //           swapExchanges: [
    //             {
    //               exchange: 'Hashflow',
    //               srcAmount: '22943400',
    //               destAmount: '8664664054891136',
    //               percent: 100,
    //               poolAddresses: ['0x55084eE0fEf03f14a305cd24286359A35D735151'],
    //               data: {
    //                 mm: 'mm30_302',
    //                 tokenIn: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //                 tokenOut: '0x0000000000000000000000000000000000000000',
    //                 gasUSD: '5.392335',
    //               },
    //             },
    //           ],
    //         },
    //         {
    //           srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    //           srcDecimals: 18,
    //           destToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //           destDecimals: 18,
    //           swapExchanges: [
    //             {
    //               exchange: 'Hashflow',
    //               srcAmount: '8664664054891136',
    //               destAmount: '22799985410708408682',
    //               percent: 100,
    //               poolAddresses: ['0x55084eE0fEf03f14a305cd24286359A35D735151'],
    //               data: {
    //                 mm: 'mm18_1',
    //                 tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //                 tokenOut: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //                 gasUSD: '5.392335',
    //               },
    //             },
    //           ],
    //         },
    //       ],
    //     },
    //   ],
    //   gasCostUSD: '14.006051',
    //   gasCost: '259740',
    //   others: [],
    //   side: 'SELL',
    //   version: '6.2',
    //   contractAddress: '0x6a000f20005980200259b80c5102003040001068',
    //   tokenTransferProxy: '0x6a000f20005980200259b80c5102003040001068',
    //   contractMethod: 'swapExactAmountIn',
    //   partnerFee: 0,
    //   srcUSD: '22.9361728290',
    //   destUSD: '22.7956249135',
    //   partner: 'paraswap.io-staging',
    //   maxImpactReached: false,
    //   hmac: 'ac9b2534b97a299660a18ffbc9e03e38fcfdb13a',
    // } as OptimalRate;

    // ETH -> USDC -> DAI
    // const priceRoute = {
    //   blockNumber: 20834916,
    //   network: 1,
    //   srcToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //   srcDecimals: 18,
    //   srcAmount: '8878957204610561',
    //   destToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //   destDecimals: 18,
    //   destAmount: '23239932460663978400',
    //   bestRoute: [
    //     {
    //       percent: 100,
    //       swaps: [
    //         {
    //           srcToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //           srcDecimals: 18,
    //           destToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //           destDecimals: 6,
    //           swapExchanges: [
    //             {
    //               exchange: 'Hashflow',
    //               srcAmount: '8878957204610561',
    //               destAmount: '23260163',
    //               percent: 100,
    //               poolAddresses: ['0x55084eE0fEf03f14a305cd24286359A35D735151'],
    //               data: {
    //                 mm: 'mm30_302',
    //                 tokenIn: '0x0000000000000000000000000000000000000000',
    //                 tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //                 gasUSD: '5.239797',
    //               },
    //             },
    //           ],
    //         },
    //         {
    //           srcToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //           srcDecimals: 6,
    //           destToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //           destDecimals: 18,
    //           swapExchanges: [
    //             {
    //               exchange: 'Hashflow',
    //               srcAmount: '23260163',
    //               destAmount: '23239932460663978400',
    //               percent: 100,
    //               poolAddresses: ['0x55084eE0fEf03f14a305cd24286359A35D735151'],
    //               data: {
    //                 mm: 'mm21_1',
    //                 tokenIn: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //                 tokenOut: '0x6b175474e89094c44da98b954eedeac495271d0f',
    //                 gasUSD: '5.239797',
    //               },
    //             },
    //           ],
    //         },
    //       ],
    //     },
    //   ],
    //   gasCostUSD: '13.609847',
    //   gasCost: '259740',
    //   others: [],
    //   side: 'SELL',
    //   version: '6.2',
    //   contractAddress: '0x6a000f20005980200259b80c5102003040001068',
    //   tokenTransferProxy: '0x6a000f20005980200259b80c5102003040001068',
    //   contractMethod: 'swapExactAmountIn',
    //   partnerFee: 0,
    //   srcUSD: '23.3602700366',
    //   destUSD: '23.2320308836',
    //   partner: 'paraswap.io-staging',
    //   maxImpactReached: false,
    //   hmac: '7afcc0b2ecd48d164bd988ed64f6995a136721a2',
    // } as OptimalRate;

    console.log('PRICE ROUTE: ', util.inspect(priceRoute, false, null, true));
    expect(parseFloat(priceRoute.destAmount)).toBeGreaterThan(0);

    // send 1 wei of src token to AugustusV6 and Executors
    // const config = generateConfig(network);
    // const augustusV6Address = config.augustusV6Address!;
    // const executorsAddresses = Object.values(config.executorsAddresses!);
    // const addresses = [...executorsAddresses, augustusV6Address];

    // for await (const a of addresses) {
    //   const src =
    //     srcToken.address.toLowerCase() === ETHER_ADDRESS
    //       ? config.wrappedNativeTokenAddress
    //       : srcToken.address.toLowerCase();
    //   const dest =
    //     destToken.address.toLowerCase() === ETHER_ADDRESS
    //       ? config.wrappedNativeTokenAddress
    //       : destToken.address.toLowerCase();
    //
    //   if (priceRoute.bestRoute[0].swaps.length > 0) {
    //     const intermediateToken =
    //       priceRoute.bestRoute[0].swaps[0].destToken.toLowerCase() ===
    //       ETHER_ADDRESS
    //         ? config.wrappedNativeTokenAddress
    //         : priceRoute.bestRoute[0].swaps[0].destToken.toLowerCase();
    //
    //     await ts.simulate(send1WeiTo(intermediateToken, a, network));
    //   }
    //
    //   await ts.simulate(send1WeiTo(src, a, network));
    //   await ts.simulate(send1WeiTo(dest, a, network));
    // }
    //
    // for await (const a of addresses) {
    //   const src =
    //     srcToken.address.toLowerCase() === ETHER_ADDRESS
    //       ? config.wrappedNativeTokenAddress
    //       : srcToken.address.toLowerCase();
    //   const dest =
    //     destToken.address.toLowerCase() === ETHER_ADDRESS
    //       ? config.wrappedNativeTokenAddress
    //       : destToken.address.toLowerCase();
    //
    //   if (priceRoute.bestRoute[0].swaps.length > 0) {
    //     const intermediateToken =
    //       priceRoute.bestRoute[0].swaps[0].destToken.toLowerCase() ===
    //       ETHER_ADDRESS
    //         ? config.wrappedNativeTokenAddress
    //         : priceRoute.bestRoute[0].swaps[0].destToken.toLowerCase();
    //
    //     await ts.simulate(checkBalanceOf(intermediateToken, a));
    //   }
    //
    //   await ts.simulate(checkBalanceOf(src, a));
    //   await ts.simulate(checkBalanceOf(dest, a));
    // }

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
    console.log(
      `${swapSide}: ${srcToken.address} -> ${destToken.address} (${
        priceRoute.contractMethod
      })\nTenderly URL: ${swapTx!.url}`,
    );
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
  dexKeys: string | string[];
  contractMethod: ContractMethod;
  network: Network;
  poolIdentifiers?: { [key: string]: string[] | null } | null;
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
  dexKeys,
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
    dexKeys,
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
      console.log(`${srcToken.address}_${destToken.address}_${dexKeys!}`);
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

// poolIdentifiers?: { [key: string]: string[] | null } | null,
// limitOrderProvider?: DummyLimitOrderProvider,
// transferFees?: TransferFeeParams,
// // Specified in BPS: part of 10000
// slippage?: number,
// sleepMs?: number,
// replaceTenderlyWithEstimateGas?: boolean,
// forceRoute?: AddressOrSymbol[],
export function testE2E_V6(
  network: Network,
  dexKey: string,
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
  nativeTokenAmount: string,
  forceRoute: AddressOrSymbol[],
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const tokens = Tokens[network];
  const holders = Holders[network];
  const nativeTokenSymbol = NativeTokenSymbols[network];
  const wrappedNativeTokenSymbol = WrappedNativeTokenSymbols[network];

  const sideToContractMethods = new Map([
    [SwapSide.SELL, [ContractMethod.swapExactAmountIn]],
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(`${nativeTokenSymbol} -> ${tokenASymbol}`, async () => {
              await testE2E(
                tokens[nativeTokenSymbol],
                tokens[tokenASymbol],
                holders[nativeTokenSymbol],
                side === SwapSide.SELL ? nativeTokenAmount : tokenAAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${tokenASymbol} -> ${nativeTokenSymbol}`, async () => {
              await testE2E(
                tokens[tokenASymbol],
                tokens[nativeTokenSymbol],
                holders[tokenASymbol],
                side === SwapSide.SELL ? tokenAAmount : nativeTokenAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${wrappedNativeTokenSymbol} -> ${tokenASymbol}`, async () => {
              await testE2E(
                tokens[wrappedNativeTokenSymbol],
                tokens[tokenASymbol],
                holders[wrappedNativeTokenSymbol],
                side === SwapSide.SELL ? nativeTokenAmount : tokenAAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${tokenASymbol} -> ${wrappedNativeTokenSymbol}`, async () => {
              await testE2E(
                tokens[tokenASymbol],
                tokens[wrappedNativeTokenSymbol],
                holders[tokenASymbol],
                side === SwapSide.SELL ? tokenAAmount : nativeTokenAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
              await testE2E(
                tokens[tokenASymbol],
                tokens[tokenBSymbol],
                holders[tokenASymbol],
                side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
            it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
              await testE2E(
                tokens[tokenBSymbol],
                tokens[tokenASymbol],
                holders[tokenBSymbol],
                side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            });
          });
        });
      }),
    );
  });
}
/// EXPERIMENTAL MEANT TO BE ADJUSTED OVERTIME

type Pairs = { name: string; sellAmount: string; buyAmount: string }[][];
type DexToPair = Record<string, Pairs>;

export const constructE2ETests = (
  testSuiteName: string,
  network: Network,
  testDataset: DexToPair,
) => {
  const sideToContractMethods = new Map([
    [
      SwapSide.SELL,
      [
        ContractMethod.simpleSwap,
        ContractMethod.multiSwap,
        ContractMethod.megaSwap,
      ],
    ],
    [SwapSide.BUY, [ContractMethod.simpleBuy, ContractMethod.buy]],
  ]);

  describe(testSuiteName, () => {
    const tokens = Tokens[network];
    const holders = Holders[network];
    const provider = new StaticJsonRpcProvider(
      generateConfig(network).privateHttpProvider,
      network,
    );

    Object.entries(testDataset).forEach(([dexKey, pairs]) => {
      describe(dexKey, () => {
        sideToContractMethods.forEach((contractMethods, side) =>
          describe(`${side}`, () => {
            contractMethods.forEach((contractMethod: ContractMethod) => {
              pairs.forEach(pair => {
                describe(`${contractMethod}`, () => {
                  it(`${pair[0].name} -> ${pair[1].name}`, async () => {
                    await testE2E(
                      tokens[pair[0].name],
                      tokens[pair[1].name],
                      holders[pair[0].name],
                      side === SwapSide.SELL
                        ? pair[0].sellAmount
                        : pair[0].buyAmount,
                      side,
                      dexKey,
                      contractMethod,
                      network,
                      provider,
                    );
                  });
                  it(`${pair[1].name} -> ${pair[0].name}`, async () => {
                    await testE2E(
                      tokens[pair[1].name],
                      tokens[pair[0].name],
                      holders[pair[1].name],
                      side === SwapSide.SELL
                        ? pair[1].sellAmount
                        : pair[1].buyAmount,
                      side,
                      dexKey,
                      contractMethod,
                      network,
                      provider,
                    );
                  });
                });
              });
            });
          }),
        );
      });
    });
  });
};
