// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "../abstracts/ForestTokenV2.sol";
import "../policies/FreezeAddress.sol";
import "../policies/FreezePartialTokens.sol";
import "../policies/FreezeToken.sol";

// @TODO
contract MockForestV2 is ForestTokenV2, FreezeAddress, FreezePartialTokens, FreezeToken {
    constructor(string memory name_, string memory symbol_) ForestTokenV2(name_, symbol_, "") {}

    function mint(address account, uint256 value) public {
        _mint(account, value, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes memory data
    ) public override checkFrozenAddress(from, to) checkFrozenBalance(from, balanceOf(from, id)) checkFrozenToken(bytes32(id)) {
        super.safeTransferFrom(from, to, id, value, data);
    }
}
