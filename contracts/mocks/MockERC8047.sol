// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "../abstracts/ERC8047.sol";
import "../policies/FreezeAddress.sol";
import "../policies/FreezePartialTokens.sol";
import "../policies/FreezeToken.sol";

contract MockERC8047 is ERC8047, FreezeAddress, FreezePartialTokens, FreezeToken {
    constructor(string memory name_, string memory symbol_, string memory uri_) ERC8047(name_, symbol_, uri_) {}

    // -----------------------------------------------------------------------
    // Advanced Forensic Freezing Rules (Examples)
    // -----------------------------------------------------------------------
    // The following patterns demonstrate how sophisticated enforcement logic
    // can be layered on top of the base ERC8047 DAG structure:
    // 1. checkFrozenTokenAreInRange(root, id)
    //    Prevents transfers if the token's level falls within a specific range [x, y].
    // 2. checkFrozenTokenLevelAfter(root, id)
    //    Prevents transfers for any token that exists deeper than level {x}.
    // 3. checkFrozenTokenLevelBefore(root, id)
    //    Prevents transfers for any token that exists above level {x}.
    // Note: Ideally, these checks should be implemented with toggle switches
    // (active/inactive states) to provide operational flexibility for compliance teams.

    function mint(address account, uint256 value) public {
        _mint(account, value, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes memory data
    )
        public
        override
        checkFrozenAddress(from, to)
        checkFrozenBalance(from, balanceOf(from, id))
        checkFrozenToken(bytes32(id))
    {
        // revert if parent token frozen.
        if (isTokenFrozen(bytes32(parentOf(id)))) {
            revert TokenFrozen();
        }
        super.safeTransferFrom(from, to, id, value, data);
    }

    // @TODO batch
}
