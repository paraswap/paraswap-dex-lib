import { Interface } from '@ethersproject/abi';
import { Address, OptimalRate } from '@paraswap/core';
import { ConfigHelper } from '../../config';
import { CACHE_PREFIX, Network } from '../../constants';
import { ICache } from '../../dex-helper';
import { bytes3ToString } from '../../lib/decoders';
import { MultiWrapper, MultiCallParams } from '../../lib/multi-wrapper';
import UncompressorABI from '../../abi/Uncompressor.json';
import compress, { AddressesMapping } from './compress';
import { pickBy } from 'lodash';

const DEFAULT_SAVED_ADDRESS_CACHE_KEY_VALUE = 'true';

// key = token_uncomporessAddress_network
// key = token

export class Compressor {
  uncomporessorInterface: Interface;

  private cache: ICache;

  private readonly cacheSavedAddressesKey: string;

  constructor(
    protected network: Network,
    protected uncompressorAddress: Address,
    protected augustusV6Address: Address,
    cache: ICache,
    protected multiWrapper: MultiWrapper,
  ) {
    this.uncomporessorInterface = new Interface(UncompressorABI);
    this.cache = cache;

    this.cacheSavedAddressesKey = `${CACHE_PREFIX}_compressed_addresses`;
  }

  async compress(
    bytecode: string,
    priceRoute: OptimalRate,
    executorAddress: Address,
  ): Promise<string> {
    const addressesToCompress = this.detectRouteAddresses(priceRoute);

    addressesToCompress.push(this.augustusV6Address);
    addressesToCompress.push(executorAddress);

    let addressesMapping: AddressesMapping = {};

    addressesToCompress.forEach(address => {
      addressesMapping[address.toLowerCase()] = { saved: false, index: -1 };
    });

    addressesMapping = await this.getSavedAddresses(addressesMapping);

    const allAddressesCached = Object.values(addressesMapping).every(
      approval => approval.saved === true,
    );

    if (allAddressesCached) {
      return compress({
        initialCallData: bytecode,
        addresses: addressesMapping,
      }).compressedData;
    }

    addressesMapping = await this.addOnChainSavedAddress(addressesMapping);

    return compress({
      initialCallData: bytecode,
      addresses: addressesMapping,
    }).compressedData;
  }

  private detectRouteAddresses(priceRoute: OptimalRate): Address[] {
    const addresses = new Set<string>();

    addresses.add(priceRoute.srcToken);
    addresses.add(priceRoute.destToken);

    for (const route of priceRoute.bestRoute) {
      for (const swap of route.swaps) {
        addresses.add(swap.srcToken);
        addresses.add(swap.destToken);

        for (const swapExchange of swap.swapExchanges) {
          // the most common fields
          if (swapExchange.data.router) addresses.add(swapExchange.data.router);
          if (swapExchange.data.factory)
            addresses.add(swapExchange.data.factory);

          if (swapExchange.poolAddresses) {
            swapExchange.poolAddresses.forEach(address =>
              addresses.add(address),
            );
          }
        }
      }
    }

    return Array.from(addresses);
  }

  private async setSavedAddresses(
    addressesMapping: AddressesMapping,
  ): Promise<void> {
    const addresses = this.filterKeys(addressesMapping, true);
    if (addresses.length === 0) return;

    const mappings = Object.fromEntries(
      addresses.map(key => [
        this.createCacheKey(key),
        addressesMapping[key].index.toString(),
      ]),
    );

    await this.cache.hmset(this.cacheSavedAddressesKey, mappings);
  }

  private async getSavedAddresses(
    addressesMapping: AddressesMapping,
  ): Promise<AddressesMapping> {
    const addresses = Object.keys(addressesMapping);
    if (addresses.length === 0) return addressesMapping;

    const savedAddresses = await this.cache.hmget(
      this.cacheSavedAddressesKey,
      addresses.map(key => this.createCacheKey(key)),
    );

    savedAddresses.forEach((index, i) => {
      const indexNum = index !== null ? Number(index) : -1;

      addressesMapping[addresses[i]] = {
        saved: index !== null,
        index: indexNum,
      };
    });

    return addressesMapping;
  }

  private async addOnChainSavedAddress(addressesMapping: AddressesMapping) {
    const newAddresses = this.filterKeys(addressesMapping, false);
    if (newAddresses.length === 0) return addressesMapping;

    const onChainSavedAddresses = await this.getSavedAddressesOnChain(
      newAddresses,
    );

    const needUpdate = !!pickBy(onChainSavedAddresses, v => v.saved);

    if (needUpdate) {
      const setNewAddressesInCache: AddressesMapping = {};

      Object.entries(onChainSavedAddresses).forEach(
        ([address, { saved, index }]) => {
          if (saved) {
            addressesMapping[address] = { saved, index };
            setNewAddressesInCache[address] = { saved, index };
          }
        },
      );

      await this.setSavedAddresses(setNewAddressesInCache);
    }

    return addressesMapping;
  }

  private async getSavedAddressesOnChain(
    addresses: string[],
  ): Promise<AddressesMapping> {
    const callData: MultiCallParams<string>[] = addresses.map(address => ({
      target: this.uncompressorAddress,
      callData: this.uncomporessorInterface.encodeFunctionData(
        'addressToByte',
        [address],
      ),
      decodeFunction: bytes3ToString,
    }));

    const isAddressesSaved = await this.multiWrapper.tryAggregate<string>(
      false,
      callData,
    );

    const entries = isAddressesSaved.map((addressResult, i) => {
      const savedOnchain = addressResult.success
        ? addressResult.returnData !== '0x000000'
        : false;

      const index = savedOnchain ? parseInt(addressResult.returnData, 16) : -1;

      return [
        addresses[i],
        {
          saved: savedOnchain,
          index,
        },
      ];
    });

    return Object.fromEntries(entries);
  }

  private createCacheKey(token: Address): string {
    return `${token}_${this.uncompressorAddress}_${this.network}`;
  }

  private filterKeys(addressesMapping: AddressesMapping, saved = false) {
    return Object.entries(addressesMapping)
      .filter(([, app]) => app.saved === saved)
      .map(([key]) => key);
  }
}
