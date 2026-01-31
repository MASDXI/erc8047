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

/** constant of ERC-8047 tokenId first minting to alice address */
export const tokenId = toBigInt("0x8D365C3BD8D1435FF808CFB3B71755E0EBE2DAF0323D5B431762A1905FC7739E");
// EF4D81D393152A50ECF4BAA6DBEDB8AE5E044AE171275A0703FF3BA46BFBF802
