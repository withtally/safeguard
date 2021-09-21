//SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./SafeGuard.sol";
import "./mocks/Timelock.sol";

/**
 *  @title SafeGuardFactory - factory contract for deploying SafeGuard contracts
 */
contract SafeGuardFactory is AccessControl, Ownable {

    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice mapping of safeGuards and their version. Version starts from 1
    mapping(address => uint8) public safeGuardVersion;

    EnumerableSet.AddressSet private safeGuards; 

    /// @notice The version of the rol manager
    uint8 public constant SAFE_GUARD_VERSION = 1;

    /// @notice Register event emitted once new safeGuard is added to the registry
    event RegisterSafeGuard(address indexed safeGuard, uint8 version);

    /// @notice Event emitted once new safeGuard is deployed
    event SafeGuardCreated(
        address indexed admin,
        address indexed safeGuardAddress,
        address indexed timelockAddress,
        string safeName
    );

    /**
     * @notice Initializes the contract with a given admin address.
     */
    // constructor(address _admin) {
    // }

    /// @notice Register function for adding new safeGuard in the registry
    /// @param safeGuard the address of the new SafeGuard
    /// @param version the version of the safeGuard
    function register(address safeGuard, uint8 version) private {
        require(
            !safeGuards.contains(safeGuard),
            "SafeGuardFactory:: SafeGuard already registered"
        );

        safeGuards.add(safeGuard);
        safeGuardVersion[safeGuard] = version;

        emit RegisterSafeGuard(safeGuard, version);
    }

    /**
     * @notice Returns the safeGuard address by index
     * @param index the index of the safeGuard in the set of safeGuards
     */
    function getSafeGuard(uint256 index)
        external
        view
        returns (address)
    {
        require(index < safeGuards.length(), "SafeGuardFactory:: Invalid index");

        return safeGuards.at(index);
    }

    /// @notice Returns the count of all unique safeGuards
    function getSafeGuardCount() external view returns (uint256) {
        return safeGuards.length();
    }

    /**
     * @notice Creates new instance of a SafeGuard contract
     */
    function createSafeGuard(uint delay_, string memory safeGuardName, address admin, bytes32[] memory roles, address[] memory rolesAssignees) external returns (address) {
        require(roles.length == rolesAssignees.length, "SafeGuardFactory::create: roles assignment arity mismatch");
        SafeGuard safeGuard = new SafeGuard(admin, roles, rolesAssignees);
        Timelock timelock = new Timelock(address(safeGuard), delay_);
        safeGuard.setTimelock(address(timelock));

        register(address(safeGuard), SAFE_GUARD_VERSION);

        emit SafeGuardCreated(admin, address(safeGuard), address(timelock), safeGuardName);
        return address(safeGuard);
    }
}
