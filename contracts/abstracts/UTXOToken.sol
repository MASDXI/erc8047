// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import {UnspentTransactionOutput as UTXO} from "../libraries/UTXO.sol";
import {IUTXO} from "../interfaces/IUTXO.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title UTXO Token Contract
 * @dev This contract extends ERC20 functionality to manage tokens using Unspent Transaction Output (UTXO) model.
 * It provides methods to handle token transactions using UTXO data structures.
 * Implements the IUTXO interface.
 */

abstract contract UTXOToken is ERC20, IUTXO {
    /** @custom:library */
    using UTXO for UTXO.UTXO;

    /** @custom:storage */
    UTXO.UTXO private _UTXO;

    /** @custom:constructor */
    /**
     * @dev Constructor to initialize the ERC20 token with a name and symbol.
     * @param name_ The name of the token.
     * @param symbol_ The symbol of the token.
     */
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /** @custom:function-internal */
    /**
     * @dev Internal function to fetch a transaction details based on the token ID.
     * @param txnId The identifier of the token transaction.
     * @return A `Transaction` structure containing transaction details.
     */
    function _transaction(bytes32 txnId) internal view returns (UTXO.Txn memory) {
        return _UTXO.transaction(txnId);
    }

    /**
     * @dev Internal function to execute a token transfer using an UTXO-based approach.
     * @param from The sender address.
     * @param to The recipient address.
     * @param txnId The identifier of the token transaction.
     * @param value The amount of tokens to transfer.
     * @param signature The signature associated with the transaction.
     * @param extraData The extra data for transaction output.
     */
    function _transfer(
        address from,
        address to,
        bytes32 txnId,
        uint256 value,
        bytes memory signature,
        bytes32 extraData
    ) internal virtual {
        uint256 txnValue = _UTXO.getTxnValue(txnId);
        if (txnValue < value) {
            revert UTXO.TransactionInsufficient(txnValue, value);
        }
        _UTXO.spendTxn(UTXO.TxnInput(txnId, signature), from);
        txnValue = txnValue - value;
        if (txnValue != 0) {
            _UTXO.createTxn(UTXO.TxnOutput(value, to), txnId, from, extraData);
        }
        // update account-based balance
        _update(from, to, value);
    }

    /**
     * @dev Internal function to mint tokens and create a transaction for the minted tokens.
     * @param account The address that will receive the minted tokens.
     * @param value The amount of tokens to mint and transfer.
     * @param extraData The extra data for transaction output.
     */
    function _mintTransaction(address account, uint256 value, bytes32 extraData) internal {
        _UTXO.createTxn(UTXO.TxnOutput(value, account), bytes32(0), address(0), extraData);
        // update account-based balance
        _mint(account, value);
    }

    /**
     * @dev Internal function to burn tokens and handle the corresponding UTXO transaction.
     * @param account The address from which tokens will be burned.
     * @param txnId The identifier of the token transaction to be burned.
     * @param value The amount of tokens to burn.
     * @param extraData The extra data for transaction output.
     */
    function _burnTransaction(address account, bytes32 txnId, uint256 value, bytes32 extraData) internal {
        uint256 txnValue = _UTXO.getTxnValue(txnId);
        if (txnValue < value) {
            revert UTXO.TransactionInsufficient(txnValue, value);
        }
        txnValue = txnValue - value;
        _UTXO.consumeTxn(txnId);
        if (txnValue != 0) {
            _UTXO.createTxn(UTXO.TxnOutput(value, account), txnId, account, extraData);
        }
        // update account-based balance
        _burn(account, value);
    }

    /** @custom:function-public */
    /**
     * @dev Function to fetch a transaction details based on the token ID.
     * @param txnId The identifier of the token transaction.
     * @return A `Transaction` structure containing transaction details.
     */
    function transaction(bytes32 txnId) public view returns (UTXO.Txn memory) {
        return _transaction(txnId);
    }

    /**
     * @dev Function to the value of a UTXO transaction identified by its token ID.
     * @param txnId The identifier of the UTXO transaction.
     * @return The value of the UTXO associated with the specified token ID.
     */
    function transactionValue(bytes32 txnId) public view returns (uint256) {
        return _UTXO.getTxnValue(txnId);
    }

    /**
     * @dev Function to fetch the input of a UTXO transaction identified by its token ID.
     * @param txnId The identifier of the UTXO transaction.
     * @return The input associated with the specified UTXO token ID.
     */
    function transactionInput(bytes32 txnId) public view returns (bytes32) {
        return _UTXO.getTxnInput(txnId);
    }

    /**
     * @dev Function to fetch the owner of a UTXO transaction identified by its token ID.
     * @param txnId The identifier of the UTXO transaction.
     * @return The address of the owner of the UTXO associated with the specified token ID.
     */
    function transactionOwner(bytes32 txnId) public view returns (address) {
        return _UTXO.getTxnOwner(txnId);
    }

    /**
     * @dev Function to fetch the extra data of a UTXO transaction identified by its token ID.
     * @param txnId The identifier of the UTXO transaction.
     * @return The extra data of the UTXO associated with the specified token ID.
     */
    function transactionExtraData(bytes32 txnId) public view returns (bytes32) {
        return _UTXO.getTxnExtraData(txnId);
    }

    /**
     * @dev Function to checks whether a UTXO transaction has been spent, identified by its token ID.
     * @param txnId The identifier of the UTXO transaction.
     * @return True if the UTXO associated with the specified token ID has been spent, false otherwise.
     */
    function transactionSpent(bytes32 txnId) public view returns (bool) {
        return _UTXO.getTxnSpent(txnId);
    }

    /** @dev See {IUTXO.transfer}. */
    function transfer(
        address to,
        bytes32 txnId,
        uint256 value,
        bytes memory signature
    ) public virtual override returns (bool) {
        _transfer(msg.sender, to, txnId, value, signature, bytes32(""));
        return true;
    }

    /** @dev See {IUTXO.transferFrom}. */
    function transferFrom(
        address from,
        address to,
        bytes32 txnId,
        uint256 value,
        bytes memory signature
    ) public virtual override returns (bool) {
        _spendAllowance(from, msg.sender, value);
        _transfer(from, to, txnId, value, signature, bytes32(""));
        return true;
    }

    /**
     * @dev Use {IUTXO.transferFrom} instead.
     * @notice UTXO are not support account-based transfers.
     * @custom:override Always reverts with ERC20TransferNotSupported error.
     */
    function transfer(address to, uint256 value) public virtual override returns (bool) {
        revert ERC20TransferNotSupported();
    }

    /**
     * @dev Use {IUTXO.transferFrom} instead.
     * @notice UTXO are not support account-based transfers.
     * @custom:override Always reverts with ERC20TransferFromNotSupported error.
     */
    function transferFrom(address from, address to, uint256 value) public virtual override returns (bool) {
        revert ERC20TransferFromNotSupported();
    }
}
