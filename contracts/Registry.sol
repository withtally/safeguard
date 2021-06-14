//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
// pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./IRegistry.sol";

/**
 *  @title Registry contract storing information about all failSafes deployed
 *  Used for querying and reverse querying available failSafes for a given target+identifier transaction
 */
contract Registry is IRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice mapping of failSafes and their version. Version starts from 1
    mapping(address => uint8) public failSafeVersion;

    EnumerableSet.AddressSet private failSafes;

    /// @notice Register event emitted once new failSafe is added to the registry
    event Register(address indexed failSafe, uint8 version);

    /// @notice Register function for adding new failSafe in the registry
    /// @param failSafe the address of the new FailSafe
    /// @param version the version of the failSafe
    function register(address failSafe, uint8 version) external override {
        require(version != 0, "Registry: Invalid version");
        require(
            !failSafes.contains(failSafe),
            "Registry: FailSafe already registered"
        );

        failSafes.add(failSafe);
        failSafeVersion[failSafe] = version;

        emit Register(failSafe, version);
    }

    /**
     * @notice Returns the failSafe address by index
     * @param index the index of the failSafe in the set of failSafes
     */
    function getFailSafe(uint256 index)
        external
        view
        override
        returns (address)
    {
        require(index < failSafes.length(), "Registry: Invalid index");

        return failSafes.at(index);
    }

    /// @notice Returns the count of all unique failSafes
    function getFailSafeCount() external view override returns (uint256) {
        return failSafes.length();
    }


}
