//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IRegistry {
    function register(address failSafe, uint8 version) external;

    function getFailSafeCount() external view returns (uint256);

    function getFailSafe(uint256 index) external returns (address);
}
