import { AssetType, DEFAULT_ID_ERC20_AS_STRING, UserBalance } from './types';
import {
  addressDecode,
  booleanDecode,
  getAllowanceERC20,
  getApprovedERC721,
  getBalanceERC1155,
  getBalanceERC20,
  getBalanceERC721,
  isApprovedForAllERC1155,
  isApprovedForAllERC721,
  uintDecode,
} from './utils';

import { Network } from '../../constants';
import { MultiCallParams, MultiResult, MultiWrapper } from '../multi-wrapper';

export type TokenIdRequest = {
  id: bigint;
  spenders: string[];
};

export type BalanceRequest = {
  owner: string;
  asset: string;
  assetType: AssetType;
  ids: TokenIdRequest[];
};

export type MultiCallParamsType = bigint | string | boolean;

type MultiCallResultDecodeInfo = {
  calls: MultiCallParams<MultiCallParamsType>[];
  spenders: Set<string>;
  length: number;
};

export const getBalanceCallParams = (
  req: BalanceRequest,
): MultiCallParams<MultiCallParamsType>[] => {
  switch (req.assetType) {
    case AssetType.ERC20:
      return [
        {
          target: req.asset,
          callData: getBalanceERC20(req.owner),
          decodeFunction: uintDecode,
        },
      ];
    case AssetType.ERC721:
      return req.ids.map(id => ({
        target: req.asset,
        callData: getBalanceERC721(id.id),
        decodeFunction: addressDecode,
      }));
    case AssetType.ERC1155:
      return req.ids.map(id => ({
        target: req.asset,
        callData: getBalanceERC1155(req.owner, id.id), // TODO: use batch
        decodeFunction: uintDecode,
      }));
    default:
      throw new Error(`missing case for assetType ${req.assetType}`);
      return [];
  }
};

export const getAllowanceCallParams = (
  req: BalanceRequest,
): MultiCallResultDecodeInfo => {
  switch (req.assetType) {
    case AssetType.ERC20: {
      const { spenders } = req.ids[0];
      const calls = spenders.map(spender => ({
        target: req.asset,
        callData: getAllowanceERC20(req.owner, spender),
        decodeFunction: uintDecode,
      }));
      const spendersSet = new Set<string>([...spenders]);
      return {
        calls,
        spenders: spendersSet,
        length: spendersSet.size,
      };
    }
    case AssetType.ERC721: {
      const allSpenders = new Set<string>();
      const approved = req.ids.reduce<MultiCallParams<MultiCallParamsType>[]>(
        (acc, id) => {
          acc.push({
            target: req.asset,
            callData: getApprovedERC721(id.id),
            decodeFunction: addressDecode,
          });
          id.spenders.forEach(spender => {
            allSpenders.add(spender);
          });
          return acc;
        },
        [],
      );

      const spenders = Array.from(allSpenders);
      const approvedForAll = spenders.map(spender => ({
        target: req.asset,
        callData: isApprovedForAllERC721(req.owner, spender),
        decodeFunction: booleanDecode,
      }));

      approved.push(...approvedForAll);
      return {
        calls: approved,
        spenders: allSpenders,
        length: approved.length,
      };
    }
    case AssetType.ERC1155: {
      const spendersSet = new Set<string>();
      req.ids.forEach(id => {
        id.spenders.forEach(spender => {
          spendersSet.add(spender);
        });
      });

      const calls = [];
      for (const spender of spendersSet.values()) {
        calls.push({
          target: req.asset,
          callData: isApprovedForAllERC1155(req.owner, spender),
          decodeFunction: booleanDecode,
        });
      }
      return {
        calls,
        spenders: spendersSet,
        length: spendersSet.size,
      };
    }
    default:
      throw new Error(`missing case for assetType ${req.assetType}`);
      return {
        calls: [],
        spenders: new Set(),
        length: 0,
      };
  }
};

