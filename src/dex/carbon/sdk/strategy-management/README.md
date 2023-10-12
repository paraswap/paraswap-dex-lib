# Strategy Management Toolkit

The Strategy Management Toolkit is a utility that simplifies interactions with an on-chain trading system in token resolution. It provides users with an easy-to-use interface for creating, updating, and deleting strategies, as well as querying strategy-related information.

## Overview

This toolkit is designed to help users interact with the trading system in a more intuitive way. It wraps complex operations and calculations in a user-friendly API, allowing developers to focus on building their applications without worrying about the low-level details of trading strategy management.

## Features

- Create, update, and delete trading strategies
- Query strategy-related information such as rate liquidity depths, minimum and maximum rates for a token pair
- Automatically handle token decimals and normalize rates

## Usage

First, instantiate the `Toolkit` class by passing the required configuration options:

```js
import { Toolkit } from './path/to/toolkit';
const toolkit = new Toolkit(api, cache, decimals);
```

### Create a Buy/Sell Strategy

To create a new buy/sell strategy, call the `createBuySellStrategy` method with the required parameters:

```js
const populatedTransaction = await toolkit.createBuySellStrategy(
  baseToken,
  quoteToken,
  buyPriceLow,
  buyPriceHigh,
  buyBudget,
  sellPriceLow,
  sellPriceHigh,
  sellBudget,
  overrides,
);
```

### Update an Existing Strategy

To update an existing strategy, call the `updateStrategy` method with the necessary parameters:

```js
const populatedTransaction = await toolkit.updateStrategy(
  strategyId,
  encoded,
  {
    buyPriceLow,
    buyPriceHigh,
    buyBudget,
    sellPriceLow,
    sellPriceHigh,
    sellBudget,
  },
  buyMarginalPrice,
  sellMarginalPrice,
  overrides,
);
```

### Delete a Strategy

To delete a strategy, call the `deleteStrategy` method with the strategy ID:

javascriptCopy code

```js
const populatedTransaction = await toolkit.deleteStrategy(strategyId);
```
