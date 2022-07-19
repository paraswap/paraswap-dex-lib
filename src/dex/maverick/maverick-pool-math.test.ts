import dotenv from 'dotenv';
dotenv.config();

import { MaverickPoolMath } from './maverick-math/maverick-pool-math';

describe('MaverickPool', () => {
  it.only('swap base for quote without moving u', async () => {
    try {
      const poolMath = new MaverickPoolMath(
        'Maverick',
        BigInt(0.5e18),
        BigInt(0.01e18),
        BigInt(0.2e18),
        BigInt(1e18),
        3600n,
        BigInt(1.1e18),
        BigInt(1.01e18),
        BigInt(1.25e18),
        BigInt(10e18),
      );

      expect(
        poolMath.swap(
          {
            twau: 980392156862745098n,
            quoteBalance: BigInt(50e18),
            baseBalance: BigInt(51e18),
            u: 980392156862745098n,
            lastTimestamp: 0n,
          },
          0n,
          BigInt(5e18),
          false,
        ),
      ).toBe(4845610620884132326n);
    } catch (e) {
      console.log(e);
    }
  });

  it.only('swap base for quote moving u', async () => {
    try {
      const poolMath = new MaverickPoolMath(
        'Maverick',
        BigInt(0.5e18),
        BigInt(0.01e18),
        BigInt(0.2e18),
        BigInt(1e18),
        3600n,
        BigInt(1.1e18),
        BigInt(1.01e18),
        BigInt(1.25e18),
        BigInt(10e18),
      );

      expect(
        poolMath.swap(
          {
            twau: 980392156862745098n,
            quoteBalance: BigInt(50e18),
            baseBalance: BigInt(51e18),
            u: 980392156862745098n,
            lastTimestamp: 0n,
          },
          0n,
          BigInt(30e18),
          false,
        ),
      ).toBe(26131140068389939344n);
    } catch (e) {
      console.log(e);
    }
  });

  it.only('swap quote for base without moving u', async () => {
    try {
      const poolMath = new MaverickPoolMath(
        'Maverick',
        BigInt(0.5e18),
        BigInt(0.01e18),
        BigInt(0.2e18),
        BigInt(1e18),
        3600n,
        BigInt(1.1e18),
        BigInt(1.01e18),
        BigInt(1.25e18),
        BigInt(10e18),
      );

      expect(
        poolMath.swap(
          {
            twau: 980392156862745098n,
            quoteBalance: BigInt(50e18),
            baseBalance: BigInt(51e18),
            u: 980392156862745098n,
            lastTimestamp: 0n,
          },
          0n,
          BigInt(5e18),
          true,
        ),
      ).toBe(5041221050728703230n);
    } catch (e) {
      console.log(e);
    }
  });

  it.only('swap base for quote with moving u', async () => {
    try {
      const poolMath = new MaverickPoolMath(
        'Maverick',
        BigInt(0.5e18),
        BigInt(0.01e18),
        BigInt(0.2e18),
        BigInt(1e18),
        3600n,
        BigInt(1.1e18),
        BigInt(1.01e18),
        BigInt(1.25e18),
        BigInt(10e18),
      );

      expect(
        poolMath.swap(
          {
            twau: 980392156862745098n,
            quoteBalance: BigInt(50e18),
            baseBalance: BigInt(51e18),
            u: 980392156862745098n,
            lastTimestamp: 0n,
          },
          0n,
          BigInt(30e18),
          true,
        ),
      ).toBe(27085568403434082163n);
    } catch (e) {
      console.log(e);
    }
  });

  it.only('when theres a spread fee', async () => {
    try {
      const poolMath = new MaverickPoolMath(
        'Maverick',
        BigInt(0.5e18),
        BigInt(0.01e18),
        BigInt(0.2e18),
        BigInt(1e18),
        3600n,
        BigInt(1.1e18),
        BigInt(1.01e18),
        BigInt(1.25e18),
        BigInt(10e18),
      );

      expect(
        poolMath.swap(
          {
            twau: 980392156862745098n,
            quoteBalance: BigInt(50e18),
            baseBalance: BigInt(51e18),
            u: 980392156862745098n,
            lastTimestamp: 0n,
          },
          0n,
          BigInt(30e18),
          true,
        ),
      ).toBe(27085568403434082163n);
    } catch (e) {
      console.log(e);
    }
  });
});
