// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title Forest Model Library
 * @notice Library containing data structures and functions for managing token within a forest-like structure.
 * @author Sirawit Techavanitch (sirawit_tec@live4.utcc.ac.th)
 */

library Forest {
    /**
     * @dev Structure representing a transaction.
     */
    struct Token {
        uint256 root;
        uint256 parent;
        uint256 value;
        uint96 level;
        address owner;
    }

    /**
     * @dev Structure representing a DAG.
     */
    struct DAG {
        mapping(address => uint256) nonces;
        mapping(uint256 => uint96) hierarchy;
        mapping(uint256 => Token) tokens;
    }

    /** @dev See {IERC8047.TokenCreated}*/
    event TokenCreated(uint256 indexed root, uint256 id, address indexed from);

    /** @dev See {IERC8047.TokenSpent} */
    event TokenSpent(uint256 indexed root, uint256 id, uint256 value);

    /**
     * @notice Error thrown when a transaction is unauthorized.
     */
    error TokenUnauthorized();

    /**
     * @notice Error thrown when trying to create a transaction with zero value.
     */
    error TokenZeroValue();

    error TokenInvalidReceiver(address receiver);

    /**
     * @notice Error thrown when the spending value exceeds the transaction value.
     * @param value The value of the transaction.
     * @param spend The amount being spent.
     */
    error TokenInsufficient(uint256 value, uint256 spend);

    /** @custom:function-private */
    function _createToken(DAG storage self, Token memory newToken, address spender) private returns (uint256 newId) {
        newId = calcTokenHash(spender, self.nonces[spender]);
        self.tokens[newId] = Token(newId, newToken.parent, newToken.value, newToken.level, newToken.owner);
        unchecked {
            self.nonces[spender]++;
        }

        emit TokenCreated(newId, newToken.root, spender);
    }

    /** @custom:function-internal */
    function contains(DAG storage self, uint256 id) internal view returns (bool) {
        return self.tokens[id].value != uint256(0);
    }

    /**
     * @notice Calculates a deterministic token hash using the account and nonce.
     * @param account The address for which to calculate the token hash.
     * @param nonce A unique counter for the account to ensure uniqueness.
     * @return A uint256 hash representing the token ID.
     */
    function calcTokenHash(address account, uint256 nonce) internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.chainid, account, nonce)));
    }

    /**
     * @notice Retrieves a token from the DAG by its ID.
     * @param self The DAG storage reference.
     * @param id The token ID to retrieve.
     * @return The Token struct corresponding to the given ID.
     */
    function getToken(DAG storage self, uint256 id) internal view returns (Token memory) {
        return self.tokens[id];
    }

    /**
     * @notice Retrieves the level of a token within its DAG hierarchy.
     * @param self The DAG storage reference.
     * @param id The token ID.
     * @return The hierarchy level of the token.
     */
    function getTokenLevel(DAG storage self, uint256 id) internal view returns (uint256) {
        return self.tokens[id].level;
    }

    /**
     * @notice Retrieves the parent token ID of a given token.
     * @param self The DAG storage reference.
     * @param id The token ID.
     * @return The ID of the parent token. Returns 0 if the token is a root.
     */
    function getTokenParent(DAG storage self, uint256 id) internal view returns (uint256) {
        return self.tokens[id].parent;
    }

    /**
     * @notice Retrieves the root token ID of a given token.
     * @param self The DAG storage reference.
     * @param id The token ID.
     * @return The root token ID.
     */
    function getTokenRoot(DAG storage self, uint256 id) internal view returns (uint256) {
        return self.tokens[id].root;
    }

    /**
     * @notice Retrieves the current value of a token.
     * @param self The DAG storage reference.
     * @param id The token ID.
     * @return The token's value.
     */
    function getTokenValue(DAG storage self, uint256 id) internal view returns (uint256) {
        return self.tokens[id].value;
    }

    /**
     * @notice Retrieves the number of tokens issued to a given account.
     * @param self The DAG storage reference.
     * @param account The address to query.
     * @return The count of tokens associated with the account.
     */
    function getTokenCount(DAG storage self, address account) internal view returns (uint256) {
        return self.nonces[account];
    }

    /**
     * @notice Retrieves the hierarchy information for a given token.
     * @param self The DAG storage reference.
     * @param id The token ID.
     * @return The hierarchy level or identifier of the token in the DAG.
     */
    function getTokenHierarchy(DAG storage self, uint256 id) internal view returns (uint256) {
        return self.hierarchy[id];
    }

    /**
     * @notice Retrieves the owner of a token.
     * @param self The DAG storage reference.
     * @param id The token ID.
     * @return The address of the token owner.
     */
    function getTokenOwner(DAG storage self, uint256 id) internal view returns (address) {
        return self.tokens[id].owner;
    }

    /**
     * @notice Creates a new token in the DAG.
     * @param self The DAG storage reference.
     * @param newToken The Token struct containing token properties.
     * @param spender The address initiating the creation of the token.
     * @return The newly created token's ID.
     * @dev Reverts if the token value is zero or the owner is the zero address.
     */
    function createToken(DAG storage self, Token memory newToken, address spender) internal returns (uint256) {
        if (newToken.value == 0) revert TokenZeroValue();
        if (newToken.owner == address(0)) revert TokenInvalidReceiver(address(0));
        return _createToken(self, newToken, spender);
    }

    /**
     * @notice Spends a specified value from an existing token, creating a new child token for the recipient.
     * @param self The DAG storage reference containing all tokens and hierarchy.
     * @param id The ID of the token to spend from.
     * @param spender The address initiating the spend operation. Must be the owner of the token.
     * @param to The recipient address for the new child token. If zero address, no new token is minted.
     * @param value The amount of the token to spend. Must be greater than zero and less than or equal to the current token's value.
     * @return newId The ID of the newly created child token. Returns 0 if no new token is minted (i.e., `to` is zero address).
     */
    function spendToken(
        DAG storage self,
        uint256 id,
        address spender,
        address to,
        uint256 value
    ) internal returns (uint256 newId) {
        Token storage ptr = self.tokens[id];
        if (spender != ptr.owner) revert TokenUnauthorized();
        uint256 currentValue = ptr.value;
        if (value == 0 || value > currentValue) revert TokenInsufficient(currentValue, value);
        uint256 currentRoot = ptr.root;
        unchecked {
            ptr.value = currentValue - value;
            uint96 newLevel = (ptr.level + 1);
            if (to != address(0)) {
                newId = _createToken(self, Token(currentRoot, id, value, newLevel, to), spender);
                if (newLevel > self.hierarchy[currentRoot]) {
                    self.hierarchy[currentRoot] = newLevel;
                }
            }
        }

        emit TokenSpent(currentRoot, id, value);
    }
}