export const decodeBalanceAndAllowanceMultiResult = (
  req: BalanceRequest,
  spenders: Set<string>,
  results: MultiResult<MultiCallParamsType>[],
) => {
  const userBalance: UserBalance = {
    owner: req.owner,
    asset: req.asset,
    assetType: req.assetType,
    amounts: {},
    allowances: {},
  };

  for (const id of req.ids) {
    for (const spender of spenders) {
      userBalance.allowances[id.id.toString()] = {
        [spender]: 0n,
      };
    }
  }
  switch (req.assetType) {
    case AssetType.ERC20: {
      userBalance.amounts = {
        [DEFAULT_ID_ERC20_AS_STRING]: results[0].returnData as bigint,
      };
      let i = 1;
      for (const spender of spenders) {
        const allowance = userBalance.allowances[DEFAULT_ID_ERC20_AS_STRING];
        if (!allowance) {
          userBalance.allowances[DEFAULT_ID_ERC20_AS_STRING] = {};
        }
        userBalance.allowances[DEFAULT_ID_ERC20_AS_STRING][spender] = results[i]
          .returnData as bigint;
        ++i;
      }
      break;
    }
    case AssetType.ERC721: {
      /* eslint-disable-next-line */
      for (let i = 0; i < req.ids.length; ++i) {
        userBalance.amounts[req.ids[i].id.toString()] =
          results[i].returnData === req.owner ? 1n : 0n;
      }
      let offset = req.ids.length;
      /* eslint-disable-next-line */
      for (let i = 0; i < req.ids.length; ++i) {
        const approved = results[i + offset].returnData as string;
        const idAsString = req.ids[i].id.toString();
        if (spenders.has(approved)) {
          const allowance = userBalance.allowances[idAsString];
          if (!allowance) {
            userBalance.allowances[idAsString] = {};
          }
          userBalance.allowances[idAsString][approved] = 1n;
        }
      }
      offset += req.ids.length;
      const ids = Object.keys(userBalance.amounts);
      for (const spender of spenders) {
        const res = results[offset].returnData;
        for (const id of ids) {
          const allowance = userBalance.allowances[id];
          if (allowance && allowance[spender] === 1n) {
            continue;
          }
          userBalance.allowances[id] = {
            [spender]: res ? 1n : 0n,
          };
        }
      }
      break;
    }
    case AssetType.ERC1155: {
      for (let j = 0; j < req.ids.length; ++j) {
        userBalance.amounts[req.ids[j].id.toString()] = results[j]
          .returnData as bigint;
      }
      let offset = req.ids.length;
      for (const spender of spenders) {
        const approved = results[offset].returnData as boolean;
        for (const id of req.ids) {
          const idAsString = id.id.toString();
          if (approved) {
            userBalance.allowances[idAsString][spender] =
              userBalance.amounts[idAsString];
          }
        }
        ++offset;
      }
      break;
    }
    default:
      throw new Error(`missing case for assetType ${req.assetType}`);
  }

  return userBalance;
};

export const getBalances = async (
  multiv2: MultiWrapper,
  reqs: BalanceRequest[],
): Promise<UserBalance[]> => {
  const calls: MultiCallParams<MultiCallParamsType>[] = []; // TODO: compute the size on advance

  const decodingInfo: MultiCallResultDecodeInfo[] = [];
  for (const req of reqs) {
    const balancesCalls = getBalanceCallParams(req);
    calls.push(...balancesCalls);
    const params = getAllowanceCallParams(req);
    calls.push(...params.calls);
    params.length += balancesCalls.length;
    decodingInfo.push(params);
  }
  const results = await multiv2.tryAggregate<MultiCallParamsType>(
    false,
    calls,
    'latest',
  );

  const chuncks = [];
  let j = 0;
  for (let i = 0; i < results.length; ) {
    const batchSize = decodingInfo[j].length;
    const chunck = results.slice(i, i + batchSize);
    chuncks.push(chunck);
    j++;
    i += batchSize;
  }

  return chuncks.map((chunck, index) =>
    decodeBalanceAndAllowanceMultiResult(
      reqs[index],
      decodingInfo[index].spenders,
      chunck,
    ),
  );
};
