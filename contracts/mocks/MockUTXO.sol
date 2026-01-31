// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "../abstracts/UTXOToken.sol";
import "../policies/FreezeAddress.sol";
import "../policies/FreezePartialTokens.sol";
import "../policies/FreezeToken.sol";

contract MockUTXO is UTXOToken, FreezeAddress, FreezePartialTokens, FreezeToken {
    constructor(string memory name_, string memory symbol_) UTXOToken(name_, symbol_) {}

    function transfer(
        address to,
        bytes32 txnId,
        uint256 value,
        bytes memory signature
    )
        public
        virtual
        override
        checkFrozenBalance(msg.sender, balanceOf(msg.sender))
        checkFrozenAddress(msg.sender, to)
        checkFrozenToken(txnId)
        returns (bool)
    {
        bytes32 extraData = transactionExtraData(txnId);
        if (extraData == bytes32("")) {
            extraData = txnId;
        }
        _transfer(msg.sender, to, txnId, value, signature, extraData);

        return true;
    }

    function transferFrom(
        address from,
        address to,
        bytes32 txnId,
        uint256 value,
        bytes memory signature
    )
        public
        virtual
        override
        checkFrozenBalance(from, balanceOf(from))
        checkFrozenAddress(from, to)
        checkFrozenToken(txnId)
        returns (bool)
    {
        _spendAllowance(from, msg.sender, value);
        bytes32 extraData = transactionExtraData(txnId);
        if (extraData == bytes32("")) {
            extraData = txnId;
        }
        _transfer(from, to, txnId, value, signature, extraData);

        return true;
    }

    function mint(address account, uint256 value) public {
        _mintTransaction(account, value, bytes32(""));
    }

    function burn(address account, bytes32 txnId, uint256 value) public {
        bytes32 extraData = transactionExtraData(txnId);
        if (extraData == bytes32("")) {
            extraData = txnId;
        }
        _burnTransaction(account, txnId, value, extraData);
    }
}
