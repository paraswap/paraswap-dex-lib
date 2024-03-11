import { Interface } from '@ethersproject/abi';
import { Address, OptimalRate, SwapSide } from '@paraswap/core';
import Erc20ABI from '../../src/abi/erc20.json';
import { generateConfig } from '../../src/config';
import { Network, MAX_UINT, ETHER_ADDRESS } from '../../src/constants';
import {
  TenderlySimulation,
  TransactionSimulator,
} from '../tenderly-simulation';
import {
  IParaSwapSDK,
  LocalParaswapSDK,
} from '../../src/implementations/local-paraswap-sdk';
import { sleep } from '../utils';
import * as util from 'util';

export type ContractsAugustusV6 = {
  AugustusV6: string;
  Executor01: string;
  Executor02: string;
  Executor03: string;
};

const erc20Interface = new Interface(Erc20ABI);

function allowAugustusV6(
  tokenAddress: Address,
  holderAddress: Address,
  augustusV6Address: Address,
) {
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

const getAllExchanges = (data: OptimalRate): string[] => {
  const exchanges = new Set<string>();

  data.bestRoute.forEach(route => {
    route.swaps.forEach(swap => {
      swap.swapExchanges.forEach(swapExchange => {
        exchanges.add(swapExchange.exchange);
      });
    });
  });

  return Array.from(exchanges);
};

export async function runE2ETest(
  priceRoute: OptimalRate,
  senderAddress: string,
  contracts: ContractsAugustusV6,
) {
  const { network, srcToken, destToken, side, contractMethod } = priceRoute;

  const ts: TransactionSimulator = new TenderlySimulation(network);

  await ts.setup();

  if (srcToken.toLowerCase() !== ETHER_ADDRESS.toLowerCase()) {
    const augustusV6Allowance = await ts.simulate(
      allowAugustusV6(srcToken, senderAddress, contracts.AugustusV6),
    );
    if (!augustusV6Allowance.success) console.log(augustusV6Allowance.url);
    expect(augustusV6Allowance!.success).toEqual(true);
  }

  // The API currently doesn't allow for specifying poolIdentifiers
  const paraswap: IParaSwapSDK = new LocalParaswapSDK(
    network,
    getAllExchanges(priceRoute),
    '',
  );

  paraswap.dexHelper!.config.data.augustusV6Address = contracts.AugustusV6;
  paraswap.dexHelper!.config.data.executorsAddresses = { ...contracts };

  if (paraswap.initializePricing) await paraswap.initializePricing();

  await sleep(2000);

  if (paraswap.dexHelper?.replaceProviderWithRPC) {
    paraswap.dexHelper?.replaceProviderWithRPC(
      `https://rpc.tenderly.co/fork/${ts.forkId}`,
    );
  }

  try {
    console.log('PRICE ROUTE: ', util.inspect(priceRoute, false, null, true));
    expect(parseFloat(priceRoute.destAmount)).toBeGreaterThan(0);

    const config = generateConfig(network);

    const augustusV6Address = config.augustusV6Address!;
    const executorsAddresses = Object.values(config.executorsAddresses!);
    const addresses = [...executorsAddresses, augustusV6Address];

    //  for await (const a of addresses) {
    //    const src =
    //      srcToken.address.toLowerCase() === ETHER_ADDRESS
    //        ? config.wrappedNativeTokenAddress
    //        : srcToken.address.toLowerCase();
    //    const dest =
    //      destToken.address.toLowerCase() === ETHER_ADDRESS
    //        ? config.wrappedNativeTokenAddress
    //        : destToken.address.toLowerCase();

    //    if (priceRoute.bestRoute[0].swaps.length > 0) {
    //      const intermediateToken =
    //        priceRoute.bestRoute[0].swaps[0].destToken.toLowerCase() ===
    //        ETHER_ADDRESS
    //          ? config.wrappedNativeTokenAddress
    //          : priceRoute.bestRoute[0].swaps[0].destToken.toLowerCase();

    //      await ts.simulate(send1WeiTo(intermediateToken, a, network));
    //    }

    //    await ts.simulate(send1WeiTo(src, a, network));
    //    await ts.simulate(send1WeiTo(dest, a, network));
    //  }
    //  //
    //  // for await (const a of addresses) {
    //  //   const src =
    //  //     srcToken.address.toLowerCase() === ETHER_ADDRESS
    //  //       ? config.wrappedNativeTokenAddress
    //  //       : srcToken.address.toLowerCase();
    //  //   const dest =
    //  //     destToken.address.toLowerCase() === ETHER_ADDRESS
    //  //       ? config.wrappedNativeTokenAddress
    //  //       : destToken.address.toLowerCase();
    //  //
    //  //   if (priceRoute.bestRoute[0].swaps.length > 0) {
    //  //     const intermediateToken =
    //  //       priceRoute.bestRoute[0].swaps[0].destToken.toLowerCase() ===
    //  //       ETHER_ADDRESS
    //  //         ? config.wrappedNativeTokenAddress
    //  //         : priceRoute.bestRoute[0].swaps[0].destToken.toLowerCase();
    //  //
    //  //     await ts.simulate(checkBalanceOf(intermediateToken, a));
    //  //   }
    //  //
    //  //   await ts.simulate(checkBalanceOf(src, a));
    //  //   await ts.simulate(checkBalanceOf(dest, a));
    //  // }

    // Calculate slippage. Default is 1%

    const _slippage = 100;

    const minMaxAmount =
      (side === SwapSide.SELL
        ? BigInt(priceRoute.destAmount) * (10000n - BigInt(_slippage))
        : BigInt(priceRoute.srcAmount) * (10000n + BigInt(_slippage))) / 10000n;

    const swapParams = await paraswap.buildTransaction(
      priceRoute,
      minMaxAmount,
      senderAddress,
    );

    const swapTx = await ts.simulate(swapParams);

    console.log(`Tenderly URL: ${swapTx!.url}`);
    expect(swapTx!.success).toEqual(true);
  } finally {
    if (paraswap.releaseResources) {
      await paraswap.releaseResources();
    }
  }
}
