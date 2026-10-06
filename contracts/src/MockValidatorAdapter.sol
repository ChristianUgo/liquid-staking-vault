// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBeaconLiteCallbacks {
    function onRewardFunded(uint256 amount) external;
    function onLossSimulated(uint256 amount) external;
    function receiveFromAdapter() external payable;
}

/// @notice A deliberately transparent validator stand-in for demos and tests.
contract MockValidatorAdapter {
    struct Exit { uint256 amount; uint256 readyAt; bool completed; }
    address public owner;
    address public operator;
    address public vault;
    address public lossSink;
    uint256 public exitDelay;
    uint256 public nextExitId = 1;
    mapping(uint256 => Exit) public exits;
    error Unauthorized(); error InvalidAmount(); error NotReady(); error TransferFailed();

    constructor(address initialOwner, address initialOperator, address initialLossSink, uint256 initialExitDelay) {
        if (initialOwner == address(0) || initialOperator == address(0) || initialLossSink == address(0)) revert InvalidAmount();
        owner = initialOwner; operator = initialOperator; lossSink = initialLossSink; exitDelay = initialExitDelay;
    }
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    modifier onlyOperator() { if (msg.sender != operator) revert Unauthorized(); _; }
    receive() external payable { if (msg.sender != vault) revert Unauthorized(); }

    function setVault(address newVault) external onlyOwner { if (vault != address(0) || newVault == address(0)) revert InvalidAmount(); vault = newVault; }
    function setOperator(address value) external onlyOwner { if (value == address(0)) revert InvalidAmount(); operator = value; }
    function setLossSink(address value) external onlyOwner { if (value == address(0)) revert InvalidAmount(); lossSink = value; }
    function setExitDelay(uint256 value) external onlyOwner { exitDelay = value; }
    function delegatedAssets() external view returns (uint256) { return address(this).balance; }

    function fundReward() external payable onlyOperator {
        if (msg.value == 0 || vault == address(0)) revert InvalidAmount();
        (bool sent,) = vault.call{value: msg.value}(""); if (!sent) revert TransferFailed();
        IBeaconLiteCallbacks(vault).onRewardFunded(msg.value);
    }
    function simulateLoss(uint256 amount) external onlyOperator {
        if (amount == 0 || amount > address(this).balance || lossSink == address(0) || vault == address(0)) revert InvalidAmount();
        (bool sent,) = lossSink.call{value: amount}(""); if (!sent) revert TransferFailed();
        IBeaconLiteCallbacks(vault).onLossSimulated(amount);
    }
    function scheduleExit(uint256 amount) external onlyOperator returns (uint256 exitId) {
        if (amount == 0 || amount > address(this).balance || vault == address(0)) revert InvalidAmount();
        exitId = nextExitId++;
        exits[exitId] = Exit(amount, block.timestamp + exitDelay, false);
    }
    function completeExit(uint256 exitId) external onlyOperator {
        Exit storage exit = exits[exitId];
        if (exit.completed || exit.amount == 0 || vault == address(0)) revert InvalidAmount();
        if (block.timestamp < exit.readyAt) revert NotReady();
        exit.completed = true;
        IBeaconLiteCallbacks(vault).receiveFromAdapter{value: exit.amount}();
    }
    function transferOwnership(address newOwner) external onlyOwner { if (newOwner == address(0)) revert InvalidAmount(); owner = newOwner; }
    function renounceOwnership() external onlyOwner { owner = address(0); }
}
