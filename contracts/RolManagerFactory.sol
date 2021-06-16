//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IRegistry.sol";
import "./RolManager.sol";
import "./mocks/Timelock.sol";

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
        address indexed timelockAddress,
        string safeName
    );

    constructor(address registry_) {
        registry = registry_;
    }

    /**
     * @notice Creates new instance of a FailSafe contract
     */
    function createFailSafe(uint delay_, string memory safeName, address admin, bytes32[] memory roles, address[] memory rolesAssignees) external returns (address) {
        require(roles.length == rolesAssignees.length, "RolManagerFactory::create: roles assignment arity mismatch");
        RolManager rolManager = new RolManager(admin, roles, rolesAssignees);
        Timelock timelock = new Timelock(address(rolManager), delay_);
        rolManager.setTimelock(address(timelock));

        IRegistry(registry).register(address(rolManager), ROL_MANAGER_VERSION);

        emit RolManagerCreated(msg.sender, address(rolManager), address(timelock), safeName);
        return address(rolManager);
    }
}
