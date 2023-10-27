import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { checkConstantPoolPrices } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';
import { PolygonMigrator } from './polygon-migrator';

const network = Network.MAINNET;

const MaticSymbol = 'MATIC';
const MaticToken = Tokens[network][MaticSymbol];

const PolSymbol = 'POL';
const PolToken = Tokens[network][PolSymbol];

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'PolygonMigrator';

describe('PolygonMigrator', function () {
  it('getPoolIdentifiers and getPricesVolume MATIC -> POL SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const polygonMigrator = new PolygonMigrator(network, dexKey, dexHelper);

    const pools = await polygonMigrator.getPoolIdentifiers(
      MaticToken,
      PolToken,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${MaticSymbol} <> ${PolSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await polygonMigrator.getPricesVolume(
      MaticToken,
      PolToken,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${MaticSymbol} <> ${PolSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume POL -> MATIC SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const polygonMigrator = new PolygonMigrator(network, dexKey, dexHelper);

    const pools = await polygonMigrator.getPoolIdentifiers(
      PolToken,
      MaticToken,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${PolSymbol} <> ${MaticSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await polygonMigrator.getPricesVolume(
      PolToken,
      MaticToken,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${PolSymbol} <> ${MaticSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume MATIC -> POL BUY', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const polygonMigrator = new PolygonMigrator(network, dexKey, dexHelper);

    const pools = await polygonMigrator.getPoolIdentifiers(
      MaticToken,
      PolToken,
      SwapSide.BUY,
      blocknumber,
    );
    console.log(`${MaticSymbol} <> ${PolSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await polygonMigrator.getPricesVolume(
      MaticToken,
      PolToken,
      amounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log(`${MaticSymbol} <> ${PolSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume POL -> MATIC BUY', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const polygonMigrator = new PolygonMigrator(network, dexKey, dexHelper);

    const pools = await polygonMigrator.getPoolIdentifiers(
      PolToken,
      MaticToken,
      SwapSide.BUY,
      blocknumber,
    );
    console.log(`${PolSymbol} <> ${MaticSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await polygonMigrator.getPricesVolume(
      PolToken,
      MaticToken,
      amounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log(`${PolSymbol} <> ${MaticSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  });

});
