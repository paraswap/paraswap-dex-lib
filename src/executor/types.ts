export enum Flag {
  FIFTEEN = 15,
  ELEVEN = 11,
  NINE = 9,
  EIGHT = 8,
  SEVEN = 7,
  FIVE = 5,
  FOUR = 4,
  THREE = 3,
  ZERO = 0,
}

export enum SpecialDex {
  DEFAULT = 0,
  // SWAP_ON_MAKER_PSM = 3, // swapOnMakerPSM
  SWAP_ON_SWAAP_V2_SINGLE = 1, // swapOnSwaapV2Single
  SEND_NATIVE = 4, // sendNative
  SWAP_ON_BALANCER_V2 = 5, // swapOnBalancerV2
  SWAP_ON_UNISWAP_V2_FORK = 6,
  SWAP_ON_DYSTOPIA_UNISWAP_V2_FORK = 7,
  SWAP_ON_DYSTOPIA_UNISWAP_V2_FORK_WITH_FEE = 8,
  SWAP_ON_AUGUSTUS_RFQ = 9, // swapOnAugustusRFQ
}

export enum Executors {
  ONE = 'Executor01',
  TWO = 'Executor02',
  THREE = 'Executor03',
}

export enum RouteExecutionType {
  SINGLE_STEP = 0, // simpleSwap with 100% on a path and single DEX
  HORIZONTAL_SEQUENCE = 1, // multiSwap with 100% on each path
  VERTICAL_BRANCH = 3, // simpleSwap with N DEXs on a path
  VERTICAL_BRANCH_HORIZONTAL_SEQUENCE = 4, // multiSwap, megaSwap
  // NESTED_VERTICAL_BRANCH_HORIZONTAL_SEQUENCE = 5, // megaSwap
}
