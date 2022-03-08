import { Address, Token } from '../src/types';
import { ETHER_ADDRESS, Network } from '../src/constants';

export const Tokens: { [network: number]: { [symbol: string]: Token } } = {
  [Network.MAINNET]: {
    ETH: {
      address: ETHER_ADDRESS,
      decimals: 18,
    },
    USDC: {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
    WBTC: {
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      decimals: 8,
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
    WETH: {
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
    },
    // Fix the decimals for the tokens below
    // SETH: {address: '0x5e74C9036fb86BD7eCdcb084a0673EFc32eA31cb', decimals: 18},
    // LINK: {address: '0x514910771af9ca656af840dff83e8264ecf986ca', decimals: 18},
    // DAI: {address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18},
    // MLN: {address: '0xec67005c4e498ec7f55e092bd1d35cbc47c91892', decimals: 18},
    // SENT: {address: '0xa44E5137293E855B1b7bC7E2C6f8cD796fFCB037', decimals: 18},
    // FRAX: {address: '0x853d955acef822db058eb8505911ed77f175b99e', decimals: 18},
    // aDAI: {address: '0x028171bCA77440897B824Ca71D1c56caC55b68A3', decimals: 18},
    // aUSDT: {address: '0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811', decimals: 18},
    // ALUSD: {address: '0xbc6da0fe9ad5f3b0d58160288917aa56653660e9', decimals: 18},
    // BAL: {address: '0xba100000625a3754423978a60c9317c58a424e3D', decimals: 18},
    // WISE: {address: '0x66a0f676479cee1d7373f3dc2e2952778bff5bd6', decimals: 18},
    // DDIM: {address: '0xFbEEa1C75E4c4465CB2FCCc9c6d6afe984558E20', decimals: 18},
    // DODO: {address: '0x43Dfc4159D86F3A37A5A4B3D4580b888ad7d4DDd', decimals: 18},
    // ADAI: {address: '0x028171bca77440897b824ca71d1c56cac55b68a3', decimals: 18},
    // AWETH: {address: '0x030ba81f1c18d280636f32af80b9aad02cf0854e', decimals: 18},
    // ALPHA: {address: '0xa1faa113cbe53436df28ff0aee54275c13b40975', decimals: 18},
    // CRV: {address: '0xd533a949740bb3306d119cc777fa900ba034cd52', decimals: 18},
    // INCH: {address: '0x111111111117dC0aa78b770fA6A738034120C302', decimals: 18},
    // mUSD: {address: '0xe2f2a5c287993345a840db3b0845fbc70f5935a5', decimals: 18},
    // mBTC: {address: '0x945facb997494cc2570096c74b5f66a3507330a1', decimals: 18},
    // renBTC: {address: '0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D', decimals: 18},
    // HBTC: {address: '0x0316EB71485b0Ab14103307bf65a021042c6d380', decimals: 18},
    // tBTC: {address: '0x8dAEBADE922dF735c38C80C7eBD708Af50815fAa', decimals: 18},
    // BUSD: {address: '0x4fabb145d64652a948d72533023f6e7a623c7c53', decimals: 18},
    // GUSD: {address: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd', decimals: 18},
    // ADAIv1: {address: '0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d', decimals: 18},
    // CETH: {address: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5', decimals: 18},
    // CDAI: {address: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643', decimals: 18},
    // MIM: {address: '0x99D8a9C45b2ecA8864373A26D1459e3Dff1e17F3', decimals: 18},
    // AnkETH: {address: '0xE95A203B1a91a908F9B9CE46459d101078c2c3cb', decimals: 18},
    // EURS: {address: '0xdB25f211AB05b1c97D595516F45794528a807ad8', decimals: 18},
    // EURT: {address: '0xC581b735A1688071A1746c968e0798D642EDE491', decimals: 18},
    // jEUR: {address: '0x0f17bc9a994b87b5225cfb6a2cd4d667adb4f20b', decimals: 18},
    // jCHF: {address: '0x53dfea0a8cc2a2a2e425e1c174bc162999723ea0', decimals: 18},
    // jGBP: {address: '0x7409856cae628f5d578b285b45669b36e7005283', decimals: 18},
    // XAUT: {address: '0x68749665FF8D2d112Fa859AA293F07A622782F38', decimals: 18},
    // CVX: {address: '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B', decimals: 18},
    // UST: {address: '0xa47c8bf37f92abed4a126bda807a7b7498661acd', decimals: 18},
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
  },
};

export const Holders: {
  [network: number]: { [tokenAddress: string]: Address };
} = {
  [Network.MAINNET]: {
    ETH: '0x73BCEb1Cd57C711feaC4224D062b0F6ff338501e',
    USDC: '0x0f4ee9631f4be0a63756515141281a3e2b293bbe',
    WBTC: '0x6daB3bCbFb336b29d06B9C793AEF7eaA57888922',
    BADGER: '0x34e2741a3f8483dbe5231f61c005110ff4b9f50a',
    STETH: '0x06920c9fc643de77b99cb7670a944ad31eaaa260',
    WETH: '0x6555e1CC97d3cbA6eAddebBCD7Ca51d75771e0B8',
    USDT: '0x7d812b62dc15e6f4073eba8a2ba8db19c4e40704',
    // Uncomment once the tokens are added above
    // XAUT: '0xc4e161e8d8a4bc4ac762ab33a28bbac5474203d7',
    // CVX: '0x0aCA67Fa70B142A3b9bF2eD89A81B40ff85dACdC',
    // MIM: '0xa046a8660e66d178ee07ec97c585eeb6aa18c26c',
    // AnkETH: '0xF7260D4ADc48fEefd5a19a9Eb23f9747CeE15C92',
    // DAI: '0x0f4ee9631f4be0a63756515141281a3e2b293bbe',
    // FRAX: '0x183d0dc5867c01bfb1dbbc41d6a9d3de6e044626',
    // BAL: '0x7514f531ef3721b8d2ff8d3a841d7c05011eecca',
    // WISE: '0x25c315e0758beeab30ee048a4e2080e7084b64b3',
    // DDIM: '0x229cbd1955fee93ab6e7876c1b17f6d0b859e953',
    // DODO: '0x3e19d726ed435afd3a42967551426b3a47c0f5b7',
    // ADAI: '0x826c3064d4f5b9507152f5cb440ca9326e1ec8fa',
    // AWETH: '0xa433105e7396070a5e1fdd7e2b2338f1bfa0de68',
    // BUSD: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503',
    // INCH: '0x4ee7c0f5480eb1edd8902a5e8b991ed52992d5f5',
    // mUSD: '0x3aD1D5CFCF9169Da73C23D85d5f2Bf53bC9d39dF',
    // mBTC: '0x15A295e9BCFcF93a8721DCb9A19330fc59771271',
    // renBTC: '0xAaE0633E15200bc9C50d45cD762477D268E126BD',
    // tBTC: '0xC25099792E9349C7DD09759744ea681C7de2cb66',
    // HBTC: '0x52885fF60Cd7Ae081e0665968C457DdACF888C90',
    // GUSD: '0x5f65f7b609678448494De4C87521CdF6cEf1e932',
    // LINK: '0x98c63b7b319dfbdf3d811530f2ab9dfe4983af9d',
    // ADAIv1: '0x3021026e4ff227571a5a563ad19ea657c7027e59',
    // CETH: '0x712d0f306956a6a4b4f9319ad9b9de48c5345996',
    // CDAI: '0xab4ce310054a11328685ece1043211b68ba5d082',
    // EURS: '0xC1056Adeb61a01964Ea265cA95EffB7016f9Ed78',
    // EURT: '0x6914FC70fAC4caB20a8922E900C4BA57fEECf8E1',
    // CRV: '0x7a16fF8270133F063aAb6C9977183D9e72835428',
    // jEUR: '0x4f0CF2F63913524b85c1126AB7eE7957857f3482',
    // UST: '0xf16e9b0d03470827a95cdfd0cb8a8a3b46969b91',
  },
  [Network.POLYGON]: {
    MATIC: '0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245',
    DAI: '0x97F3A94B2cd2484E46Bc36ea668823F60b6cf137',
    WETH: '0xd3d176F7e4b43C70a68466949F6C64F06Ce75BB9',
    WMATIC: '0xFffbCD322cEace527C8ec6Da8de2461C6D9d4e6e',
    AMWMATIC: '0x730dfedff1e4f4ca2c02b3bfc5aa11ee7ad0872f',
    USDC: '0x06959153B974D0D5fDfd87D561db6d8d4FA0bb0B',
    MUST: '0x2f96197A9F1e8199cb20f5f406431BD37f39B0a5',
    AMDAI: '0xFA0DCe8280FCDf369a4cbFc1830d3302789307a6',
    mUSD: '0x5084f622cbDf1E22E473d66d97916524745B9b6e',
    USDT: '0xc5ed2333f8a2C351fCA35E5EBAdb2A82F5d254C3',
    WBTC: '0xdc9232e2df177d7a12fdff6ecbab114e2231198d',
    AMWETH: '0x6f1c28c40b5fed4fb546f85959ae2f7c16365cad',
    KNC: '0x41Af7fd16dFC29bdA8D8aAA4CeFfC0E8046992eC',
    jEUR: '0x4f15818dc2Ae5FA84D519D88Cb2CAAe9cd18EE6d',
  },
};
