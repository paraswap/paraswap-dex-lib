export enum AssetType {
  ERC20 = 0,
  ERC1155 = 1,
  ERC721 = 2,
}

export const DEFAULT_ID_ERC20 = 0n;
export const DEFAULT_ID_ERC20_AS_STRING = DEFAULT_ID_ERC20.toString();

export type UserBalance = {
  owner: string;
  asset: string;
  assetType: AssetType;
  amounts: Record<string, bigint>; // tokenId as string to amount
  allowances: Record<string, Record<string, bigint>>; // tokenId to spender to amount
};

export enum ERC20Event {
  Transfer = 'Transfer',
  Approval = 'Approval',
}

export type ERC20Transfer = {
  from: string;
  to: string;
  value: bigint;
};

export type ERC20Approval = {
  owner: string;
  spender: string;
  value: bigint;
};

export enum WETHEvent {
  Transfer = 'Transfer',
  Approval = 'Approval',
  Deposit = 'Deposit',
  Withdrawal = 'Withdrawal',
}

export type WETHDeposit = {
  dst: string;
  wad: bigint;
};

export type WETHWithdrawal = {
  src: string;
  wad: bigint;
};

export enum ERC721Event {
  Transfer = 'Transfer',
  Approval = 'Approval',
  ApprovalForAll = 'ApprovalForAll',
}

export type ERC721Transfer = {
  from: string;
  to: string;
  tokenId: bigint;
};

export type ERC721Approval = {
  owner: string;
  spender: string;
  tokenId: bigint;
};

export type ERC721ApprovalForAll = {
  owner: string;
  spender: string;
  approved: boolean;
};

export enum ERC1155Event {
  TransferSingle = 'TransferSingle',
  TransferBatch = 'TransferBatch',
  ApprovalForAll = 'ApprovalForAll',
}

export type ERC1155TransferSingle = {
  operator: string;
  from: string;
  to: string;
  id: bigint;
  value: bigint;
};

export type ERC1155TransferBatch = {
  operator: string;
  from: string;
  to: string;
  ids: bigint[];
  values: bigint[];
};

export type ERC1155ApprovalForAll = {
  owner: string;
  operator: string;
  approved: boolean;
};
