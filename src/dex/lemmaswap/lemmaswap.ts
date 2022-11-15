import { Contract } from 'ethers';
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
import lemmaSwapABI from '../../abi/lemmaswap/LemmaSwap.json';
import FORWARDER_ARTIFACT from '../../abi/lemmaswap/withByteCode/LemmaSwapForwarder.json';
import WALLET_ARTIFACT from '../../abi/lemmaswap/withByteCode/UnlockedWallet.json';

const LemmaSwapGasCost = 80 * 1000;
const coder = new AbiCoder();

export const Tokens: { [network: number]: { [symbol: string]: Token } } = {
  [Network.OPTIMISM]: {
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
    },
  },
};

export const SupportedTokens: {
  [network: number]: { [symbol: string]: boolean };
} = {
  [Network.OPTIMISM]: {
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE': true,
    '0x7F5c764cBc14f9669B88837ca1490cCa17c31607': true,
    '0x68f180fcce6836688e9084f035309e29bf0a2095': true,
    '0x4200000000000000000000000000000000000006': true,
    '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6': true,
    '0x76FB31fb4af56892A25e32cFC43De717950c9278': true,
    '0x0994206dfe8de6ec6920ff4d779b0d950605fb53': true,
    '0x9e1028F5F1D5eDE59748FFceE5532509976840E0': true,
    '0x96F2539d3684dbde8B3242A51A73B66360a5B541': true,
  },
};

const tokenToWhales: {
  [network: number]: { [tokenAddress: string]: Address };
} = {
  [Network.OPTIMISM]: {
    // ETH USDC WBTC WETH LINK AAVE CRV PERP ==> whaleaddresses
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE':
      '0x9ef21bE1C270AA1c3c3d750F458442397fBFFCB6',
    '0x7F5c764cBc14f9669B88837ca1490cCa17c31607':
      '0xEBb8EA128BbdFf9a1780A4902A9380022371d466',
    '0x68f180fcce6836688e9084f035309e29bf0a2095':
      '0x078f358208685046a11c85e8ad32895ded33a249',
    '0x4200000000000000000000000000000000000006':
      '0x85149247691df622eaF1a8Bd0CaFd40BC45154a9',
    '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6':
      '0x191c10Aa4AF7C30e871E70C95dB0E4eb77237530',
    '0x76FB31fb4af56892A25e32cFC43De717950c9278':
      '0xf329e36c7bf6e5e86ce2150875a84ce77f477375',
    '0x0994206dfe8de6ec6920ff4d779b0d950605fb53':
      '0x9644a6920bd0a1923c2c6c1dddf691b7a42e8a65',
    '0x9e1028F5F1D5eDE59748FFceE5532509976840E0':
      '0xd360b73b19fb20ac874633553fb1007e9fcb2b78',
    '0x96F2539d3684dbde8B3242A51A73B66360a5B541':
      '0x0f3BF5c241B6625C0fA781ED137fDe6786b2e66f',
  },
};

const THIRTY_MINUTES = 60 * 30;

export class Lemmaswap extends SimpleExchange implements IDex<LemmaswapData> {
  // protected eventPools: LemmaswapEventPool;

  readonly hasConstantPriceLargeAmounts = false;

  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(LemmaswapConfig);

  readonly lemmaswap: Interface;
  public FORWARDER_ADDRESS: Address;
  public LemmaSwapAddress: Address;
  public opt_provider: any;
  public ETHER_ADDRESS: any;

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.lemmaswap = new Interface(lemmaSwapABI.abi);
    this.FORWARDER_ADDRESS = this.dexHelper.web3Provider.utils.randomHex(20);
    this.LemmaSwapAddress = '0x6B283Cbcd24fdF67E1C4E23d28815C2607eEfE29';
    this.ETHER_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
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
  async initializePricing(blockNumber: number) {}

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
    let from: any;
    if (srcToken.address != this.ETHER_ADDRESS) {
      from = this.dexHelper.config.wrapETH(srcToken);
    } else {
      from = srcToken;
    }
    const to = this.dexHelper.config.wrapETH(destToken);
    if (from.address.toLowerCase() === to.address.toLowerCase()) {
      return [];
    }

