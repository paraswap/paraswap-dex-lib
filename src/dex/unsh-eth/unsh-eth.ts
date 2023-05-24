import { Interface } from '@ethersproject/abi';
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
import { getDexKeysWithNetwork, isETHAddress, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { UnshEthData, UnshEthFunctions, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { UnshEthConfig, Adapters } from './config';
import VDAMM_ABI from '../../abi/vdamm.json';
import LSDVAULT_ABI from '../../abi/lsdVault.json';
import UNSHETHZAP_ABI from '../../abi/unshETHZap.json';

const UnshEthGasCost = 500 * 1000;

export class UnshEth extends SimpleExchange implements IDex<UnshEthData> {
  static readonly vdAmmInterface = new Interface(VDAMM_ABI);
  static readonly lsdVaultInterface = new Interface(LSDVAULT_ABI);
  static readonly unshETHZapInterface = new Interface(UNSHETHZAP_ABI);

  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = false;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(UnshEthConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    const config = UnshEthConfig[dexKey][network];
    this.config = {
      supportedTokens: config.supportedTokens.map(token => token.toLowerCase()),
      lsdVaultAddress: config.lsdVaultAddress.toLowerCase(),
      vdAmmAddress: config.vdAmmAddress.toLowerCase(),
      unshETHZapAddress: config.unshETHZapAddress.toLowerCase(),
      unshETHAddress: config.unshETHAddress.toLowerCase(),
    };
    this.logger = dexHelper.getLogger(dexKey);
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
    _blockNumber: number,
  ): Promise<string[]> {
    if (side === SwapSide.BUY) return [];
    const srcAddress = this.dexHelper.config
      .wrapETH(srcToken)
      .address.toLowerCase();
    const destAddress = this.dexHelper.config
      .wrapETH(destToken)
      .address.toLowerCase();
    if (
      srcAddress === destAddress ||
      !(
        this.config.supportedTokens.includes(srcAddress) &&
        this.config.supportedTokens.includes(destAddress)
      )
    ) {
      return [];
    }
    if (srcAddress === this.config.unshETHAddress) {
      return [];
    }

    return [`${this.dexKey}_${srcAddress}`, `${this.dexKey}_${destAddress}`];
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
  ): Promise<null | ExchangePrices<UnshEthData>> {
    if (side === SwapSide.BUY) return null;
    const srcAddress = this.dexHelper.config
      .wrapETH(srcToken)
      .address.toLowerCase();
    const destAddress = this.dexHelper.config
      .wrapETH(destToken)
      .address.toLowerCase();
    if (
      srcAddress === destAddress ||
      !(
        this.config.supportedTokens.includes(srcAddress) &&
        this.config.supportedTokens.includes(destAddress)
      )
    ) {
      return null;
    }
    if (srcAddress === this.config.unshETHAddress) {
      return null;
    }

    const srcPoolIdentifier = `${this.dexKey}_${srcAddress}`;
    const destPoolIdentifier = `${this.dexKey}_${destAddress}`;
    const pools = [srcPoolIdentifier, destPoolIdentifier];
    if (limitPools && pools.some(p => !limitPools.includes(p))) return null;

    const vdAmmContract = new this.dexHelper.web3Provider.eth.Contract(
      VDAMM_ABI as any,
      this.config.vdAmmAddress,
    );
    const lsdVaultContract = new this.dexHelper.web3Provider.eth.Contract(
      LSDVAULT_ABI as any,
      this.config.lsdVaultAddress,
    );
    const calcMint = async (amount: bigint): Promise<bigint> => {
      if (amount == 0n) return 0n;
      let res = await vdAmmContract.methods
        .getDepositFee(amount, srcAddress)
        .call();
      const depositFee = BigInt(res[0]);
      res = await lsdVaultContract.methods.getPrice(srcAddress).call();
      const price = BigInt(res);
      return (price * (amount - depositFee)) / BigInt('1000000000000000000');
    };
    const calcSwap = async (amount: bigint): Promise<bigint> => {
      if (amount == 0n) return 0n;
      const res = await vdAmmContract.methods
        .swapLsdToLsdCalcs(amount, srcAddress, destAddress)
        .call();
      return BigInt(res[0]);
    };

    const calc =
      destAddress === this.config.unshETHAddress ? calcMint : calcSwap;

    const unitVolume = getBigIntPow(srcToken.decimals);
    const prices = await Promise.all(
      [unitVolume, ...amounts].map(async amount => await calc(amount)),
    );

    return [
      {
        prices: prices.slice(1),
        unit: prices[0],
        gasCost: UnshEthGasCost,
        exchange: this.dexKey,
        data: {},
        poolAddresses: [this.config.vdAmmAddress],
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(_poolPrices: PoolPrices<UnshEthData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    _srcToken: string,
    _destToken: string,
    _srcAmount: string,
    _destAmount: string,
    _data: UnshEthData,
    _side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: this.config.vdAmmAddress,
      payload: '0x',
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
    data: UnshEthData,
    _side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const fromEth = isETHAddress(srcToken);
    const toEth = isETHAddress(destToken);
    const destAddress = destToken.toLowerCase();
    let swapData: string;
    let swapCallee: string = this.config.vdAmmAddress;
    if (fromEth) {
      swapData = UnshEth.vdAmmInterface.encodeFunctionData(
        UnshEthFunctions.swapEthToLsd,
        [destToken, destAmount],
      );
    } else if (toEth) {
      swapData = UnshEth.vdAmmInterface.encodeFunctionData(
        UnshEthFunctions.swapLsdToEth,
        [srcAmount, srcToken, destAmount],
      );
    } else if (destAddress === this.config.unshETHAddress) {
      swapData = UnshEth.unshETHZapInterface.encodeFunctionData(
        UnshEthFunctions.depositLsd,
        [srcToken, srcAmount],
      );
      swapCallee = this.config.unshETHZapAddress;
    } else {
      swapData = UnshEth.vdAmmInterface.encodeFunctionData(
        UnshEthFunctions.swapLsdToLsd,
        [srcAmount, srcToken, destToken, destAmount],
      );
    }

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      swapCallee,
    );
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    _limit: number,
  ): Promise<PoolLiquidity[]> {
    tokenAddress = tokenAddress.toLowerCase();
    if (!this.config.supportedTokens.includes(tokenAddress)) {
      return [];
    }
    if (tokenAddress === this.config.unshETHAddress) {
      return [];
    }
    return [
      {
        exchange: this.dexKey,
        address: this.config.vdAmmAddress,
        connectorTokens: this.config.supportedTokens
          .filter(
            token =>
              token !== tokenAddress && token !== this.config.unshETHAddress,
          )
          .map(token => ({
            decimals: 18,
            address: token,
          })),
        liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
      },
      {
        exchange: this.dexKey,
        address: this.config.unshETHZapAddress,
        connectorTokens: [
          {
            decimals: 18,
            address: this.config.unshETHAddress,
          },
        ],
        liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
      },
    ];
  }
}
