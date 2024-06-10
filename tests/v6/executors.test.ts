import dotenv from 'dotenv';
dotenv.config();

import { OptimalRate } from '@paraswap/core';
import {
  ContractsAugustusV6,
  runE2ETest as runForkE2ETest,
} from './utils-e2e-v6';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Holders, Tokens } from '../constants-e2e';

jest.setTimeout(1000 * 120);

type ForkMetadata = {
  forkId: string;
  lastTx: string;
  blockNumber: number;
  network: number;
  contracts: ContractsAugustusV6;
};

const forceNewDeployment = false;
// const network = 'polygon';
// const network = 'arbitrum';
// const network = 'avalanche';
const network = 'mainnet';

async function deployAugustusOnFork(
  network: number,
  blockNumber: number,
): Promise<ForkMetadata> {
  console.log(
    `Locally deploying fork for block ${blockNumber} with AugustusV6 contracts`,
  );
  const { data } = await axios.post<ForkMetadata>(
    // local server from contracts-v6
    `http://localhost:3000/deploy-fork`,
    {
      network,
      blockNumber,
      forceNewDeployment,
    },
  );
  return data;
}

describe('Executors: Price Route Tests', () => {
  // Dynamically load and test each price route file in the directory
  const routePath = `./price-routes/${network}`;
  const priceRoutesDir = path.join(__dirname, routePath);
  const priceRouteFiles = fs.readdirSync(priceRoutesDir);

  priceRouteFiles.forEach(file => {
    if (file === 'balancer-v2-2.test.json')
      it(`file: ${file}`, async () => {
        const {
          priceRoute,
          metadata,
        }: {
          priceRoute: OptimalRate;
          metadata: ForkMetadata;
        } = require(path.join(priceRoutesDir, file));
        let forkMetadata: ForkMetadata = metadata;
        if (!forkMetadata?.contracts || forceNewDeployment) {
          forkMetadata = await deployAugustusOnFork(
            priceRoute.network,
            priceRoute.blockNumber,
          );
          saveForkMetadata(
            forkMetadata,
            priceRoute as OptimalRate,
            `${routePath}/${file}`,
          );
        }

        const srcTokenSymbol = Object.entries(Tokens[priceRoute.network]).find(
          ([key, token]) =>
            token.address.toLowerCase() === priceRoute.srcToken.toLowerCase(),
        )?.[0];

        if (!srcTokenSymbol) throw new Error('srcTokenSymbol not found');

        await runForkE2ETest(
          priceRoute as OptimalRate,
          Holders[priceRoute.network][srcTokenSymbol],
          forkMetadata.forkId,
          forkMetadata.lastTx,
          forkMetadata.contracts,
        );
      });
  });
});

function saveForkMetadata(
  metadata: ForkMetadata,
  priceRoute: OptimalRate,
  relativeFilePath: string,
) {
  try {
    const absoluteFilePath = path.join(__dirname, relativeFilePath);
    fs.writeFileSync(
      absoluteFilePath,
      JSON.stringify({ metadata, priceRoute }, null, 2),
    );
  } catch (err) {
    console.error(`Error writing file to disk: ${err}`);
  }
}
