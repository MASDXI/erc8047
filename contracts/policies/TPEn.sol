// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;
/**
 * @title AbstractTokenPolicyEnforcement (TPEn) (dissertation prototype)
 * @dev Abstract contract for managing O(1) multi-dimensional token quarantines.
 * NOTE: This version is a functional prototype designed for academic demonstration.
 * further work implementation of `massLevel` batch operations. iterations
 * will push bit-shifting computations off-chain, allowing regulators to pass fully
 * computed 256-bit integer masks directly to a specific bucket slot, enabling the
 * simultaneous state-flipping of up to 256 topological levels in a single transaction.
 * @notice This contract allows regulators to freeze and unfreeze tokens using topological bounds, bitmasks, and discrete mapping.
 * @author Sirawit Techavanitch (sirawit_tec@live4.utcc.ac.th)
 */
abstract contract AbstractTokenPolicyEnforcement {
    enum FREEZE_TYPES {
        NONE,
        LOWER_BOUND,
        UPPER_BOUND,
        LEVEL,
        DISCRETE
    }

    struct Policy {
        uint128 beforeLevel;
        uint128 afterLevel;
        mapping(uint256 => bool) tokens;
        mapping(uint256 => uint256) bitmasks;
    }

    mapping(uint256 => Policy) private _policies;

    error TokenFrozen();
    error TokenNotFrozen();
    error LevelFrozen();
    error LevelNotFrozen();
    error ConflictingBounds();
    error InvalidUnfreezeTypes();
    error BoundNotSet();

    event frozenToken(uint256 indexed tokenId);
    event frozenBefore(uint256 indexed root, uint256 level);
    event frozenAfter(uint256 indexed root, uint256 level);
    event frozenLevel(uint256 indexed root, uint256 level);

    event unfrozenToken(uint256 indexed tokenId);
    event unfrozenBefore(uint256 indexed root, uint256 level);
    event unfrozenAfter(uint256 indexed root, uint256 level);
    event unfrozenLevel(uint256 indexed root, uint256 level);

    /**
     * @notice Calculates the 256-bit storage bucket and specific bit index for a given DAG level.
     * @dev Uses pure bitwise operations in assembly for maximum EVM gas efficiency.
     * @param level The chronological depth (Y-axis) of the token in the DAG.
     * @return bucket The exact 256-level chunk where the state is stored.
     * @return bitIndex The specific bit position (0-255) within that bucket.
     */
    function calcTokenBucketAndBitIndex(uint256 level) private pure returns (uint256 bucket, uint256 bitIndex) {
        assembly ("memory-safe") {
            // right shift by 8 bits (equivalent to level / 256)
            bucket := shr(8, level)
            // bitwise AND 255 (equivalent to level % 256)
            bitIndex := and(level, 0xFF)
        }
    }

    /**
     * @notice Internal function to update the discrete frozen status of a specific token.
     * @param root The identifier of the DAG transaction family.
     * @param tokenId The unique identifier of the discrete asset.
     * @param freeze The target status (true to freeze, false to unfreeze).
     */
    function updateFreezeToken(uint256 root, uint256 tokenId, bool freeze) private {
        _policies[root].tokens[tokenId] = freeze;
        if (freeze) {
            emit frozenToken(tokenId);
        } else {
            emit unfrozenToken(tokenId);
        }
    }

    /**
     * @notice Evaluates if a token is frozen.
     * @param root The DAG transaction family ID.
     * @param tokenId The specific discrete asset token ID.
     * @param level The topological depth of the token.
     * @return isFrozen Boolean indicating if the token is locked.
     * @return freezeType The specific algorithmic rule that triggered the lock.
     */
    function isTokenFrozen(uint256 root, uint256 tokenId, uint256 level) public view returns (bool, FREEZE_TYPES) {
        Policy storage policy = _policies[root];

        // boundary checks
        uint128 beforeLevel = policy.beforeLevel;
        uint128 afterLevel = policy.afterLevel;

        if (beforeLevel != 0 && level <= beforeLevel) return (true, FREEZE_TYPES.LOWER_BOUND);
        if (afterLevel != 0 && level >= afterLevel) return (true, FREEZE_TYPES.UPPER_BOUND);

        // bitmask check
        (uint256 bucket, uint256 bitIndex) = calcTokenBucketAndBitIndex(level);
        if ((policy.bitmasks[bucket] & (1 << bitIndex)) != 0) {
            return (true, FREEZE_TYPES.LEVEL);
        }

        // specific token check
        if (policy.tokens[tokenId]) {
            return (true, FREEZE_TYPES.DISCRETE);
        }

        // fallback case
        return (false, FREEZE_TYPES.NONE);
    }

    /**
     * @notice Establishes a continuous lower bound. All tokens at or below this level are frozen.
     * @dev Reverts if the requested level overlaps with an existing upper bound.
     * @param root The DAG transaction family ID.
     * @param level The DAG depth limit.
     */
    function freezeTokenBefore(uint256 root, uint256 level) public virtual {
        Policy storage policy = _policies[root];
        if (policy.afterLevel != 0 && level >= policy.afterLevel) revert ConflictingBounds();

        policy.beforeLevel = uint128(level);
        emit frozenBefore(root, level);
    }

    /**
     * @notice Establishes a continuous upper bound. All tokens at or above this level are frozen.
     * @dev Reverts if the requested level overlaps with an existing lower bound.
     * @param root The DAG transaction family ID.
     * @param level The DAG depth limit.
     */
    function freezeTokenAfter(uint256 root, uint256 level) public virtual {
        Policy storage policy = _policies[root];
        if (policy.beforeLevel != 0 && level <= policy.beforeLevel) revert ConflictingBounds();

        policy.afterLevel = uint128(level);

        emit frozenAfter(root, level);
    }

    /**
     * @notice Completely lifts the continuous lower bound quarantine for a DAG family.
     * @param root The DAG transaction family ID.
     * @param level The previous bound level (logged for off-chain indexing).
     */
    function unfreezeTokenBefore(uint256 root, uint256 level) public virtual {
        Policy storage policy = _policies[root];
        if (policy.beforeLevel == 0) revert BoundNotSet();

        policy.beforeLevel = 0;

        emit unfrozenBefore(root, level);
    }

    /**
     * @notice Completely lifts the continuous upper bound quarantine for a DAG family.
     * @param root The DAG transaction family ID.
     * @param level The previous bound level (logged for off-chain indexing).
     */
    function unfreezeTokenAfter(uint256 root, uint256 level) public virtual {
        Policy storage policy = _policies[root];
        if (policy.afterLevel == 0) revert BoundNotSet();

        policy.afterLevel = 0;

        emit unfrozenAfter(root, level);
    }

    /**
     * @notice Applies an O(1) bitmask quarantine to a specific topological level.
     * @dev Reverts if the targeted level is already frozen to prevent redundant gas spend and duplicate events.
     * @param root The DAG transaction family ID.
     * @param level The exact DAG depth to freeze.
     */
    function freezeLevel(uint256 root, uint256 level) public virtual {
        (uint256 bucket, uint256 bitIndex) = calcTokenBucketAndBitIndex(level);
        // load the current 256-bit bucket into memory (1 SLOAD)
        uint256 currentMask = _policies[root].bitmasks[bucket];
        uint256 targetBit = 1 << bitIndex;
        // check if the specific bit is already 1. If yes, revert.
        if ((currentMask & targetBit) != 0) revert LevelFrozen();
        // apply the bitwise OR and write back to storage (1 SSTORE)
        _policies[root].bitmasks[bucket] = currentMask | targetBit;

        emit frozenLevel(root, level);
    }

    /**
     * @notice Removes a specific topological level from the bitmask quarantine.
     * @dev Reverts if the targeted level is not currently frozen to prevent redundant gas spend.
     * @param root The DAG transaction family ID.
     * @param level The exact DAG depth to unfreeze.
     */
    function unfreezeLevel(uint256 root, uint256 level) public virtual {
        (uint256 bucket, uint256 bitIndex) = calcTokenBucketAndBitIndex(level);
        // load the current 256-bit bucket into memory (1 SLOAD)
        uint256 currentMask = _policies[root].bitmasks[bucket];
        uint256 targetBit = 1 << bitIndex;
        // check if the specific bit is already 0=. If yes, revert.
        if ((currentMask & targetBit) == 0) revert LevelNotFrozen();
        // apply the bitwise AND NOT and write back to storage (1 SSTORE)
        _policies[root].bitmasks[bucket] = currentMask & ~targetBit;

        emit unfrozenLevel(root, level);
    }

    /**
     * @notice Freezes a specific discrete token ID.
     * @param root The DAG transaction family ID.
     * @param tokenId The unique identifier of the token.
     * @param level The topological depth of the token.
     */
    function freezeToken(uint256 root, uint256 tokenId, uint256 level) public virtual {
        (bool isFrozen, ) = isTokenFrozen(root, tokenId, level);
        if (isFrozen) revert TokenFrozen();

        updateFreezeToken(root, tokenId, true);
    }

    /**
     * @notice Unfreezes a specific discrete token ID.
     * @dev Reverts if the token is locked by a continuous bound or level mask.
     * @param root The DAG transaction family ID.
     * @param tokenId The unique identifier of the token.
     * @param level The topological depth of the token.
     */
    function unfreezeToken(uint256 root, uint256 tokenId, uint256 level) public virtual {
        (bool isFrozen, FREEZE_TYPES types) = isTokenFrozen(root, tokenId, level);

        if (!isFrozen) revert TokenNotFrozen();
        if (types != FREEZE_TYPES.DISCRETE) revert InvalidUnfreezeTypes();

        updateFreezeToken(root, tokenId, false);
    }
}
