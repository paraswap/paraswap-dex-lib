# README

This folder contains the implementation of a blockchain data synchronization system. It fetches data from the blockchain using a Fetcher instance and stores the fetched data in a local cache managed by a ChainCache instance. The main purpose of this system is to keep the local cache up-to-date with the blockchain data and efficiently handle updates.

## Files and Types

1.  `ChainSync.ts`: This file defines the `ChainSync` class, which is responsible for synchronizing data from the blockchain with a local cache. The class uses a Fetcher instance to fetch data from the blockchain and a ChainCache instance to store and manage the fetched data. It contains public and private methods for starting the data synchronization, processing token pairs, and handling events from the blockchain.
2.  `Fetcher`: The `Fetcher` is an interface of the contracts Reader, which is responsible for fetching data from the blockchain. It contains methods for fetching block numbers, token pairs, trading fees, strategies, and events related to strategies and token trades.
3.  `ChainCache.ts`: This file defines the `ChainCache` class, which is responsible for managing the local cache of the blockchain data. It contains methods for adding, updating, and deleting data in the cache, as well as methods for querying the cache.
4.  `utils.ts`: This file contains utility functions that are used by the other classes in this folder. These utility functions include helpers for handling arrays, generating unique keys for token pairs, and other general-purpose functions.
5.  `types.ts`: This file contains the type definitions for the data structures used in the system, such as `TokenPair`, `EncodedStrategy`, and `TradeData`.

To use this system, you need to create instances of the `Fetcher` and `ChainCache` classes and pass them to the constructor of the `ChainSync` class. Then, you can call the `startDataSync()` method of the `ChainSync` instance to start the synchronization process.
