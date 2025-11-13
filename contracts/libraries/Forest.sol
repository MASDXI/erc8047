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
    event TokenCreated(uint256 indexed root, uint256 tokenId, address indexed from);

    /** @dev See {IERC8047.TokenSpent} */
    event TokenSpent(uint256 indexed root, uint256 tokenId, uint256 value);

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
    function contains(DAG storage self, uint256 tokenId) internal view returns (bool) {
        return self.tokens[tokenId].value != uint256(0);
    }

    /** */
    function calcTokenHash(address account, uint256 nonce) internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.chainid, account, nonce)));
    }

    /** */
    function getToken(DAG storage self, uint256 tokenId) internal view returns (Token memory) {
        return self.tokens[tokenId];
    }

    /** */
    function getTokenLevel(DAG storage self, uint256 tokenId) internal view returns (uint256) {
        return self.tokens[tokenId].level;
    }

    /** */
    function getTokenParent(DAG storage self, uint256 tokenId) internal view returns (uint256) {
        return self.tokens[tokenId].parent;
    }

    /** */
    function getTokenRoot(DAG storage self, uint256 tokenId) internal view returns (uint256) {
        return self.tokens[tokenId].root;
    }

    /** */
    function getTokenValue(DAG storage self, uint256 tokenId) internal view returns (uint256) {
        return self.tokens[tokenId].value;
    }

    /** */
    function getTokenCount(DAG storage self, address account) internal view returns (uint256) {
        return self.nonces[account];
    }

    /** */
    function getTokenHierarchy(DAG storage self, uint256 tokenId) internal view returns (uint256) {
        return self.hierarchy[tokenId];
    }

    /** */
    function getTokenOwner(DAG storage self, uint256 tokenId) internal view returns (address) {
        return self.tokens[tokenId].owner;
    }

    /** */
    function createToken(DAG storage self, Token memory newToken, address spender) internal returns (uint256) {
        if (newToken.value == 0) revert TokenZeroValue();
        if (newToken.owner == address(0)) revert TokenInvalidReceiver(address(0));
        return _createToken(self, newToken, spender);
    }

    /** */
    function spendToken(DAG storage self, uint256 tokenId, address spender, address to, uint256 value) internal {
        Token storage ptr = self.tokens[tokenId];
        if (spender != ptr.owner) revert TokenUnauthorized();
        uint256 currentValue = ptr.value;
        if (value == 0 || value > currentValue) revert TokenInsufficient(currentValue, value);
        uint256 currentRoot = ptr.root;
        unchecked {
            ptr.value = currentValue - value;
            uint96 newLevel = (ptr.level + 1);
            if (to != address(0)) {
                _createToken(self, Token(currentRoot, tokenId, value, newLevel, to), spender);
                if (newLevel > self.hierarchy[currentRoot]) {
                    self.hierarchy[currentRoot] = newLevel;
                }
            }
        }

        emit TokenSpent(currentRoot, tokenId, value);
    }
}
