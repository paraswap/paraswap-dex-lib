/* eslint-disable no-console */
import { ethers } from 'ethers';
import { PoolPrices, PoolLiquidity, Address } from '../src/types';
import { SwapSide } from '../src/constants';
import { assert } from 'ts-essentials';

// Assuming that the amounts are increasing at same interval, and start with 0
export function checkPoolPrices(
  poolPrices: PoolPrices<any>[],
  amounts: bigint[],
  side: SwapSide,
  dexKey: string,
  expectIncreasingValues: boolean = true,
) {
  for (const poolPrice of poolPrices) {
    expect(poolPrice.prices.length).toBe(amounts.length);
    expect(poolPrice.prices[0]).toEqual(0n);

    poolPrice.prices.forEach(p => expect(p).toBeGreaterThanOrEqual(0));
    expect(poolPrice.unit).toBeGreaterThanOrEqual(0);

    if (expectIncreasingValues) {
      for (let i = 2; i < poolPrice.prices.length; ++i) {
        const prevMarginalPrice =
          poolPrice.prices[i - 1] - poolPrice.prices[i - 2];
        const currMarginalPrice = poolPrice.prices[i] - poolPrice.prices[i - 1];

        //This check has 1% fudge factor to avoid slight differences causing error
        if (side === SwapSide.SELL)
          expect((currMarginalPrice * 99n) / 100n).toBeLessThanOrEqual(
            prevMarginalPrice,
          );
        else
          expect((currMarginalPrice * 101n) / 100n).toBeGreaterThan(
            prevMarginalPrice,
          );
      }
    }

    expect(poolPrice.exchange).toEqual(dexKey);
  }
}

export function checkConstantPoolPrices(
  poolPrices: PoolPrices<any>[],
  amounts: bigint[],
  dexKey: string,
) {
  for (const poolPrice of poolPrices) {
    expect(poolPrice.exchange).toEqual(dexKey);
    expect(poolPrice.prices.length).toEqual(amounts.length);
    for (let i = 0; i < poolPrice.prices.length; ++i) {
      expect(poolPrice.prices[i]).toEqual(amounts[i]);
    }
  }
}

export function checkPoolsLiquidity(
  poolsLiquidity: PoolLiquidity[],
  tokenAddress: Address,
  dexKey: string,
) {
  expect(poolsLiquidity.length).toBeGreaterThan(0);

  poolsLiquidity.forEach(p => {
    expect(p.exchange).toEqual(dexKey);
    expect(p.liquidityUSD).toBeGreaterThanOrEqual(0);
    p.connectorTokens.forEach(t => {
      expect(t.address).not.toBe(tokenAddress);
      expect(t.decimals).toBeGreaterThanOrEqual(0);
    });
  });
}

export const sleep = (time: number) =>
  new Promise(resolve => {
    setTimeout(resolve, time);
  });

export const generateDeployBytecode = (
  testContractProjectRootPath: string | undefined,
  testContractName: string | undefined,
  testContractConfigFileName: string | undefined,
  testContractRelativePath: string | undefined,
  testContractDeployArgs: string | undefined,
  testContractType: string | undefined,
): string => {
  if (
    !testContractProjectRootPath ||
    !testContractName ||
    !testContractConfigFileName ||
    !testContractRelativePath ||
    !testContractDeployArgs ||
    !testContractType
  ) {
    return '';
  }

  const artifactJsonPath = `${testContractProjectRootPath}/artifacts/${testContractName}.json`;
  const configJsonPath = `${testContractProjectRootPath}/config/${testContractConfigFileName}.json`;
  const fieldsToPickFromConfig = testContractDeployArgs.split(',');

  const artifact = require(artifactJsonPath) as {
    abi: ethers.ContractInterface;
    bytecode: string;
  };
  // I don't want to type this testing thing. If something is wrong, I will just throw
  const config = require(configJsonPath) as any;
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode);

  const args = fieldsToPickFromConfig.map(f => {
    const value = config[f];
    if (value === undefined) {
      console.log(
        `Field ${f} is not defined in configJsonPath=${configJsonPath}. Using value as it is`,
      );
      return f;
    }
    return value;
  });

  const deployedBytecode = factory.getDeployTransaction(...args).data;

  assert(deployedBytecode !== undefined, 'deployedBytecode is undefined');

  return deployedBytecode.toString();
};
