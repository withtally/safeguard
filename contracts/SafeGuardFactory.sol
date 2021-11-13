/**
 * SPDX-License-Identifier: MIT
 */

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

    /**
     * @notice mapping of safeGuards and their version. Version starts from 1
     */
    mapping(address => uint8) public safeGuardVersion;

    /**
     * @notice address set of the safeGuards created
     */
    EnumerableSet.AddressSet private safeGuards;

    /**
     * @notice The version of the rol manager
     */
    uint8 public constant SAFE_GUARD_VERSION = 1;

    /**
     * @notice Register event emitted once new safeGuard is added to the registry
     */
    event RegisterSafeGuard(address indexed safeGuard, uint8 version);

    /**
     * @notice Event emitted once new safeGuard is deployed
     */
    event SafeGuardCreated(
        address indexed admin,
        address indexed safeGuardAddress,
        address indexed timelockAddress,
        string safeName
    );

    /**
     * @notice Register function for adding new safeGuard in the registry
     * @param _safeGuard the address of the new SafeGuard
     * @param _version the version of the safeGuard
     */
    function register(address _safeGuard, uint8 _version) private {
        safeGuards.add(_safeGuard);
        safeGuardVersion[_safeGuard] = _version;

        emit RegisterSafeGuard(_safeGuard, _version);
    }

    /**
     * @notice Returns the safeGuard address by index
     * @param _index the index of the safeGuard in the set of safeGuards
     * @return the SafeGuard address of the specified index
     */
    function getSafeGuard(uint256 _index) external view returns (address) {
        require(_index < safeGuards.length(), "SafeGuardFactory:: Invalid index");

        return safeGuards.at(_index);
    }

    /**
     * @notice Returns the count of all unique safeGuards
     * @return fixed number that represents the lenght of the safeGuards array
     */
    function getSafeGuardCount() external view returns (uint256) {
        return safeGuards.length();
    }

    /**
     * @notice Creates new instance of a SafeGuard contract
     * @param _delay The amount of time a transaction needs to wait before being executed
     * @param _safeGuardName The value that the transaction needs
     * @param _admin The address of the safeGuard radministrato
     * @param _roles Initial roles list to assign on the SafeGuard
     * @param _rolesAssignees  Initial roles assignees on the SafeGuard
     * @return the address of the newly created SafeGuard
     */
    function createSafeGuard(
        uint256 _delay,
        string memory _safeGuardName,
        address _admin,
        bytes32[] memory _roles,
        address[] memory _rolesAssignees
    ) external returns (address) {
        require(_roles.length == _rolesAssignees.length, "SafeGuardFactory::create: roles assignment arity mismatch");
        SafeGuard safeGuard = new SafeGuard(_admin, _roles, _rolesAssignees);
        Timelock timelock = new Timelock(address(safeGuard), _delay);
        safeGuard.setTimelock(address(timelock));

        register(address(safeGuard), SAFE_GUARD_VERSION);

        emit SafeGuardCreated(_admin, address(safeGuard), address(timelock), _safeGuardName);
        return address(safeGuard);
    }
}
