import {toBigInt} from "ethers";

/** constant of contract name */
export const CONTRACT_NAME = {
  ERC20: "MockERC20",
  ERC8047: "MockERC8047",
  UTXO: "MockUTXO",
};

/** constant of token metadata */
export const TOKEN_METADATA = {
  NAME: "mock",
  SYMBOL: "mock",
  URI: "mock://uri/",
};

/** constant of token amount */
export const amount = 1000n;

/** constant of partial token amount */
export const partialAmount = 500n;

/** constant of frozen token amount */
export const frozenAmount = 100n;

/** constant of transfer function */
export const transfer = {
  utxo: "transfer(address,bytes32,uint256,bytes)",
  forest: "transfer(address,bytes32,uint256)",
};

/** constant of transferFrom function */
export const transferFrom = {
  utxo: "transferFrom(address,address,bytes32,uint256,bytes)",
  forest: "transferFrom(address,address,bytes32,uint256)",
};
