import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import yargs from 'yargs';
import { pascalCase, camelCase } from 'change-case';

const dexFolderPath = path.resolve('src', 'dex');
const templateFolderPath = path.resolve('dex-template');

const dexNamePlaceholder = /__DexName__/g;
const dexNameCamelPlaceholder = /__DexNameCamel__/g;
const dexNameParamPlaceholder = /__DexNameParam__/g;
const dexNameConstantPlaceholder = /__DexNameConstant__/g;

const paramCasePattern = /^[a-z0-9\-]+$/g;

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readdirAsync = promisify(fs.readdir);
const mkdirAsync = promisify(fs.mkdir);

interface IOptions {
  name: string;
}

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

async function generateDexesFromTemplate(
  dexNameParam: string,
  newDexPath: string,
) {
  const spaceSplitted = dexNameParam.replace(/-/g, ' ');
  const dexNamePascal = pascalCase(spaceSplitted);
  const dexNameCamel = camelCase(spaceSplitted);
  const dexNameConstant = dexNameParam.replace(/-/g, '_').toUpperCase();

  const fileNames = await readdirAsync(templateFolderPath);

  for (const fileTemplateName of fileNames) {
    let fileName = trimTemplateExtension(fileTemplateName).replace(
      dexNamePlaceholder,
      dexNameParam,
    );

    const fromPath = path.join(templateFolderPath, fileTemplateName);
    const toPath = path.join(newDexPath, fileName);

    const templateFileContent = await readFileAsync(fromPath, {
      encoding: 'utf8',
    });

    const newDexFileContent = templateFileContent
      .replace(dexNamePlaceholder, dexNamePascal)
      .replace(dexNameCamelPlaceholder, dexNameCamel)
      .replace(dexNameParamPlaceholder, dexNameParam)
      .replace(dexNameConstantPlaceholder, dexNameConstant);

    await writeFileAsync(toPath, newDexFileContent);
  }
}

function checkArgvName(argv: IOptions) {
  const { name: dexNameParam } = argv;
  if (dexNameParam === undefined) {
    throw new Error('You must specify dex name as the first argument');
  }

  if (!paramCasePattern.test(dexNameParam)) {
    throw new Error(
      `You should provide name in params case. Only allowed to use "a-z", "0-9" and "-" without spaces. Received: ${dexNameParam}`,
    );
  }

  return dexNameParam;
}

async function initIntegration(argv: IOptions) {
  const dexNameParam = checkArgvName(argv);

  const newDexPath = path.join(dexFolderPath, dexNameParam);

  console.log(`Adding new Dex Integration for ${dexNameParam}. Please wait...`);

  await createFolder(newDexPath);
  console.log(`Folder ${dexNameParam} is created`);
  await generateDexesFromTemplate(dexNameParam, newDexPath);
  console.log(`New dex ${dexNameParam} is integrated`);
}

function testIntegration(argv: IOptions) {
  const dexNameParam = checkArgvName(argv);

  const importLocal = require('import-local');

  if (!importLocal(__filename)) {
    if (process.env.NODE_ENV == null) {
      process.env.NODE_ENV = 'test';
    }

    require('../node_modules/jest-cli/build/cli').run(
      `src\/dex\/${dexNameParam}\/.+\.test\.ts`,
    );
  }
}

yargs
  .scriptName('dex-integration.ts')
  .usage('$0 <cmd> [args]')
  .command(
    'init [name]',
    'Integrate new dex by the "name" from templates',
    yargsLocal => {
      yargsLocal.positional('name', {
        type: 'string',
        describe:
          'Name of the new dex. Must be in param cases using only "a-z", "0-9", and "-" without spaces',
      });
    },
    function (argv: { name: string }) {
      initIntegration(argv).catch(error => {
        console.error(`${error}\nPlease retry...`);
      });
    },
  )
  .command(
    'test [name]',
    'Execute all tests for particular dex accessing by it\'s "name"',
    yargsLocal => {
      yargsLocal.positional('name', {
        type: 'string',
        describe: 'Name of the dex to test',
      });
    },
    function (argv) {
      testIntegration(argv);
    },
  )
  .help()
  .alias('help', 'h')
  .showHelpOnFail(true)
  .demandCommand().argv;