    const tokenAddress = [from.address.toLowerCase(), to.address.toLowerCase()]
      .sort((a, b) => (a > b ? 1 : -1))
      .join('_');

    const poolIdentifier = `${this.dexKey}_${tokenAddress}`;
    return [poolIdentifier];
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
    let isSrcToken: boolean = false;
    let isDestToken: boolean = false;
    isSrcToken = SupportedTokens[Network.OPTIMISM][srcToken.address];
    isDestToken = SupportedTokens[Network.OPTIMISM][srcToken.address];
    if (isSrcToken && isDestToken) {
      const forwarder = new Contract(
        this.FORWARDER_ADDRESS,
        FORWARDER_ARTIFACT.abi,
      );

      const prices: any = await this.getAmountOut(
        forwarder,
        srcToken.address,
        destToken.address,
        amounts,
      );
      if (!prices) return null;

      return [
        {
          prices: prices,
          unit: amounts[0],
          gasCost: LemmaSwapGasCost,
          exchange: this.dexKey,
          data: {},
          poolAddresses: [this.LemmaSwapAddress],
        },
      ];
    }
    // Tokens is not supported if null returns.
    return null;
  }

  async getAmountOut(
    forwarder: Contract,
    srcToken: Address,
    destToken: Address,
    amounts: bigint[],
  ): Promise<BigInt[] | null> {
    if (!amounts) return null;
    let _srcToken: string;
    let _destToken: string;
    if (srcToken == this.ETHER_ADDRESS) {
      _srcToken = Tokens[Network.OPTIMISM]['WETH'].address;
      _destToken = destToken.toString();
    } else if (destToken == this.ETHER_ADDRESS) {
      _srcToken = srcToken.toString();
      _destToken = Tokens[Network.OPTIMISM]['WETH'].address;
    } else {
      _srcToken = srcToken.toString();
      _destToken = destToken.toString();
    }

    const tokensToWhales = tokenToWhales[Network.OPTIMISM][_srcToken];
    return await Promise.all(
      amounts.map(async amount => {
        if (amount.toString() == '0') return 0n;
        {
          const rawResult = await this.opt_provider.send('eth_call', [
            await forwarder.populateTransaction.getAmountsOut(
              tokensToWhales,
              this.LemmaSwapAddress,
              amount,
              [_srcToken, _destToken],
            ),
            'pending',
            {
              [forwarder.address]: {
                code: FORWARDER_ARTIFACT.deployedBytecode.object,
              },
              [tokensToWhales]: {
                code: WALLET_ARTIFACT.deployedBytecode.object,
              },
            },
          ]);
          const amountOut = coder.decode(['uint256[]'], rawResult)[0];
          return amountOut[1].toString();
        }
      }),
    );
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<LemmaswapData>): number | number[] {
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
    const deadline = (Date.now() / 1000 + THIRTY_MINUTES).toFixed(0);
    // Encode here the transaction arguments
    let swapData;
    if (srcToken == this.ETHER_ADDRESS) {
      const weth = Tokens[Network.OPTIMISM]['WETH'];
      swapData = this.lemmaswap.encodeFunctionData('swapExactETHForTokens', [
        destAmount,
        [weth.address, destToken],
        this.augustusAddress,
        deadline,
      ]);
    } else if (destToken == this.ETHER_ADDRESS) {
      const weth = Tokens[Network.OPTIMISM]['WETH'];
      swapData = this.lemmaswap.encodeFunctionData('swapExactTokensForETH', [
        srcAmount,
        destAmount,
        [srcToken, weth.address],
        this.augustusAddress,
        deadline,
      ]);
    } else {
      swapData = this.lemmaswap.encodeFunctionData('swapExactTokensForTokens', [
        srcAmount,
        destAmount,
        [srcToken, destToken],
        this.augustusAddress,
        deadline,
      ]);
    }

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
  async updatePoolState(): Promise<void> {}

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {}
}
