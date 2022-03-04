import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import yargs from 'yargs';
import { paramCase } from 'change-case';

const dexFolderPath = path.resolve('src', 'dex');
const templateFolderPath = path.resolve('dex-template');
const dexNamePlaceholder = /{{DexName}}/g;

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readdirAsync = promisify(fs.readdir);
const mkdirAsync = promisify(fs.mkdir);

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

async function createFolder(newDexPath: string) {
  try {
    await mkdirAsync(newDexPath);
  } catch (e) {
    if (e.code === 'EEXIST') {
      throw new Error(
        `Dex folder ${
          newDexPath.split('/').slice(-1)[0]
        } already exists. Please provide original name`,
      );
    } else {
      throw e;
    }
  }
}

const dotTemplatePattern = /.template$/g;
function trimTemplateExtension(name: string) {
  return name.replace(dotTemplatePattern, '');
}

async function generateDexesFromTemplate(dexName: string, newDexPath: string) {
  const fileNames = await readdirAsync(templateFolderPath);

  for (const fileTemplateName of fileNames) {
    let fileName = trimTemplateExtension(fileTemplateName).replace(
      dexNamePlaceholder,
      dexName,
    );

    const fromPath = path.join(templateFolderPath, fileTemplateName);
    const toPath = path.join(newDexPath, fileName);

    const templateFileContent = await readFileAsync(fromPath, {
      encoding: 'utf8',
    });

    const newDexFileContent = templateFileContent.replace(
      dexNamePlaceholder,
      dexName,
    );

    await writeFileAsync(toPath, newDexFileContent);
  }
}

const main = async () => {
  const { name: argName } = argv;
  const dexName = paramCase(argName);
  const newDexPath = path.join(dexFolderPath, dexName);

  console.log(`Adding new Dex Integration for ${dexName}. Please wait...`);

  // Check if ABI provided for the contracts

  await createFolder(newDexPath);

  await generateDexesFromTemplate(dexName, newDexPath);
};

if (require.main === module)
  main().catch(error => {
    console.error(`${error}\nPlease retry...`);
  });
