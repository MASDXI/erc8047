// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "../abstracts/ERC8047.sol";
import "../policies/FreezeAddress.sol";
import "../policies/FreezePartialTokens.sol";
import "../policies/FreezeToken.sol";

contract MockERC8047 is ERC8047, FreezeAddress, FreezePartialTokens, FreezeToken {
    constructor(string memory name_, string memory symbol_) ERC8047(name_, symbol_, "") {}

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
        super.safeTransferFrom(from, to, id, value, data);
    }
}
