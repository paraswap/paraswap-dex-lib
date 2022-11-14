import ethers, { Contract } from 'ethers';
import crypto from 'crypto';
import whaleWallets from './whaleWallets.json';
import { Interface, AbiCoder, JsonFragment } from '@ethersproject/abi';

import { AsyncOrSync } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { LemmaswapData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { LemmaswapConfig, Adapters } from './config';
import { LemmaswapEventPool } from './lemmaswap-pool';
import erc20ABI from '../../abi/erc20.json';
import lemmaSwapABI from '../../abi/lemmaswap/LemmaSwap.json';
import FORWARDER_ARTIFACT from '../../abi/lemmaswap/withByteCode/LemmaSwapForwarder.json';
import WALLET_ARTIFACT from '../../abi/lemmaswap/withByteCode/UnlockedWallet.json';
import { Provider } from '@ethersproject/providers';

const LemmaSwapGasCost = 80 * 1000;
const coder = new AbiCoder();

// const LemmaSwapAddress = "0x6B283Cbcd24fdF67E1C4E23d28815C2607eEfE29";
// const optimismProvider = process.env.HTTP_PROVIDER_10;//weirdly for infura as a provider it doesn't work for optimism kovan, try it with an alchemy provider
// const provider = ethers.getDefaultProvider(optimismProvider);
// const lemmaSwapInstance = new ethers.Contract(LemmaSwapAddress, lemmaSwapABI.abi, provider);

// Use a random address to "deploy" our forwarder contract to.
// const FORWARDER_ADDRESS = ethers.utils.hexlify(crypto.randomBytes(20));
// const WBTC_WHALE_WALLET = '0x078f358208685046a11c85e8ad32895ded33a249';//WBTC mainnet
// const WETH_WHALE_WALLET = '0x85149247691df622eaF1a8Bd0CaFd40BC45154a9';//WETH mainnet
// const LINK_WHALE_WALLET = '0x191c10Aa4AF7C30e871E70C95dB0E4eb77237530';//LINK mainnet
// const AAVE_WHALE_WALLET = '0xf329e36c7bf6e5e86ce2150875a84ce77f477375';//AAVE mainnet
// const CRV_WHALE_WALLET = '0x9644a6920bd0a1923c2c6c1dddf691b7a42e8a65';//CRV mainnet
// const PERP_WHALE_WALLET = '0xd360b73b19fb20ac874633553fb1007e9fcb2b78';//PERP mainnet

// var token_to_whale = {
//     // tokenAddress => token_whale_address
//     "0x4200000000000000000000000000000000000006": WETH_WHALE_WALLET,
//     "0x68f180fcce6836688e9084f035309e29bf0a2095": WBTC_WHALE_WALLET,
//     "0x350a791bfc2c21f9ed5d10980dad2e2638ffa7f6": LINK_WHALE_WALLET,
//     "0x76FB31fb4af56892A25e32cFC43De717950c9278": AAVE_WHALE_WALLET,
//     "0x0994206dfe8de6ec6920ff4d779b0d950605fb53": CRV_WHALE_WALLET,
//     "0x9e1028F5F1D5eDE59748FFceE5532509976840E0": PERP_WHALE_WALLET,
// };

// const TokensToWhales: { [network: number]: { [symbol: string]: any } } = {};
// const tokensByNetwork: { [network: number]: any } = {
//   [Network.MAINNET]: token_to_whale,
// };
// for (const [key, tokens] of Object.entries(tokensByNetwork)) {
//   for (const token of tokens) {
//     TokensToWhales[1][token.aSymbol] = token;
//   }
// }

const THIRTY_MINUTES = 60 * 30;

export class Lemmaswap extends SimpleExchange implements IDex<LemmaswapData> {
  // protected eventPools: LemmaswapEventPool;

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(LemmaswapConfig);

  readonly lemmaswap: Interface;
  public FORWARDER_ADDRESS: Address;
  public WETH_WHALE_WALLET: Address;
  public LemmaSwapAddress: Address;
  public opt_provider: any;
  // const provider = ethers.getDefaultProvider(optimismProvider);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    // this.lemmaSwapInstance = new ethers.Contract(LemmaSwapAddress, lemmaSwapABI.abi, dexHelper);
    this.logger = dexHelper.getLogger(dexKey);
    this.lemmaswap = new Interface(lemmaSwapABI.abi);

    this.FORWARDER_ADDRESS = this.dexHelper.web3Provider.utils.randomHex(20);
    this.WETH_WHALE_WALLET = '0x85149247691df622eaF1a8Bd0CaFd40BC45154a9';
    this.LemmaSwapAddress = '0x6B283Cbcd24fdF67E1C4E23d28815C2607eEfE29';
    this.opt_provider = this.dexHelper.provider;
    // this.eventPools = new LemmaswapEventPool(
    //   dexKey,
    //   network,
    //   dexHelper,
    //   this.logger,
    // );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // TODO: complete me!
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    // TODO: complete me!
    const from = this.dexHelper.config.wrapETH(srcToken);
    const to = this.dexHelper.config.wrapETH(destToken);

    if (from.address.toLowerCase() === to.address.toLowerCase()) {
      return [];
    }

    const tokenAddress = [from.address.toLowerCase(), to.address.toLowerCase()]
      .sort((a, b) => (a > b ? 1 : -1))
      .join('_');

    const poolIdentifier = `${this.dexKey}_${tokenAddress}`;
    return [poolIdentifier];
    // return [];
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<LemmaswapData>> {
    console.log('getPricesVolume----++', this.FORWARDER_ADDRESS);
    const forwarder = new Contract(
      this.FORWARDER_ADDRESS,
      FORWARDER_ARTIFACT.abi,
    );

    console.log('forwarder----++', forwarder.address);
    console.log('amounts----++', amounts.toString(), amounts.length);
    console.log('srcToken----++', srcToken);
    console.log('destToken----++', destToken);

    // const allAmountsout: any = amounts.map(async amount => {
    // // let allAmountsout: any
    // // for (var i=0; i<amounts.length; i++) {

    //   console.log('iii: ', amount.toString());

    //   if (amount.toString() == '0') {
    //     console.log('iii-hey: ', amount.toString());
    //     return BigInt(0);
    //   }

    //   const rawResult = await this.opt_provider.send(
    //       'eth_call',
    //       [
    //           await forwarder.populateTransaction.getAmountsOut(
    //             this.WETH_WHALE_WALLET,
    //             this.LemmaSwapAddress,
    //             amount, [srcToken.address, destToken.address]
    //           ),
    //           'pending',
    //           {
    //               [forwarder.address]: { code: FORWARDER_ARTIFACT.deployedBytecode.object },
    //               [this.WETH_WHALE_WALLET]: { code: WALLET_ARTIFACT.deployedBytecode.object }
    //           },
    //       ],
    //   );
    //   const amountsOut = await coder.decode(['uint256[]'], rawResult)[0];
    //   // console.log('amountsOut.slice(1): ', amountsOut.slice(1));
    //   // console.log('amountsOut-: ', amountsOut[0]);
    //   // console.log('amounts.length-: ', amounts.length);
    //   // console.log('amounts-: ', amounts);

    //   // if (amountsOut > 0) return null;
    //   // console.log('after amountsOut----++', amountsOut);
    //   return amountsOut;
    //   // allAmountsout[i] = amountsOut;
    //   // } else {
    //   //   console.log('ii---', i);
    //   //   // return 0;
    //   //   allAmountsout[i] = 0;
    //   // }
    // })
    // console.log('allll amountOuts----++', allAmountsout);
    const prices = await this.getAmountOut(
      forwarder,
      srcToken.address,
      destToken.address,
      amounts,
    );
    console.log('prices:', prices);
    if (!prices) return null;

    return [
      {
        prices: prices.slice(1),
        unit: amounts[0],
        gasCost: LemmaSwapGasCost,
        exchange: this.dexKey,
        data: {},
        poolAddresses: [], // TODO SUNNY
      },
    ];
  }

  async getAmountOut(
    forwarder: Contract,
    srcToken: Address,
    destToken: Address,
    amounts: bigint[],
  ): Promise<any[] | null> {
    if (!amounts) return null;
    return amounts.map(async amount => {
      if (amount.toString() == '0') {
        return 0n;
      } else {
        const rawResult = await this.opt_provider.send('eth_call', [
          await forwarder.populateTransaction.getAmountsOut(
            this.WETH_WHALE_WALLET,
            this.LemmaSwapAddress,
            amount,
            [srcToken, destToken],
          ),
          'pending',
          {
            [forwarder.address]: {
              code: FORWARDER_ARTIFACT.deployedBytecode.object,
            },
            [this.WETH_WHALE_WALLET]: {
              code: WALLET_ARTIFACT.deployedBytecode.object,
            },
          },
        ]);
        const amountOut = await coder.decode(['uint256[]'], rawResult)[0];
        return amountOut;
      }
    });
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<LemmaswapData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: LemmaswapData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
    // const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: this.LemmaSwapAddress,
      payload,
      networkFee: '0',
    };
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: LemmaswapData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    // TODO: complete me!
    // const { exchange } = data;
    const deadline = (Date.now() / 1000 + THIRTY_MINUTES).toFixed(0);

    // Encode here the transaction arguments
    const swapData = this.lemmaswap.encodeFunctionData(
      'swapExactTokensForTokens',
      [
        srcAmount,
        destAmount,
        [srcToken, destToken],
        this.augustusAddress,
        deadline,
      ],
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.LemmaSwapAddress,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    // TODO: complete me!
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    //TODO: complete me!
    return [];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
