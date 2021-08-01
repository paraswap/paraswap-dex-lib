import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import yargs from 'yargs';
import axios from 'axios';
import { pascalCase, headerCase } from 'change-case';

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

interface Options {
  name: string;
  address: string;
}

const argv = yargs
  .command('dex:init', 'Fetch the contract abi and generate boilerplate file')
  .options({
    name: {
      description: 'Name of the DEX (or more generaly liquidity market)',
      type: 'string',
    },
    address: {
      description: 'Address of the DEX',
      type: 'string',
    },
  })
  .demandOption(
    ['name', 'address'],
    'Please provide both "name" and "address" arguments',
  )
  .help()
  .alias('help', 'h').argv;

interface EtherscanABIResponse {
  status: string;
  message: string;
  result: string;
}

const fetchAndStoreAbi = async ({ name, address }: Options): Promise<void> => {
  const abi = (
    await axios.get<EtherscanABIResponse>(
      `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}`,
    )
  ).data.result;

  await writeFileAsync(
    path.join(__dirname, '../src/abi/', `${pascalCase(name)}.json`),
    abi,
  );
};

const generateDexBoilerplateFiler = async ({ name }: Options) => {
  const dexFileTemplate = await readFileAsync(
    path.join(__dirname, './_TemplateDex_.ts.template'),
    { encoding: 'utf8' },
  );

  const dexFileContent = dexFileTemplate.replace(
    /_TemplateDex_/gi,
    pascalCase(name),
  );

  await writeFileAsync(
    path.join(__dirname, '../src/dex', `${headerCase(name).toLowerCase()}.ts`),
    dexFileContent,
  );
};

const main = async () => {
  const { name, address } = argv;

  console.log(`Adding new Dex Integration for ${name} - ${address}`);

  await Promise.all(
    [fetchAndStoreAbi, generateDexBoilerplateFiler].map(f => f(argv)),
  );
};

if (require.main === module)
  main().catch(error => {
    console.error(`Something went wrong.\n${error}\nPlease retry.`);
  });
