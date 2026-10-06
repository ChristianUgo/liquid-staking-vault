// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBeaconLiteVault {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function idleAssets() external view returns (uint256);
    function isTerminalState() external view returns (bool);
    function burnLockedShares(uint256 shares) external;
    function withdrawFinalizedETH(address to, uint256 amount) external;
}

/// @notice Minimal FIFO asynchronous withdrawal queue for the Beacon Lite teaching project.
contract WithdrawalQueue {
    struct Request { address owner; uint256 shares; uint256 requestTimestamp; uint256 claimableAssets; bool finalized; bool claimed; }
    address public owner;
    address public vault;
    uint256 public minDelay;
    uint256 public nextRequestId = 1;
    uint256 public nextPendingRequestId = 1;
    uint256 public reservedAssets;
    mapping(uint256 => Request) public requests;

    error Unauthorized(); error InvalidAmount(); error NotReady(); error InsufficientLiquidity(); error NotOwner(); error AlreadyClaimed(); error TransferFailed();
    event WithdrawalRequested(uint256 indexed requestId, address indexed owner, uint256 shares);
    event WithdrawalFinalized(uint256 indexed requestId, uint256 shares, uint256 assets);
    event WithdrawalClaimed(uint256 indexed requestId, address indexed receiver, uint256 assets);

    constructor(address initialOwner, uint256 initialMinDelay) { if (initialOwner == address(0)) revert InvalidAmount(); owner = initialOwner; minDelay = initialMinDelay; }
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    receive() external payable { if (msg.sender != vault) revert Unauthorized(); }

    function setVault(address newVault) external onlyOwner { if (vault != address(0) || newVault == address(0)) revert InvalidAmount(); vault = newVault; }
    function setMinDelay(uint256 value) external onlyOwner { minDelay = value; }

    function requestWithdrawal(uint256 shares) external returns (uint256 requestId) {
        if (shares == 0 || vault == address(0) || IBeaconLiteVault(vault).isTerminalState()) revert InvalidAmount();
        if (!IBeaconLiteVault(vault).transferFrom(msg.sender, address(this), shares)) revert TransferFailed();
        requestId = nextRequestId++;
        requests[requestId] = Request(msg.sender, shares, block.timestamp, 0, false, false);
        emit WithdrawalRequested(requestId, msg.sender, shares);
    }

    function finalize(uint256 maxRequests) external returns (uint256 finalizedCount) {
        if (maxRequests == 0) revert InvalidAmount();
        while (finalizedCount < maxRequests) {
            Request storage request = requests[nextPendingRequestId];
            if (request.owner == address(0)) break;
            if (request.finalized) { nextPendingRequestId++; continue; }
            if (block.timestamp < request.requestTimestamp + minDelay) break;
            uint256 assets = IBeaconLiteVault(vault).convertToAssets(request.shares);
            if (assets == 0) revert InvalidAmount();
            if (assets > IBeaconLiteVault(vault).idleAssets()) revert InsufficientLiquidity();
            IBeaconLiteVault(vault).burnLockedShares(request.shares);
            IBeaconLiteVault(vault).withdrawFinalizedETH(address(this), assets);
            request.claimableAssets = assets;
            request.finalized = true;
            reservedAssets += assets;
            nextPendingRequestId++;
            finalizedCount++;
            emit WithdrawalFinalized(nextPendingRequestId - 1, request.shares, assets);
        }
    }

    function claim(uint256 requestId, address receiver) external returns (uint256 amount) {
        Request storage request = requests[requestId];
        if (request.owner != msg.sender) revert NotOwner();
        if (!request.finalized) revert NotReady();
        if (request.claimed) revert AlreadyClaimed();
        if (receiver == address(0)) revert InvalidAmount();
        request.claimed = true;
        amount = request.claimableAssets;
        reservedAssets -= amount;
        (bool ok,) = receiver.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit WithdrawalClaimed(requestId, receiver, amount);
    }

    function requestStatus(uint256 requestId) external view returns (Request memory) { return requests[requestId]; }
    function transferOwnership(address newOwner) external onlyOwner { if (newOwner == address(0)) revert InvalidAmount(); owner = newOwner; }
    function renounceOwnership() external onlyOwner { owner = address(0); }
}
