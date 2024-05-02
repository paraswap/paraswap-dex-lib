import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { checkConstantPoolPrices } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';
import { SDai } from './sdai';

const network = Network.MAINNET;

const SDaiSymbol = 'sDAI';
const SDaiToken = Tokens[network][SDaiSymbol];

const DaiSymbol = 'DAI';
const DaiToken = Tokens[network][DaiSymbol];

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'SDai';

describe('SDai', function () {});
