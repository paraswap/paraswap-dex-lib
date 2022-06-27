import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';

import { Network } from '../../constants';
import { DummyDexHelper } from '../../../src/dex-helper';
import SynthetixReadProxyAddressResolverABI from '../../abi/synthetix/ProxyAddressResolver.json';
import EtherWrapperABI from '../../abi/synthetix/EtherWrapper.json';
import ExchangerABI from '../../abi/synthetix/Exchanger.json';

/**
 * @dev These types are non-exhaustive
 */
type SynthetixAddressResolver = {
  getAddress: (name: string) => string;
};

type Synth = {
  currencyKey: () => string;
};

type Exchanger = {
  getAmountsForAtomicExchange: (
    sourceAmount: BigNumber,
    sourceCurrencyKey: string,
    destinationCurrencyKey: string,
  ) => any;
  exchangeAtomically: (
    sourceCurrencyKey: string,
    sourceAmount: BigNumber,
    destinationCurrencyKey: string,
    destinationAddress: string,
    trackingCode: string,
    minAmount: BigNumber,
  ) => BigNumber;
};

function toHex(arg: string) {
  return ethers.utils.hexlify(arg);
}

const dexKey = 'Synthetix';
const network = Network.MAINNET;

const PROXY_ADDRESS_RESOLVER = '0x4E3b31eB0E5CB73641EE1E65E7dCEFe520bA3ef2';
const EXCHANGER_ADDRESS = '0xD64D83829D92B5bdA881f6f61A4e4E27Fc185387';

/**
 * @dev Integration tests
 */
describe('Synthetix', () => {
  it('first simple test: atomic swap AAVE for ETH', async () => {
    let resolver, // : SynthetixAddressResolver
      exchanger; // : Exchanger

    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const sourceAmount = ethers.BigNumber.from('10');
    const sourceCurrencyKey = 'AAVE';
    const destinationCurrencyKey = 'ETH';

    // I want to do something like this
    resolver = new ethers.Contract(
      PROXY_ADDRESS_RESOLVER,
      SynthetixReadProxyAddressResolverABI,
    ); //  as SynthetixAddressResolver

    exchanger = new ethers.Contract(EXCHANGER_ADDRESS, ExchangerABI); // as Exchanger

    resolver = resolver.deployed();
    exchanger = exchanger.deployed();

    const aaveAddress = resolver.getAddress(toHex('ProxysAAVE'));
    const ethAddress = resolver.getAddress(toHex('ProxysETH'));

    const { amountReceived, fee, exchangeFeeRate } =
      exchanger.getAmountsForAtomicExchange(
        sourceAmount,
        sourceCurrencyKey,
        destinationCurrencyKey,
      );

    expect(amountReceived).toBe(sourceAmount.mul(exchangeFeeRate));
  });
});
