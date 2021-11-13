/**
* SPDX-License-Identifier: MIT
*/

pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ITimelock.sol";
import "./ISafeGuard.sol";

/**
 *  @title Safe Guard
 */
contract SafeGuard is ISafeGuard, AccessControlEnumerable, Ownable {
    /**
    * @dev events definition
    */
    event CancelTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event ExecuteTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event QueueTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event QueueTransactionWithDescription(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta,
        string description
    );

    /**
    * @dev Roles definitions
    */
    bytes32 public constant SAFEGUARD_ADMIN_ROLE = keccak256("SAFEGUARD_ADMIN_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELER_ROLE = keccak256("CANCELER_ROLE");

    /**
    * @dev The address of the Timelock
    */
    ITimelock public timelock;

    /**
     * @notice Initializes the contract with a given Timelock address and administrator address.
     */
    constructor(
        address _admin,
        bytes32[] memory _roles,
        address[] memory _rolesAssignees
    ) {
        require(_roles.length == _rolesAssignees.length, "SafeGuard::constructor: roles assignment arity mismatch");
        // set roles administrator
        _setRoleAdmin(SAFEGUARD_ADMIN_ROLE, SAFEGUARD_ADMIN_ROLE);
        _setRoleAdmin(PROPOSER_ROLE, SAFEGUARD_ADMIN_ROLE);
        _setRoleAdmin(EXECUTOR_ROLE, SAFEGUARD_ADMIN_ROLE);
        _setRoleAdmin(CANCELER_ROLE, SAFEGUARD_ADMIN_ROLE);

        // assign roles
        for (uint256 i = 0; i < _roles.length; i++) {
            _setupRole(_roles[i], _rolesAssignees[i]);
        }

        // set admin role the a defined admin address
        _setupRole(SAFEGUARD_ADMIN_ROLE, _admin);
    }

    /**
     * @notice Modifier to make a function callable just by a certain role.
     */
    modifier justByRole(bytes32 _role) {
        require(hasRole(_role, _msgSender()), "SafeGuard: sender requires permission");
        _;
    }

    /**
     * @notice Sets the timelock address this safeGuard contract is going to use
     * @param _timelock The address of the timelock contract
     */
    function setTimelock(address _timelock) public override onlyOwner {
        require(address(timelock) == address(0), "SafeGuard::setTimelock: Timelock address already defined");
        // set timelock address
        timelock = ITimelock(_timelock);
    }

    /**
     * @dev Hash the proposal information
     * @param _target The address of the target contract
     * @param _value The value that the transaction needs
     * @param _signature The signature of the function to be executed
     * @param _data The data required to execute the function
     * @param _eta  the eta on which the transaction will be availiable
     */
    function hashProposalTx(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _data,
        uint256 _eta
    ) public override pure virtual returns (bytes32) {
        return keccak256(abi.encode(_target, _value, _signature, _data, _eta));
    }

    /**
     * @notice Queues transaction in the timelock
     * @param _target The address of the target contract
     * @param _value The value that the transaction needs
     * @param _signature The signature of the function to be executed
     * @param _data The data required to execute the function
     * @param _eta  the eta on which the transaction will be availiable
     */
    function queueTransaction(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _data,
        uint256 _eta
    ) public override justByRole(PROPOSER_ROLE) {
        bytes32 txHash = _queueTimelockTransaction(_target, _value, _signature, _data, _eta);
        emit QueueTransaction(txHash, _target, _value, _signature, _data, _eta);
    }

    /**
     * @notice Queue transaction in the timelock adding a description
     * @param _target The address of the target contract
     * @param _value The value that the transaction needs
     * @param _signature The signature of the function to be executed
     * @param _data The data required to execute the function
     * @param _eta  the eta on which the transaction will be availiable
     * @param _description the description/explanation of the tx to be queued
     */
    function queueTransactionWithDescription(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _data,
        uint256 _eta,
        string memory _description
    ) public override justByRole(PROPOSER_ROLE) {
        bytes32 txHash = _queueTimelockTransaction(_target, _value, _signature, _data, _eta);
        emit QueueTransactionWithDescription(txHash, _target, _value, _signature, _data, _eta, _description);
    }

    /**
     * @notice Cancels transaction in the timelock
     * @param _target The address of the target contract
     * @param _value The value that the transaction needs
     * @param _signature The signature of the function to be executed
     * @param _data The data required to execute the function
     * @param _eta  the eta on which the transaction will be availiable
     */
    function cancelTransaction(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _data,
        uint256 _eta
    ) public override justByRole(CANCELER_ROLE) {
        bytes32 txHash = hashProposalTx(_target, _value, _signature, _data, _eta);
        require(timelock.queuedTransactions(txHash), "SafeGuard::cancelTransaction: transaction should be queued");
        timelock.cancelTransaction(_target, _value, _signature, _data, _eta);
        emit CancelTransaction(txHash, _target, _value, _signature, _data, _eta);
    }

    /**
     * @notice Execute transaction in the timelock
     * @param _target The address of the target contract
     * @param _value The value that the transaction needs
     * @param _signature The signature of the function to be executed
     * @param _data The data required to execute the function
     * @param _eta  the eta on which the transaction will be availiable
     */
    function executeTransaction(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _data,
        uint256 _eta
    ) public payable override justByRole(EXECUTOR_ROLE) {
        bytes32 txHash = hashProposalTx(_target, _value, _signature, _data, _eta);
        require(timelock.queuedTransactions(txHash), "SafeGuard::executeTransaction: transaction should be queued");
        timelock.executeTransaction{ value: _value }(_target, _value, _signature, _data, _eta);
        emit ExecuteTransaction(txHash, _target, _value, _signature, _data, _eta);
    }

    /**
     * @dev Wrapped function to queue transaction in the timelock
     * @param _target The address of the target contract
     * @param _value The value that the transaction needs
     * @param _signature The signature of the function to be executed
     * @param _data The data required to execute the function
     * @param _eta  the eta on which the transaction will be availiable
     */
    function _queueTimelockTransaction(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _data,
        uint256 _eta
    ) private returns (bytes32) {
        bytes32 txHash = hashProposalTx(_target, _value, _signature, _data, _eta);
        require(!timelock.queuedTransactions(txHash), "SafeGuard::queueTransaction: transaction already queued at eta");
        timelock.queueTransaction(_target, _value, _signature, _data, _eta);
        return txHash;
    }
}
