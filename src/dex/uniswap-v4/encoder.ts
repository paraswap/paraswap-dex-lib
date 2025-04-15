import { ethers } from 'ethers';
import { PoolKey } from './types';
import { Address } from '../../types';
import RouterAbi from '../../abi/uniswap-v4/router.abi.json';
import { Interface } from '@ethersproject/abi';
import { isETHAddress } from '../../utils';
import { NULL_ADDRESS } from '../../constants';

const routerIface = new Interface(RouterAbi);

enum Commands {
  V4_SWAP = 16, // 0x10 -> 16
}

export enum Actions {
  // Swapping
  SWAP_EXACT_IN_SINGLE = 6, // 0x06 -> 6
  SWAP_EXACT_IN = 7, // 0x07 -> 7
  SWAP_EXACT_OUT_SINGLE = 8, // 0x08 -> 8
  SWAP_EXACT_OUT = 9, // 0x09 -> 9

  // Settling (paying funds)
  SETTLE = 11, // 0x0b -> 11
  SETTLE_ALL = 12, // 0x0c -> 12
  SETTLE_PAIR = 13, // 0x0d -> 13

  // Taking (receiving funds)
  TAKE = 14, // 0x0e -> 14
  TAKE_ALL = 15, // 0x0f -> 15
  TAKE_PORTION = 16, // 0x10 -> 16
  TAKE_PAIR = 17, // 0x11 -> 17
}

enum ActionConstants {
  OPEN_DELTA = 0,
  // This value is equivalent to 1<<255, i.e. a singular 1 in the most significant bit.
  CONTRACT_BALANCE = '57896044618658097711785492504343953926634992332820282019728792003956564819968',
  // address(1)
  MSG_SENDER = '0x0000000000000000000000000000000000000001',
  // address(2)
  ADDRESS_THIS = '0x0000000000000000000000000000000000000002',
}

interface ExactInputSingleParams {
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
  hookData: string;
}

export function swapExactInputSingleCalldata(
  srcToken: Address,
  destToken: Address,
  poolKey: PoolKey,
  zeroForOne: boolean,
  amountIn: bigint,
  amountOutMinimum: bigint,
  recipient: Address,
): string {
  const command = ethers.utils.solidityPack(['uint8'], [Commands.V4_SWAP]);

  const actions = ethers.utils.solidityPack(
    ['uint8', 'uint8', 'uint8'],
    [Actions.SWAP_EXACT_IN_SINGLE, Actions.SETTLE, Actions.TAKE],
  );

  const exactInputSingleParams: ExactInputSingleParams = {
    poolKey,
    zeroForOne,
    amountIn,
    amountOutMinimum,
    hookData: '0x', // empty bytes
  };

  // encode SWAP_EXACT_IN_SINGLE
  const swap = ethers.utils.defaultAbiCoder.encode(
    [
      /*
         ExactInputSingleParams {
            PoolKey poolKey;
            bool zeroForOne;
            uint128 amountIn;
            uint128 amountOutMinimum;
            bytes hookData;
         }
      */
      'tuple((address,address,uint24,int24,address) poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData)',
    ],
    [
      [
        [
          poolKey.currency0,
          poolKey.currency1,
          poolKey.fee,
          poolKey.tickSpacing,
          poolKey.hooks,
        ],
        exactInputSingleParams.zeroForOne,
        exactInputSingleParams.amountIn,
        exactInputSingleParams.amountOutMinimum,
        exactInputSingleParams.hookData,
      ],
    ],
  );

  // encode SETTLE
  const settle = ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256', 'bool'],
    // srcToken, amountIn (`OPEN_DELTA` to settle all needed funds), takeFundsFromMsgSender (Executor in our case)
    [
      isETHAddress(srcToken) ? NULL_ADDRESS : srcToken,
      ActionConstants.OPEN_DELTA,
      true,
    ],
  );

  // encode TAKE
  const take = ethers.utils.defaultAbiCoder.encode(
    ['address', 'address', 'uint256'],
    // destToken, recipient, amountOut (`OPEN_DELTA` to take all funds)
    [
      isETHAddress(destToken) ? NULL_ADDRESS : destToken,
      recipient,
      ActionConstants.OPEN_DELTA,
    ],
  );

  const input = ethers.utils.defaultAbiCoder.encode(
    ['bytes', 'bytes[]'],
    [actions, [swap, settle, take]],
  );

  return routerIface.encodeFunctionData('execute(bytes,bytes[])', [
    command,
    [input],
  ]);
}

interface ExactOutputSingleParams {
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountOut: bigint;
  amountInMaximum: bigint;
  hookData: string;
}

export function swapExactOutputSingleCalldata(
  srcToken: Address,
  destToken: Address,
  poolKey: PoolKey,
  zeroForOne: boolean,
  amountOut: bigint,
  recipient: Address,
): string {
  const command = ethers.utils.solidityPack(['uint8'], [Commands.V4_SWAP]);

  const actions = ethers.utils.solidityPack(
    ['uint8', 'uint8', 'uint8'],
    [Actions.SWAP_EXACT_OUT_SINGLE, Actions.SETTLE, Actions.TAKE],
  );

  const MAX_UINT128 = 340282366920938463463374607431768211455n;

  const exactOutputSingleParams: ExactOutputSingleParams = {
    poolKey,
    zeroForOne,
    amountOut,
    amountInMaximum: MAX_UINT128,
    hookData: '0x', // empty bytes
  };

  // encode SWAP_EXACT_OUTPUT_SINGLE
  const swap = ethers.utils.defaultAbiCoder.encode(
    [
      /*
        ExactOutputSingleParams {
          PoolKey poolKey;
          bool zeroForOne;
          uint128 amountOut;
          uint128 amountInMaximum;
          bytes hookData;
        }
      */
      'tuple((address,address,uint24,int24,address) poolKey, bool zeroForOne, uint128 amountOut, uint128 amountInMaximum, bytes hookData)',
    ],
    [
      [
        [
          poolKey.currency0,
          poolKey.currency1,
          poolKey.fee,
          poolKey.tickSpacing,
          poolKey.hooks,
        ],
        exactOutputSingleParams.zeroForOne,
        exactOutputSingleParams.amountOut,
        exactOutputSingleParams.amountInMaximum,
        exactOutputSingleParams.hookData,
      ],
    ],
  );

  // encode SETTLE
  const settle = ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256', 'bool'],
    // destToken, amountIn (`OPEN_DELTA` to settle all needed funds), takeFundsFromMsgSender (Executor in our case)
    [
      isETHAddress(srcToken) ? NULL_ADDRESS : srcToken,
      ActionConstants.OPEN_DELTA,
      true,
    ],
  );

  // encode TAKE
  const take = ethers.utils.defaultAbiCoder.encode(
    ['address', 'address', 'uint256'],
    // srcToken, recipient, amountOut (`OPEN_DELTA` to take all funds)
    [isETHAddress(destToken) ? NULL_ADDRESS : destToken, recipient, amountOut],
  );

  const input = ethers.utils.defaultAbiCoder.encode(
    ['bytes', 'bytes[]'],
    [actions, [swap, settle, take]],
  );

  return routerIface.encodeFunctionData('execute(bytes,bytes[])', [
    command,
    [input],
  ]);
}
