import {
  SmartTokenParams,
  balanceOfFn,
  allowanceFn,
  SmartToken,
  balancesFn,
  allowedFn,
} from '../tests/smart-tokens';
import { Address } from '../src/types';
import { ETHER_ADDRESS, Network } from '../src/constants';
import { ethers } from 'ethers';

export const GIFTER_ADDRESS = '0xb22fC4eC94D555A5049593ca4552c810Fb8a6d00';
export const GENERIC_ADDR1 = '0xbe9317f6711e2da074fe1f168fd9c402bc0a9d1b';
export const GENERIC_ADDR2 = '0x230a1ac45690b9ae1176389434610b9526d2f21b';

const PK_KEY = process.env.TEST_PK_KEY;

if (!PK_KEY) {
  throw new Error('Mising TEST_PK_KEY');
}
export const testAccount = new ethers.Wallet(PK_KEY!);

export const Tokens: {
  [network: number]: { [symbol: string]: SmartTokenParams };
} = {
  [Network.MAINNET]: {
    ETH: {
      address: ETHER_ADDRESS,
      decimals: 18,
    },
    REQ: {
      address: '0x8f8221aFbB33998d8584A2B05749bA73c37a938a',
      decimals: 18,
    },
    USDC: {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
      addBalance: balancesFn,
      addAllowance: allowedFn,
    },
    WBTC: {
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
      addBalance: balancesFn,
      addAllowance: allowedFn,
    },
    BADGER: {
      address: '0x3472A5A71965499acd81997a54BBA8D852C6E53d',
      decimals: 18,
    },
    USDT: {
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
    },
    STETH: {
      address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
      decimals: 18,
    },
    wstETH: {
      address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
      decimals: 18,
    },
    WETH: {
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
      addBalance: balanceOfFn,
      addAllowance: allowanceFn,
    },
    SETH: {
      address: '0x5e74C9036fb86BD7eCdcb084a0673EFc32eA31cb',
      decimals: 18,
    },
    LINK: {
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      decimals: 18,
    },
    DAI: {
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
      decimals: 18,
      addBalance: balanceOfFn,
      addAllowance: allowanceFn,
    },
    MLN: {
      address: '0xec67005c4e498ec7f55e092bd1d35cbc47c91892',
      decimals: 18,
    },
    SENT: {
      address: '0xa44E5137293E855B1b7bC7E2C6f8cD796fFCB037',
      decimals: 8,
    },
    oldFRAX: {
      address: '0x853d955acef822db058eb8505911ed77f175b99e',
      decimals: 18,
    },
    aDAI: {
      address: '0x028171bCA77440897B824Ca71D1c56caC55b68A3',
      decimals: 18,
    },
    aUSDT: {
      address: '0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811',
      decimals: 6,
    },
    waUSDT: {
      address: '0xf8Fd466F12e236f4c96F7Cce6c79EAdB819abF58',
      decimals: 6,
    },
    ALUSD: {
      address: '0xbc6da0fe9ad5f3b0d58160288917aa56653660e9',
      decimals: 18,
    },
    BAL: {
      address: '0xba100000625a3754423978a60c9317c58a424e3D',
      decimals: 18,
    },
    WISE: {
      address: '0x66a0f676479cee1d7373f3dc2e2952778bff5bd6',
      decimals: 18,
    },
    DDIM: {
      address: '0xFbEEa1C75E4c4465CB2FCCc9c6d6afe984558E20',
      decimals: 18,
    },
    DODO: {
      address: '0x43Dfc4159D86F3A37A5A4B3D4580b888ad7d4DDd',
      decimals: 18,
    },
    ADAI: {
      address: '0x028171bca77440897b824ca71d1c56cac55b68a3',
      decimals: 18,
    },
    AWETH: {
      address: '0x030ba81f1c18d280636f32af80b9aad02cf0854e',
      decimals: 18,
    },
    ALPHA: {
      address: '0xa1faa113cbe53436df28ff0aee54275c13b40975',
      decimals: 18,
    },
    CRV: {
      address: '0xd533a949740bb3306d119cc777fa900ba034cd52',
      decimals: 18,
    },
    INCH: {
      address: '0x111111111117dC0aa78b770fA6A738034120C302',
      decimals: 18,
    },
    mUSD: {
      address: '0xe2f2a5c287993345a840db3b0845fbc70f5935a5',
      decimals: 18,
    },
    mBTC: {
      address: '0x945facb997494cc2570096c74b5f66a3507330a1',
      decimals: 18,
    },
    renBTC: {
      address: '0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D',
      decimals: 8,
    },
    HBTC: {
      address: '0x0316EB71485b0Ab14103307bf65a021042c6d380',
      decimals: 18,
    },
    tBTC: {
      address: '0x8dAEBADE922dF735c38C80C7eBD708Af50815fAa',
      decimals: 18,
    },
    BUSD: {
      address: '0x4fabb145d64652a948d72533023f6e7a623c7c53',
      decimals: 18,
    },
    GUSD: {
      address: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
      decimals: 2,
    },
    ADAIv1: {
      address: '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d',
      decimals: 18,
    },
    CETH: {
      address: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5',
      decimals: 8,
    },
    CDAI: {
      address: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
      decimals: 8,
    },
    MIM: {
      address: '0x99D8a9C45b2ecA8864373A26D1459e3Dff1e17F3',
      decimals: 18,
    },
    AnkETH: {
      address: '0xE95A203B1a91a908F9B9CE46459d101078c2c3cb',
      decimals: 18,
    },
    EURS: {
      address: '0xdB25f211AB05b1c97D595516F45794528a807ad8',
      decimals: 2,
    },
    EURT: {
      address: '0xC581b735A1688071A1746c968e0798D642EDE491',
      decimals: 6,
    },
    jEUR: {
      address: '0x0f17bc9a994b87b5225cfb6a2cd4d667adb4f20b',
      decimals: 18,
    },
    jCHF: {
      address: '0x53dfea0a8cc2a2a2e425e1c174bc162999723ea0',
      decimals: 18,
    },
    jGBP: {
      address: '0x7409856cae628f5d578b285b45669b36e7005283',
      decimals: 18,
    },
    XAUT: {
      address: '0x68749665FF8D2d112Fa859AA293F07A622782F38',
      decimals: 6,
    },
    CVX: {
      address: '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B',
      decimals: 18,
    },
    UST: {
      address: '0xa47c8bf37f92abed4a126bda807a7b7498661acd',
      decimals: 18,
    },
    SAITAMA: {
      address: '0x8b3192f5eebd8579568a2ed41e6feb402f93f73f',
      decimals: 9,
    },
    BBAUSDT: {
      // bpt of USDT Linear Pool
      address: '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c',
      decimals: 18,
    },
    BBADAI: {
      // bpt of DAI Linear Pool
      address: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
      decimals: 18,
    },
    BBAUSD: {
      address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
      decimals: 18,
    },
    BBFDAI: {
      address: '0x8f4063446f5011bc1c9f79a819efe87776f23704',
      decimals: 18,
    },
    FEI: {
      address: '0x956F47F50A910163D8BF957Cf5846D573E7f87CA',
      decimals: 18,
    },
    newFRAX: {
      address: '0x853d955aCEf822Db058eb8505911ED77F175b99e',
      decimals: 18,
    },
    sBTC: {
      address: '0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6',
      decimals: 18,
    },
    sETH: {
      address: '0x5e74C9036fb86BD7eCdcb084a0673EFc32eA31cb',
      decimals: 18,
    },
    sUSD: {
      address: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
      decimals: 18,
    },
  },
  [Network.ROPSTEN]: {
    DAI: {
      address: '0xaD6D458402F60fD3Bd25163575031ACDce07538D',
      decimals: 18,
    },
    WETH: {
      address: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
      decimals: 18,
    },
    ETH: { address: ETHER_ADDRESS, decimals: 18 },
    USDC: {
      address: '0x2ecf57cfaf2faedf1575d2372398ee34c428d6c3',
      decimals: 6,
    },
  },
  [Network.POLYGON]: {
    DAI: {
      address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      decimals: 18,
    },
    USDC: {
      address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
      decimals: 6,
    },
    WETH: {
      address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
      decimals: 18,
    },
    WMATIC: {
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      decimals: 18,
    },
    AMWMATIC: {
      address: '0x8dF3aad3a84da6b69A4DA8aeC3eA40d9091B2Ac4',
      decimals: 18,
    },
    MUST: {
      address: '0x9C78EE466D6Cb57A4d01Fd887D2b5dFb2D46288f',
      decimals: 18,
    },
    AMDAI: {
      address: '0x27F8D03b3a2196956ED754baDc28D73be8830A6e',
      decimals: 18,
    },
    BTU: {
      address: '0xfdc26cda2d2440d0e83cd1dee8e8be48405806dc',
      decimals: 18,
    },
    USDT: {
      address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      decimals: 6,
    },
    WBTC: {
      address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
      decimals: 8,
    },
    MATIC: { address: ETHER_ADDRESS, decimals: 18 },
    mUSD: {
      address: '0xe840b73e5287865eec17d250bfb1536704b43b21',
      decimals: 18,
    },
    AMWETH: {
      address: '0x28424507fefb6f7f8e9d3860f56504e4e5f5f390',
      decimals: 18,
    },
    AMWBTC: {
      address: '0x5c2ed810328349100a66b82b78a1791b101c9d61',
      decimals: 8,
    },
    KNC: {
      address: '0x1c954e8fe737f99f68fa1ccda3e51ebdb291948c',
      decimals: 18,
    },
    jEUR: {
      address: '0x4e3decbb3645551b8a19f0ea1678079fcb33fb4c',
      decimals: 18,
    },
    jGPB: {
      address: '0x767058f11800fba6a682e73a6e79ec5eb74fac8c',
      decimals: 18,
    },
    jCHF: {
      address: '0xbd1463f02f61676d53fd183c2b19282bff93d099',
      decimals: 18,
    },
    RADIO: {
      address: '0x613a489785C95afEB3b404CC41565cCff107B6E0',
      decimals: 18,
    },
    HANZO: {
      address: '0x37eb60f78e06c4bb2a5f836b0fc6bccbbaa995b3',
      decimals: 9,
    },
    RVLT: {
      address: '0xf0f9d895aca5c8678f706fb8216fa22957685a13',
      decimals: 18,
    },
  },
  [Network.FANTOM]: {
    FTM: { address: ETHER_ADDRESS, decimals: 18 },
    WFTM: {
      address: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83',
      decimals: 18,
    },
    USDC: {
      address: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
      decimals: 6,
    },
    FUSDT: {
      address: '0x049d68029688eabf473097a2fc38ef61633a3c7a',
      decimals: 6,
    },
    FRAX: {
      address: '0xdc301622e621166BD8E82f2cA0A26c13Ad0BE355',
      decimals: 18,
    },
    nETH: {
      address: '0x67C10C397dD0Ba417329543c1a40eb48AAa7cd00',
      decimals: 18,
    },
    WETH: {
      address: '0x74b23882a30290451A17c44f4F05243b6b58C76d',
      decimals: 18,
    },
    SPIRIT: {
      address: '0x5cc61a78f164885776aa610fb0fe1257df78e59b',
      decimals: 18,
    },
    wBOMB: {
      address: '0xc09a82ad5075b3067d80f54f05e1e22229699cc1',
      decimals: 18,
    },
  },
  [Network.BSC]: {
    DAI: {
      address: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
      decimals: 18,
    },
    WBNB: {
      address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      decimals: 18,
    },
    BUSD: {
      address: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      decimals: 18,
    },
    USDT: {
      address: '0x55d398326f99059ff775485246999027b3197955',
      decimals: 18,
    },
    ETH: {
      address: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
      decimals: 18,
    },
    UST: {
      address: '0x23396cf899ca06c4472205fc903bdb4de249d6fc',
      decimals: 18,
    },
    USDC: {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      decimals: 18,
    },
    RADIO: {
      address: '0x30807D3b851A31d62415B8bb7Af7dCa59390434a',
      decimals: 18,
    },
    BNB: { address: ETHER_ADDRESS, decimals: 18 },
    bBTC: {
      address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
      decimals: 18,
    },
    anyBTC: {
      address: '0x54261774905f3e6E9718f2ABb10ed6555cae308a',
      decimals: 8,
    },
    nUSD: {
      address: '0x23b891e5C62E0955ae2bD185990103928Ab817b3',
      decimals: 18,
    },
    CONE: {
      address: '0xA60205802E1B5C6EC1CAFA3cAcd49dFeECe05AC9',
      decimals: 18,
    },
    axlUSD: {
      address: '0x4268B8F0B87b6Eae5d897996E6b845ddbD99Adf3',
      decimals: 6,
    },
  },
  [Network.AVALANCHE]: {
    USDCe: {
      address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
      decimals: 6,
    },
    USDC: {
      address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      decimals: 6,
    },
    USDTe: {
      address: '0xc7198437980c041c805A1EDcbA50c1Ce5db95118',
      decimals: 6,
    },
    USDT: {
      address: '0xde3A24028580884448a5397872046a019649b084',
      decimals: 6,
    },
    USDt: {
      address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      decimals: 6,
    },
    WAVAX: {
      address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
      decimals: 18,
    },
    sAVAX: {
      address: '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE',
      decimals: 18,
    },
    WETHe: {
      address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
      decimals: 18,
    },
    ETH: {
      address: '0xf20d962a6c8f70c731bd838a3a388D7d48fA6e15',
      decimals: 18,
    },
    WBTC: {
      address: '0x408D4cD0ADb7ceBd1F1A1C33A0Ba2098E1295bAB',
      decimals: 8,
    },
    WETH: {
      address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
      decimals: 18,
    },
    TUSD: {
      address: '0x1c20e891bab6b1727d14da358fae2984ed9b59eb',
      decimals: 18,
    },
    oldFRAX: {
      address: '0xdc42728b0ea910349ed3c6e1c9dc06b5fb591f98',
      decimals: 18,
    },
    newFRAX: {
      address: '0xd24c2ad096400b6fbcd2ad8b24e7acbc21a1da64',
      decimals: 18,
    },
    DAIE: {
      address: '0xd586e7f844cea2f87f50152665bcbc2c279d8d70',
      decimals: 18,
    },
    PNG: {
      address: '0x60781c2586d68229fde47564546784ab3faca982',
      decimals: 18,
    },
    SHIBX: {
      address: '0x440aBbf18c54b2782A4917b80a1746d3A2c2Cce1',
      decimals: 18,
    },
    wBTC: {
      address: '0x50b7545627a5162F82A992c33b87aDc75187B218',
      decimals: 8,
    },
    renBTC: {
      address: '0xDBf31dF14B66535aF65AaC99C32e9eA844e14501',
      decimals: 8,
    },
    BTCb: {
      address: '0x152b9d0FdC40C096757F570A51E494bd4b943E50',
      decimals: 8,
    },
    ADAI: {
      address: '0x47AFa96Cdc9fAb46904A55a6ad4bf6660B53c38a',
      decimals: 18,
    },
    avWAVAX: {
      address: '0xDFE521292EcE2A4f44242efBcD66Bc594CA9714B',
      decimals: 18,
    },
    MIM: {
      address: '0x130966628846BFd36ff31a822705796e8cb8C18D',
      decimals: 18,
    },
    TSD: {
      address: '0x4fbf0429599460D327BD5F55625E30E4fC066095',
      decimals: 18,
    },
    avUSDT: {
      address: '0x532e6537fea298397212f09a61e03311686f548e',
      decimals: 6,
    },
    THO: {
      address: '0xAE4AA155D2987B454C29450ef4f862CF00907B61',
      decimals: 18,
    },
    AVAX: { address: ETHER_ADDRESS, decimals: 18 },
    aETH: {
      address: '0x3a3A65aAb0dd2A17E3F1947bA16138cd37d08c04',
      decimals: 18,
    },
    aUSDT: {
      address: '0x71fc860f7d3a592a4a98740e39db31d25db65ae8',
      decimals: 6,
    },
    YUSD: {
      address: '0x111111111111ed1D73f860F57b2798b683f2d325',
      decimals: 18,
    },
    H2O: {
      address: '0x026187BdbC6b751003517bcb30Ac7817D5B766f8',
      decimals: 18,
    },
    MONEY: {
      address: '0x0f577433Bf59560Ef2a79c124E9Ff99fCa258948',
      decimals: 18,
    },
    nETH: {
      address: '0x19E1ae0eE35c0404f835521146206595d37981ae',
      decimals: 18,
    },
    avWETH: {
      address: '0x53f7c5869a859F0AeC3D334ee8B4Cf01E3492f21',
      decimals: 18,
    },
    nUSD: {
      address: '0xCFc37A6AB183dd4aED08C204D1c2773c0b1BDf46',
      decimals: 18,
    },
  },
  [Network.ARBITRUM]: {
    DAI: {
      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      decimals: 18,
    },
    WETH: {
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      decimals: 18,
    },
    ETH: { address: ETHER_ADDRESS, decimals: 18 },
    USDC: {
      address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      decimals: 6,
    },
    FRAX: {
      address: '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F',
      decimals: 18,
    },
    nUSD: {
      address: '0x2913E812Cf0dcCA30FB28E6Cac3d2DCFF4497688',
      decimals: 18,
    },
    nETH: {
      address: '0x3ea9B0ab55F34Fb188824Ee288CeaEfC63cf908e',
      decimals: 18,
    },
    EURS: {
      address: '0xd22a58f79e9481d1a88e00c343885a588b34b68b',
      decimals: 2,
    },
    AAVE: {
      address: '0xba5ddd1f9d7f570dc94a51479a000e3bce967196',
      decimals: 18,
    },
    MIM: {
      address: '0xFEa7a6a0B346362BF88A9e4A88416B77a57D6c2A',
      decimals: 18,
    },
  },
  [Network.OPTIMISM]: {
    DAI: {
      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      decimals: 18,
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
    },
    ETH: { address: ETHER_ADDRESS, decimals: 18 },
    USDC: {
      address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
      decimals: 6,
    },
    USDT: {
      address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      decimals: 6,
    },
    OP: {
      address: '0x4200000000000000000000000000000000000042',
      decimals: 18,
    },
    sBTC: {
      address: '0x298B9B95708152ff6968aafd889c6586e9169f1D',
      decimals: 18,
    },
    sETH: {
      address: '0xE405de8F52ba7559f9df3C368500B6E6ae6Cee49',
      decimals: 18,
    },
    sUSD: {
      address: '0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9',
      decimals: 18,
    },
  },
};

