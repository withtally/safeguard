//SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ITimelock.sol";

/**
 *  @title Safe Guard
 */
contract SafeGuard is AccessControlEnumerable, Ownable {

    ///@dev Queue with description event
    event QueueTransactionWithDescription(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint eta, string description);

    ///@dev Roles definitions
    bytes32 public constant SAFEGUARD_ADMIN_ROLE = keccak256("SAFEGUARD_ADMIN_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELER_ROLE = keccak256("CANCELER_ROLE");

    ///@dev The address of the Timelock
    ITimelock public timelock;

    /**
     * @notice Initializes the contract with a given Timelock address and administrator address.
     */
    constructor (address _admin, bytes32[] memory roles, address[] memory rolesAssignees) {
        require(roles.length == rolesAssignees.length, "SafeGuard::constructor: roles assignment arity mismatch");
        // set roles administrator
        _setRoleAdmin(SAFEGUARD_ADMIN_ROLE, SAFEGUARD_ADMIN_ROLE);
        _setRoleAdmin(PROPOSER_ROLE, SAFEGUARD_ADMIN_ROLE);
        _setRoleAdmin(EXECUTOR_ROLE, SAFEGUARD_ADMIN_ROLE);
        _setRoleAdmin(CANCELER_ROLE, SAFEGUARD_ADMIN_ROLE);

        // assign roles
        for (uint i = 0; i < roles.length; i++) {
            _setupRole(roles[i], rolesAssignees[i]);
        }

        // set admin role the an defined admin address
        _setupRole(SAFEGUARD_ADMIN_ROLE, _admin);
    }

    /**
     * @notice Modifier to make a function callable just by a certain role.
     */
    modifier justByRole(bytes32 role) {
        require(hasRole(role, _msgSender()), "SafeGuard: sender requires permission");
        _;
    }

    /**
     * @notice Sets the timelock address this safeGuard contract is gonna use
     * @param _timelock The address of the timelock contract
     */
    function setTimelock(address _timelock) public onlyOwner {
        require(address(timelock) == address(0), "SafeGuard::setTimelock: Timelock address already defined");
        // set timelock address
        timelock = ITimelock(_timelock);
    }

    /**
     * @notice Queues transaction in the timelock
     * @param target The address of the target contract
     * @param value The value that the transaction needs
     * @param signature The signature of the function to be executed
     * @param data The data required to exeute the function
     * @param eta  the eta on which the transaction will be availiable
     */
    function queueTransaction(address target, uint256 value, string memory signature, bytes memory data, uint256 eta) public justByRole(PROPOSER_ROLE) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        _queueTimelockTransaction(txHash, target, value, signature, data, eta);
    }

    /**
     * @notice Queue transaction in the timelock adding a description 
     * @param target The address of the target contract
     * @param value The value that the transaction needs
     * @param signature The signature of the function to be executed
     * @param data The data required to exeute the function
     * @param eta  the eta on which the transaction will be availiable
     */
    function queueTransactionWithDescription(address target, uint256 value, string memory signature, bytes memory data, uint256 eta, string memory description) public justByRole(PROPOSER_ROLE) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        _queueTimelockTransaction(txHash, target, value, signature, data, eta);
        emit QueueTransactionWithDescription(txHash, target, value, signature, data, eta, description);
    }

    /**
     * @notice Cancels transaction in the timelock
     * @param target The address of the target contract
     * @param value The value that the transaction needs
     * @param signature The signature of the function to be executed
     * @param data The data required to exeute the function
     * @param eta  the eta on which the transaction will be availiable
     */
    function cancelTransaction(address target, uint256 value, string memory signature, bytes memory data, uint256 eta) public justByRole(CANCELER_ROLE) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(timelock.queuedTransactions(txHash), "SafeGuard::cancelTransaction: transaction should be queued");
        timelock.cancelTransaction(target, value, signature, data, eta);
    }

    /**
     * @notice Execute transaction in the timelock
     * @param target The address of the target contract
     * @param _value The value that the transaction needs
     * @param signature The signature of the function to be executed
     * @param data The data required to exeute the function
     * @param eta  the eta on which the transaction will be availiable
     */
    function executeTransaction(address target, uint256 _value, string memory signature, bytes memory data, uint256 eta) public payable justByRole(EXECUTOR_ROLE) {
        bytes32 txHash = keccak256(abi.encode(target, _value, signature, data, eta));
        require(timelock.queuedTransactions(txHash), "SafeGuard::executeTransaction: transaction should be queued");
        timelock.executeTransaction{value: _value, gas: gasleft()}(target, _value, signature, data, eta);
    }

    function _queueTimelockTransaction(bytes32 txHash, address target, uint256 value, string memory signature, bytes memory data, uint256 eta) private {
        require(!timelock.queuedTransactions(txHash), "SafeGuard::queueTransaction: transaction already queued at eta");
        timelock.queueTransaction(target, value, signature, data, eta);
    }
}