import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import yargs from 'yargs';
// import axios from 'axios';
import { pascalCase, headerCase, paramCase } from 'change-case';

const dexFolder = path.resolve('src', 'dex');
const templateFolder = path.resolve('dex-template');
const dexNamePattern = /{{[^{}]*}}/g;
const dotTemplatePattern = /.template$/g;

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

interface InitOptions {
  name: string;
}

const argv = yargs
  .command('init-integration', 'Integrate new dex by the "name" from templates')
  .options({
    name: {
      description: 'Name of the Dex to create',
      type: 'string',
    },
  })
  .demandOption(['name'], 'Please provide "name" argument')
  .help()
  .alias('help', 'h').argv;

// const fetchAndStoreAbi = async ({ name }: InitOptions): Promise<void> => {
//   if (!address) return;

//   const abi = (
//     await axios.get<EtherscanABIResponse>(
//       `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}`,
//     )
//   ).data.result;

//   await writeFileAsync(
//     path.join(__dirname, '../src/abi/', `${pascalCase(name)}.json`),
//     abi,
//   );
// };

async function generateDexBoilerplateFiler({ name }: InitOptions) {
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
}

function isFolderExists(name: string) {
  fs.readdir(dexFolder, (err, files) => {
    if (err) {
      throw err;
    }

    for (const fileTemplate of files) {
      let file = fileTemplate
        .replace(dexNamePattern, name)
        .replace(dotTemplatePattern, '');

      const fromPath = path.join(templateFolder, fileTemplate);
      const toPath = path.join(dexFolder, file);
    }
  });
}

const main = async () => {
  const { name: argName } = argv;
  const name = paramCase(argName);

  console.log(`Adding new Dex Integration for ${name}. Please wait...`);

  console.log({ name });
  console.log(dexFolder);
  console.log(templateFolder);

  if (isFolderExists(name)) {
    throw new Error('Dex folder already exists. Please provide original name');
  }

  fs.readdir(templateFolder, (err, files) => {
    if (err) {
      console.error('Could not list the directory.', err);
      process.exit(1);
    }

    for (const fileTemplate of files) {
      let file = fileTemplate
        .replace(dexNamePattern, name)
        .replace(dotTemplatePattern, '');

      const fromPath = path.join(templateFolder, fileTemplate);
      const toPath = path.join(dexFolder, file);
    }
  });

  const dexFileTemplate = await readFileAsync(
    path.join(__dirname, './_TemplateDex_.ts.template'),
    { encoding: 'utf8' },
  );

  // Check if ABI provided for the contracts

  // Check the folder exists

  // await Promise.all(
  //   [fetchAndStoreAbi, generateDexBoilerplateFiler].map(f => f(argv)),
  // );
};

if (require.main === module)
  main().catch(error => {
    console.error(`Error: ${error}\nPlease retry...`);
  });
