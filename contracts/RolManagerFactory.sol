//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IRegistry.sol";
import "./RolManager.sol";
import "./Timelock.sol";

/**
 *  @title RolManagerFactory - factory contract for deploying rolManager contracts
 */
contract RolManagerFactory {
    /// @notice Address of the failSafe registry
    address public registry;

    /// @notice The version of the rol manager
    uint8 public constant ROL_MANAGER_VERSION = 1;

    /// @notice Event emitted once new failSafe is deployed
    event RolManagerCreated(
        address indexed admin,
        address indexed rolManagerAddress,
        address indexed timelockAddress
    );

    constructor(address registry_) {
        registry = registry_;
    }

    /**
     * @notice Creates new instance of a FailSafe contract
     */
    function createFailSafe(uint delay_) external returns (address) {
        Timelock timelock = new Timelock(address(this), delay_);
        RolManager rolManager = new RolManager(address(timelock), msg.sender);

        IRegistry(registry).register(address(rolManager), ROL_MANAGER_VERSION);

        emit RolManagerCreated(msg.sender, address(rolManager), address(timelock));
        return address(rolManager);
    }
}