export const Holders: {
  [network: number]: { [tokenAddress: string]: Address };
} = {
  [Network.MAINNET]: {
    ETH: '0x176F3DAb24a159341c0509bB36B833E7fdd0a132',
    USDC: '0x99F5F9d77D802adB49f0C35C3139d16043735c9c',
    WBTC: '0x6daB3bCbFb336b29d06B9C793AEF7eaA57888922',
    BADGER: '0x34e2741a3f8483dbe5231f61c005110ff4b9f50a',
    STETH: '0x9bdb521a97e95177bf252c253e256a60c3e14447',
    wstETH: '0x6cE0F913F035ec6195bC3cE885aec4C66E485BC4',
    WETH: '0x6555e1CC97d3cbA6eAddebBCD7Ca51d75771e0B8',
    USDT: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
    XAUT: '0xc4e161e8d8a4bc4ac762ab33a28bbac5474203d7',
    CVX: '0x0aCA67Fa70B142A3b9bF2eD89A81B40ff85dACdC',
    MIM: '0xa046a8660e66d178ee07ec97c585eeb6aa18c26c',
    AnkETH: '0xF7260D4ADc48fEefd5a19a9Eb23f9747CeE15C92',
    DAI: '0x4943b0c9959dcf58871a799dfb71bece0d97c9f4',
    oldFRAX: '0x183d0dc5867c01bfb1dbbc41d6a9d3de6e044626',
    newFRAX: '0x183d0dc5867c01bfb1dbbc41d6a9d3de6e044626',
    FEI: '0x19c549357034d10db8d75ed812b45be1dd8a7218',
    BAL: '0x7514f531ef3721b8d2ff8d3a841d7c05011eecca',
    WISE: '0x25c315e0758beeab30ee048a4e2080e7084b64b3',
    DDIM: '0x229cbd1955fee93ab6e7876c1b17f6d0b859e953',
    DODO: '0x3e19d726ed435afd3a42967551426b3a47c0f5b7',
    ADAI: '0x826c3064d4f5b9507152f5cb440ca9326e1ec8fa',
    AWETH: '0xa433105e7396070a5e1fdd7e2b2338f1bfa0de68',
    BUSD: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503',
    INCH: '0x4ee7c0f5480eb1edd8902a5e8b991ed52992d5f5',
    mUSD: '0x3aD1D5CFCF9169Da73C23D85d5f2Bf53bC9d39dF',
    mBTC: '0x15A295e9BCFcF93a8721DCb9A19330fc59771271',
    renBTC: '0xAaE0633E15200bc9C50d45cD762477D268E126BD',
    tBTC: '0xC25099792E9349C7DD09759744ea681C7de2cb66',
    HBTC: '0x52885fF60Cd7Ae081e0665968C457DdACF888C90',
    GUSD: '0x5f65f7b609678448494De4C87521CdF6cEf1e932',
    LINK: '0x98c63b7b319dfbdf3d811530f2ab9dfe4983af9d',
    ADAIv1: '0x3021026e4ff227571a5a563ad19ea657c7027e59',
    CETH: '0x712d0f306956a6a4b4f9319ad9b9de48c5345996',
    CDAI: '0xab4ce310054a11328685ece1043211b68ba5d082',
    EURS: '0xC1056Adeb61a01964Ea265cA95EffB7016f9Ed78',
    EURT: '0x6914FC70fAC4caB20a8922E900C4BA57fEECf8E1',
    CRV: '0x7a16fF8270133F063aAb6C9977183D9e72835428',
    jEUR: '0x4f0CF2F63913524b85c1126AB7eE7957857f3482',
    UST: '0xf16e9b0d03470827a95cdfd0cb8a8a3b46969b91',
    SAITAMA: '0x763d5d93f27615aac852b70549f5877b92193864',
    aETH: '0xc03c4476fbe25138bf724fa1b95551c6e6b8fd2c',
    aWETH: '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296',
    aUSDT: '0x4aef720f7bbe98f916221bbc2fb5a15efe6d2cb8',
    BBAUSD: '0x4361b7425cff39b1be9bf12cee2ef32f89656cda',
    sBTC: '0xc8c2b727d864cc75199f5118f0943d2087fb543b',
    sETH: '0x5fe009d78afabc1b04abd2d4361f8e95cd402648',
    sUSD: '0xcfb87039a1eda5428e2c8386d31ccf121835ecdb',
  },
  [Network.ROPSTEN]: {
    ETH: '0x43262A12d8610AA70C15DbaeAC321d51613c9071',
    DAI: '0xbe13517a2b520b2449068D2ec45280992B04047B',
    WETH: '0xdA87Da8C599E8A8993f3CBCD0aA5A1316A559A6D',
    USDC: '0xb2dafb6fc7f66526e72027ade0f044beda0ba11e',
  },
  [Network.POLYGON]: {
    MATIC: '0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245',
    DAI: '0x06959153B974D0D5fDfd87D561db6d8d4FA0bb0B',
    WETH: '0x72a53cdbbcc1b9efa39c834a540550e23463aacb',
    WMATIC: '0xFffbCD322cEace527C8ec6Da8de2461C6D9d4e6e',
    AMWMATIC: '0x8832924854e3Cedb0a6Abf372e6CCFF9F7654332',
    USDC: '0x06959153B974D0D5fDfd87D561db6d8d4FA0bb0B',
    MUST: '0x9f2a409848fb9b7bd058b24a23e8dbf1e166a109',
    AMDAI: '0xFA0DCe8280FCDf369a4cbFc1830d3302789307a6',
    mUSD: '0x5084f622cbDf1E22E473d66d97916524745B9b6e',
    USDT: '0x0d0707963952f2fba59dd06f2b425ace40b492fe',
    WBTC: '0xdc9232e2df177d7a12fdff6ecbab114e2231198d',
    AMWETH: '0x6f1c28c40b5fed4fb546f85959ae2f7c16365cad',
    KNC: '0x41Af7fd16dFC29bdA8D8aAA4CeFfC0E8046992eC',
    jEUR: '0x4f15818dc2Ae5FA84D519D88Cb2CAAe9cd18EE6d',
    aUSDT: '0x027ffd3c119567e85998f4e6b9c3d83d5702660c',
    aPolUSDT: '0x941da3d6759147736456cee36647213183079337',
    aPolWMATIC: '0x7d96a6f41fd31c7624f7069415be58b5e3576d34',
    RADIO: '0x60531b9c3645546d864604ee0fc5b7d6adc81cc2',
    HANZO: '0x8a151b6ec99c7b90b342ab401d511b480309b220',
    RVLT: '0x815f87ca3db2b9491115a7769aeacb140361c5a9',
  },
  [Network.FANTOM]: {
    FTM: '0xEBf4FBB9C81b84dd5CF89BC75588E5d0018501b3',
    WFTM: '0x4901C740607E415685b4d09E4Aa960329cd183Ca',
    USDC: '0xd1e4a32679216f4a4dd38e45dab9bc4b8a45e592',
    FUSDT: '0xca436e14855323927d6e6264470ded36455fc8bd',
    aFanUSDT: '0xb0c9c5b5211de3a75b61bb798887b76accd64193',
    aFanWFTM: '0x639ade8805c0081ea5da9495bb50751003e827cc',
    FRAX: '0x4423ac71f53ca92e2f2be5917a9c2468e7412f4a',
    nETH: '0x16b658270ac50c0063940ed287c401b3df7ccf70',
    WETH: '0x2400bb4d7221ba530daee061d5afe219e9223eae',
    SPIRIT: '0x0d0707963952f2fba59dd06f2b425ace40b492fe',
    wBOMB: '0x28aa4f9ffe21365473b64c161b566c3cdead0108',
  },
  [Network.BSC]: {
    DAI: '0xf68a4b64162906eff0ff6ae34e2bb1cd42fef62d',
    WBNB: '0x59d779bed4db1e734d3fda3172d45bc3063ecd69',
    BUSD: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe',
    BNB: '0xf68a4b64162906eff0ff6ae34e2bb1cd42fef62d',
    USDT: '0xf89d7b9c864f589bbf53a82105107622b35eaa40',
    ETH: '0xefdca55e4bce6c1d535cb2d0687b5567eef2ae83',
    USDC: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
    RADIO: '0x75b3efed620e2d6750d88263cd4d7a27b0d7d3c5',
    bBTC: '0x72a53cdbbcc1b9efa39c834a540550e23463aacb',
    anyBTC: '0x4ffef8e8a75c20ab0ddf96c50d2457277d27923c',
    nUSD: '0x28ec0b36f0819ecb5005cab836f4ed5a2eca4d13',
    axlUSD: '0xc03fbeda9069b22a120ae6a09349a0b5eea5570a',
  },
  [Network.AVALANCHE]: {
    AVAX: '0xD6216fC19DB775Df9774a6E33526131dA7D19a2c',
    avWAVAX: '0xc5ed2333f8a2C351fCA35E5EBAdb2A82F5d254C3',
    WAVAX: '0xAc1F5F1eDBcAE771be00d0eC044deC5BEdbFd816',
    sAVAX: '0xC73DF1e68FC203F6E4b6270240D6f82A850e8D38',
    USDCe: '0xCe2CC46682E9C6D5f174aF598fb4931a9c0bE68e',
    USDC: '0x4aefa39caeadd662ae31ab0ce7c8c2c9c0a013e8',
    USDTe: '0x84d34f4f83a87596cd3fb6887cff8f17bf5a7b83',
    USDT: '0x715f3c533Cf264215Ba8BE00838a053284351086',
    WETHe: '0xD291B51f7a1a1F4917D085F2a7731A447E4aF82D',
    ETH: '0x9852e84b5AA485683d8AeE7B0332e42442763b75',
    DAIE: '0xED2a7edd7413021d440b09D654f3b87712abAB66',
    TUSD: '0x5Db946411F08f15300f23D9bde4A407B07D56C03',
    PNG: '0x348b11CF986e8E1CdA10c4A7E375aA252b47fc55',
    SHIBX: '0xfE5ADf65BE1a46b83EF3d352A8F9258A039f3050',
    wBTC: '0xbB2BD754A45f400A01158A8b3C89DE085D58ABF1',
    renBTC: '0xb8D1D22609D10078Db36915fc4610F8674b44319',
    ADAI: '0xc5ed2333f8a2C351fCA35E5EBAdb2A82F5d254C3',
    MIM: '0x652aD82d4CcbA3b162094b7bee69436d36754317',
    TSD: '0x691A89db352B72dDb249bFe16503494eC0D920A4',
    THO: '0xc40d16c47394a506d451475c8a7c46c1175c1da1',
    aAvaUSDT: '0x4cf82fe8e0072d546729d005b08faeeab8528cb7',
    USDt: '0x876eabf441b2ee5b5b0554fd502a8e0600950cfa',
    aAvaWAVAX: '0xd3117031ed778fe1cf2b153b7573173c7565f33a',
    oldFRAX: '0x4e3376018add04ebe4c46bf6f924ddec8c67aa7b',
    newFRAX: '0x4e3376018add04ebe4c46bf6f924ddec8c67aa7b',
    nETH: '0xcf2ef00e75558512ae735679ea5df62ad2056786',
    avWETH: '0x92d78e32b990d10aeca0875dc5585f1a6f958179',
  },
  [Network.ARBITRUM]: {
    ETH: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
    DAI: '0xc5ed2333f8a2C351fCA35E5EBAdb2A82F5d254C3',
    WETH: '0xc2707568D31F3fB1Fc55B2F8b2ae5682eAa72041',
    USDC: '0x1714400FF23dB4aF24F9fd64e7039e6597f18C2b',
    FRAX: '0xf07d553b195080f84f582e88ecdd54baa122b279',
    nUSD: '0x9dd329f5411466d9e0c488ff72519ca9fef0cb40',
    nETH: '0xa067668661c84476afcdc6fa5d758c4c01c34352',
    AAVE: '0x7185fbff199928cbae71990ecb3cc4a7be2ff00a',
    EURS: '0x4449dd09067dcaa55c15f40b465a5173778f8100',
    MIM: '0xf46bb6dda9709c49efb918201d97f6474eac5aea',
  },
  [Network.OPTIMISM]: {
    ETH: '0x9ef21bE1C270AA1c3c3d750F458442397fBFFCB6',
    DAI: '0x19537BADE509ea6C4BCc8101dC44c72042116Dda',
    WETH: '0x68526A4295236D2f18cEda8A200CdDD5Aab9e2cC',
    USDC: '0xEBb8EA128BbdFf9a1780A4902A9380022371d466',
    USDT: '0xEBb8EA128BbdFf9a1780A4902A9380022371d466',
    OP: '0xEBb8EA128BbdFf9a1780A4902A9380022371d466',
    aOptWETH: '0x9CBF099ff424979439dFBa03F00B5961784c06ce',
    aOptUSDC: '0x70144e5b5bbf464cFf98d689254dc7C7223E01Ab',
    sBTC: '0xbbb33d2e7bd7ddc722e53da9ca8ee97df41cfabf',
    sETH: '0xa5f7a39e55d7878bc5bd754ee5d6bd7a7662355b',
    sUSD: '0xa5f7a39e55d7878bc5bd754ee5d6bd7a7662355b',
  },
};

export const SmartTokens = Object.keys(Tokens).reduce((acc, _network) => {
  const network = parseInt(_network, 10);
  acc[+network] = Object.keys(Tokens[network]).reduce((_acc, tokenName) => {
    const token: SmartTokenParams = Tokens[network][tokenName]!;

    if (token.addAllowance && token.addBalance) {
      _acc[tokenName] = new SmartToken(token);
    }

    return _acc;
  }, {} as Record<string, SmartToken>);
  return acc;
}, {} as Record<number, Record<string, SmartToken>>);

export const NativeTokenSymbols: { [network: number]: string } = {
  [Network.MAINNET]: 'ETH',
  [Network.POLYGON]: 'MATIC',
  [Network.BSC]: 'BNB',
  [Network.AVALANCHE]: 'AVAX',
  [Network.FANTOM]: 'FTM',
  [Network.ARBITRUM]: 'ETH',
  [Network.OPTIMISM]: 'ETH',
};
