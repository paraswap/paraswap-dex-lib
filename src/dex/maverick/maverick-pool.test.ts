import dotenv from 'dotenv';
dotenv.config();

import { MaverickPool } from './maverick-pool';

describe('MaverickPool', () => {
  it('swap base for quote without moving u', async () => {
    const pool = new MaverickPool(
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
      pool.swap(
        {
          twau: 980392156862745098n,
          quoteBalance: BigInt(50e18),
          baseBalance: BigInt(51e18),
          u: 980392156862745098n,
          lastTimestamp: 0n,
        },
        BigInt(5e18),
        false,
      ),
    ).toBe(4845610620884132434n);
  });

  it('swap base for quote moving u', async () => {
    const pool = new MaverickPool(
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
      pool.swap(
        {
          twau: 980392156862745098n,
          quoteBalance: BigInt(50e18),
          baseBalance: BigInt(51e18),
          u: 980392156862745098n,
          lastTimestamp: 0n,
        },
        BigInt(30e18),
        false,
      ),
    ).toBe(26131140068389811476n);
  });

  it('swap base for quote without moving u', async () => {
    const pool = new MaverickPool(
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
      pool.swap(
        {
          twau: 980392156862745098n,
          quoteBalance: BigInt(50e18),
          baseBalance: BigInt(51e18),
          u: 980392156862745098n,
          lastTimestamp: 0n,
        },
        BigInt(5e18),
        true,
      ),
    ).toBe(5041221050728703107n);
  });

  it('swap base for quote with moving u', async () => {
    const pool = new MaverickPool(
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
      pool.swap(
        {
          twau: 980392156862745098n,
          quoteBalance: BigInt(50e18),
          baseBalance: BigInt(51e18),
          u: 980392156862745098n,
          lastTimestamp: 0n,
        },
        BigInt(30e18),
        true,
      ),
    ).toBe(27085568403433706801n);
  });
});
