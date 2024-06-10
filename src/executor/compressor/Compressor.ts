import { Interface } from '@ethersproject/abi';
import { Address, OptimalRate } from '@paraswap/core';
import { ConfigHelper } from '../../config';
import { CACHE_PREFIX, Network } from '../../constants';
import { ICache } from '../../dex-helper';
import { bytes3ToString } from '../../lib/decoders';
import { MultiWrapper, MultiCallParams } from '../../lib/multi-wrapper';
import UncompressorABI from '../../abi/Uncompressor.json';
import compress from './compress';

const DEFAULT_SAVED_ADDRESS_CACHE_KEY_VALUE = 'true';

// key = token_uncomporessAddress_network
// key = token
type SavedAddressesMapping = Record<string, boolean>;

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

    let addressesMapping: Record<string, boolean> = {};

    addressesToCompress.forEach(address => {
      // todo: handle null address which is already added with 0 index
      addressesMapping[address.toLowerCase()] = false;
    });

    addressesMapping = await this.getSavedAddresses(addressesMapping);

    const cachedAddresses = Object.values(addressesMapping);
    if (cachedAddresses.every(approval => approval === true)) {
      return compress({
        initialCallData: bytecode,
        savedAddresses: Object.keys(addressesMapping),
        newAddresses: [],
      }).compressedData;
    }

    addressesMapping = await this.addOnChainSavedAddress(addressesMapping);

    return compress({
      initialCallData: bytecode,
      savedAddresses: this.filterKeys(addressesMapping, true),
      newAddresses: this.filterKeys(addressesMapping, false),
      // savedAddresses: [],
      // newAddresses: [],
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
    addressesMapping: SavedAddressesMapping,
  ): Promise<void> {
    const addresses = this.filterKeys(addressesMapping, true);
    if (addresses.length === 0) return;

    const mappings = Object.fromEntries(
      addresses.map(key => [
        this.createCacheKey(key),
        DEFAULT_SAVED_ADDRESS_CACHE_KEY_VALUE,
      ]),
    );

    await this.cache.hmset(this.cacheSavedAddressesKey, mappings);
  }

  private async getSavedAddresses(
    addressesMapping: SavedAddressesMapping,
  ): Promise<SavedAddressesMapping> {
    const addresses = this.filterKeys(addressesMapping);
    if (addresses.length === 0) return addressesMapping;

    const savedAddresses = await this.cache.hmget(
      this.cacheSavedAddressesKey,
      addresses.map(key => this.createCacheKey(key)),
    );

    savedAddresses.forEach((saved, index) => {
      if (saved !== null) {
        addressesMapping[addresses[index]] = true;
      }
    });

    return addressesMapping;
  }

  private async addOnChainSavedAddress(
    addressesMapping: SavedAddressesMapping,
  ) {
    const addresses = this.filterKeys(addressesMapping);
    if (addresses.length === 0) return addressesMapping;

    const onChainSavedAddresses = await this.getSavedAddressesOnChain(
      addresses,
    );

    if (onChainSavedAddresses.includes(true)) {
      const setNewAddressesInCache: Record<string, boolean> = {};
      onChainSavedAddresses.forEach((saved, index) => {
        if (saved) {
          addressesMapping[addresses[index]] = true;
          setNewAddressesInCache[addresses[index]] = true;
        }
      });

      await this.setSavedAddresses(setNewAddressesInCache);
    }

    return addressesMapping;
  }

  private async getSavedAddressesOnChain(
    addresses: string[],
  ): Promise<boolean[]> {
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

    return isAddressesSaved.map(addressResult =>
      addressResult.success ? addressResult.returnData !== '0x000000' : false,
    );
  }

  private createCacheKey(token: Address): string {
    return `${token}_${this.uncompressorAddress}_${this.network}`;
  }

  private filterKeys(addressesMapping: SavedAddressesMapping, saved = false) {
    return Object.entries(addressesMapping)
      .filter(([key, app]) => app === saved)
      .map(([key]) => key);
  }
}
