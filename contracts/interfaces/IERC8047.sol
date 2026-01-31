// SPDX-License-Identifier: CC0-1.0
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title ERC-8047 interface
 */

import {IERC5615} from "./IERC5615.sol";
import {Forest} from "../libraries/Forest.sol";

interface IERC8047 is IERC5615 {
    /**
     * @notice Emitted when a new token is created within a DAG.
     * @param root The root token ID of the DAG to which the new token belongs.
     * @param id The ID of the newly created token.
     * @param from The address that created/minted the token.
     */
    event TokenCreated(uint256 indexed root, uint256 id, address indexed from);

    /**
     * @notice Emitted when a token is spent or partially spent.
     * @param root The root token ID of the DAG to which the new token belongs.
     * @param id The ID of the token being spent.
     * @param value The amount of the token that was spent.
     */
    event TokenSpent(uint256 indexed root, uint256 indexed id, uint256 value);

    /**
     * @notice Retrieves the latest (highest) level of the DAG that a given root belongs to.
     * @param id The ID of the token.
     * @return uint256 The latest DAG level for the token.
     */
    function latestDAGLevelOf(uint256 id) external view returns (uint256);

    /**
     * @notice Retrieves the level of token within its DAG.
     * @param id The ID of the token.
     * @return uint256 The level of the token in the DAG.
     */
    function levelOf(uint256 id) external view returns (uint256);

    /**
     * @notice Retrieves the owner of a given token.
     * @param id The ID of the token.
     * @return address The address that owns the token.
     */
    function ownerOf(uint256 id) external view returns (address);

    /**
     * @notice Retrieves the parent token ID of a given token.
     * @param id The ID of the token.
     * @return uint256 The ID of the parent token. Retrieves 0 if the token is a root.
     */
    function parentOf(uint256 id) external view returns (uint256);

    /**
     * @notice Retrieves the root token ID of the DAG to which a given token belongs.
     * @param id The ID of the token.
     * @return uint256 The root token ID of the DAG.
     */
    function rootOf(uint256 id) external view returns (uint256);

    /**
     * @notice Retrieves total supply of all token.
     * @custom:overloading of {IERC5615.totalSupply} similar to {IERC20.totalSupply}
     * @return uint256 The total supply of all token.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @notice Retrieves token detail from given token id.
     * @param id The ID of the token.
     * @return Forest.token Token detail.
     */
    function token(uint256 id) external view returns (Forest.Token memory);
}
