pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./TimelockInterface.sol";
import "hardhat/console.sol";

contract RolManager is AccessControl {

    bytes32 public constant ROLMANAGER_ADMIN_ROLE = keccak256("ROLMANAGER_ADMIN_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    ///@dev The address of the Timelock
    TimelockInterface public timelock;

    /**
     * @dev Initializes the contract with a given Timelock address and administrator address.
     */
    constructor (address _timelock, address _admin) {
        // set roles administrator
        _setRoleAdmin(ROLMANAGER_ADMIN_ROLE, ROLMANAGER_ADMIN_ROLE);
        _setRoleAdmin(PROPOSER_ROLE, ROLMANAGER_ADMIN_ROLE);
        _setRoleAdmin(EXECUTOR_ROLE, ROLMANAGER_ADMIN_ROLE);

        // set admin rol to an address
        _setupRole(ROLMANAGER_ADMIN_ROLE, _admin);

        // set timelock address
        timelock = TimelockInterface(_timelock);
    }

    /**
     * @dev Modifier to make a function callable just by a certain role.
     */
    modifier justByRole(bytes32 role) {
        require(hasRole(role, _msgSender()), "RolManager: sender requires permission");
        _;
    }

    function queueTransaction(address target, uint256 value, string memory signature, bytes memory data, uint256 eta) public justByRole(PROPOSER_ROLE) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        _queueTimelockTransaction(txHash, target, value, signature, data, eta);
    }

    function cancelTransaction(address target, uint value, string memory signature, bytes memory data, uint eta) public justByRole(ROLMANAGER_ADMIN_ROLE) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
       _cancelTimelockTransaction(txHash, target, value, signature, data, eta);
    }

    function executeTransaction(address target, uint256 value, string memory signature, bytes memory data, uint256 eta) public justByRole(EXECUTOR_ROLE) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        _executeTimelockTransaction(txHash, target, value, signature, data, eta);
    }

    function _queueTimelockTransaction(bytes32 txHash, address target, uint256 value, string memory signature, bytes memory data, uint256 eta) private {
        require(!timelock.queuedTransactions(txHash), "RolManager::queueTransaction: transaction already queued at eta");
        timelock.queueTransaction(target, value, signature, data, eta);
    }

    function _cancelTimelockTransaction(bytes32 txHash, address target, uint256 value, string memory signature, bytes memory data, uint256 eta) private {
        require(timelock.queuedTransactions(txHash), "RolManager::cancelTransaction: transaction should be queued");
        timelock.cancelTransaction(target, value, signature, data, eta);
    }

    function _executeTimelockTransaction(bytes32 txHash, address target, uint value, string memory signature, bytes memory data, uint eta) private {
        require(timelock.queuedTransactions(txHash), "RolManager::executeTransaction: transaction should be queued");
        timelock.executeTransaction{value: value}(target, value, signature, data, eta);
    }

}