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
  // SWAP_ON_BALANCER_V2 = 1, // swapOnBalancerV2
  // SWAP_ON_MAKER_PSM = 2, // swapOnMakerPSM
  // SWAP_ON_SWAAP_V2 = 3, // swapOnSwaapV2
  SEND_NATIVE = 4, // sendNative
}

export enum Executors {
  ONE = 'Executor01',
  TWO = 'Executor02',
}

export enum RouteExecutionType {
  SINGLE_STEP = 0, // simpleSwap with 100% on a path and single DEX
  HORIZONTAL_SEQUENCE = 1, // multiSwap with 100% on each path
  VERTICAL_BRANCH = 3, // simpleSwap with N DEXs on a path
  VERTICAL_BRANCH_HORIZONTAL_SEQUENCE = 4, // multiSwap, megaSwap
  // NESTED_VERTICAL_BRANCH_HORIZONTAL_SEQUENCE = 5, // megaSwap
}
