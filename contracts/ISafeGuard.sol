/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity 0.8.7;

/**
 * @dev External interface of SafeGuard.
 */
interface ISafeGuard {
    function setTimelock(address _timelock) external;

    function hashProposalTx(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _data,
        uint256 _eta
    ) external pure returns (bytes32);

    function queueTransaction(
        address _target,
        uint256 _value,
        string calldata _signature,
        bytes calldata _data,
        uint256 _eta
    ) external;

    function queueTransactionWithDescription(
        address _target,
        uint256 _value,
        string memory _signature,
        bytes memory _data,
        uint256 _eta,
        string memory _description
    ) external;

    function cancelTransaction(
        address _target,
        uint256 _value,
        string calldata _signature,
        bytes calldata _data,
        uint256 _eta
    ) external;

    function executeTransaction(
        address _target,
        uint256 _value,
        string calldata _signature,
        bytes calldata _data,
        uint256 _eta
    ) external payable;
}
