# Contracts API

The `contracts-api` subfolder contains utility classes for interacting with blockchain contracts related to trading, strategies, and token pairs. The main classes included in this subfolder are:

1.  `ContractsApi`
2.  `Reader`
3.  `Composer`

## ContractsApi

`ContractsApi` is responsible for initializing the `Reader` and `Composer` classes using the provided `provider` and `config`. It exposes the `reader` and `composer` properties for further interaction with the contracts.

## Reader

`Reader` is a utility class that provides methods to read data from the contracts, such as strategies, token pairs, and events. It handles multicall requests and provides various utility functions to retrieve information about tokens and strategies.

## Composer

`Composer` is a utility class that provides methods to interact with contracts by composing and populating transactions for trade and strategy management. It handles trade actions by target amount, trade actions by source amount, and strategy creation, deletion, and updating.
