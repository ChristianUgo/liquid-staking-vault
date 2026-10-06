// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Educational liquid-staking vault. Validator balances are simulated by MockValidatorAdapter.
contract BeaconLiteVault {
    string public constant name = "Beacon Lite Staked ETH";
    string public constant symbol = "blsETH";
    uint8 public constant decimals = 18;
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    address public owner;
    address public operator;
    address public guardian;
    address public adapter;
    address public withdrawalQueue;
    uint256 public tvlCap;
    bool public initialized;
    bool public paused;
    bool public isTerminalState;
    uint256 private _idleAssets;
    uint256 private _delegatedAssets;

    error Unauthorized();
    error Paused();
    error InvalidAmount();
    error InvalidReceiver();
    error DeadlineExpired();
    error Slippage();
    error TvlCapExceeded();
    error AlreadyInitialized();
    error TerminalState();
    error InsufficientBalance();
    error TransferFailed();

    event Deposit(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event AdapterAllocated(uint256 assets);
    event AdapterReturned(uint256 assets);
    event RewardFunded(uint256 assets);
    event LossSimulated(uint256 assets);

    constructor(address initialOwner, address initialOperator, address initialGuardian, uint256 initialTvlCap)
        payable
    {
        if (initialOwner == address(0) || initialOperator == address(0) || initialGuardian == address(0)) {
            revert InvalidReceiver();
        }
        if (msg.value == 0) revert InvalidAmount();
        owner = initialOwner;
        operator = initialOperator;
        guardian = initialGuardian;
        tvlCap = initialTvlCap;
        _idleAssets = msg.value;
        _mint(DEAD_ADDRESS, msg.value);
    }

    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    modifier onlyOperator() { if (msg.sender != operator) revert Unauthorized(); _; }
    modifier onlyQueue() { if (msg.sender != withdrawalQueue) revert Unauthorized(); _; }
    modifier onlyAdapter() { if (msg.sender != adapter) revert Unauthorized(); _; }

    receive() external payable {
        // Direct ETH is deliberately not added to the accounting ledger.
        if (msg.sender != adapter) revert Unauthorized();
    }

    function setDependencies(address newAdapter, address newQueue) external onlyOwner {
        if (initialized || newAdapter == address(0) || newQueue == address(0)) revert AlreadyInitialized();
        adapter = newAdapter;
        withdrawalQueue = newQueue;
        initialized = true;
    }

    function setOperator(address newOperator) external onlyOwner { if (newOperator == address(0)) revert InvalidReceiver(); operator = newOperator; }
    function setGuardian(address newGuardian) external onlyOwner { if (newGuardian == address(0)) revert InvalidReceiver(); guardian = newGuardian; }
    function setTVLCap(uint256 newCap) external onlyOwner { tvlCap = newCap; }
    function setPaused(bool value) external { if (msg.sender != owner && msg.sender != guardian) revert Unauthorized(); paused = value; }

    function totalBacking() public view returns (uint256) { return _idleAssets + _delegatedAssets; }
    function idleAssets() external view returns (uint256) { return _idleAssets; }
    function delegatedAssets() external view returns (uint256) { return _delegatedAssets; }
    function exchangeRate() external view returns (uint256) { return totalSupply == 0 ? 0 : (totalBacking() * 1e18) / totalSupply; }
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 backing = totalBacking();
        return totalSupply == 0 || backing == 0 ? assets : (assets * totalSupply) / backing;
    }
    function convertToAssets(uint256 shares) public view returns (uint256) {
        return totalSupply == 0 ? 0 : (shares * totalBacking()) / totalSupply;
    }
    function previewDeposit(uint256 assets) external view returns (uint256) { return convertToShares(assets); }

    function deposit(address receiver, uint256 minSharesOut, uint256 deadline) external payable returns (uint256 shares) {
        if (paused) revert Paused();
        if (isTerminalState) revert TerminalState();
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (receiver == address(0) || msg.value == 0) revert InvalidAmount();
        if (tvlCap != 0 && totalBacking() + msg.value > tvlCap) revert TvlCapExceeded();
        shares = convertToShares(msg.value);
        if (shares == 0 || shares < minSharesOut) revert Slippage();
        _idleAssets += msg.value;
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, msg.value, shares);
    }

    function allocateToAdapter(uint256 assets) external onlyOperator {
        if (assets == 0 || assets > _idleAssets) revert InvalidAmount();
        _idleAssets -= assets;
        _delegatedAssets += assets;
        (bool ok,) = adapter.call{value: assets}("");
        if (!ok) revert TransferFailed();
        emit AdapterAllocated(assets);
    }

    function receiveFromAdapter() external payable onlyAdapter {
        if (msg.value == 0 || msg.value > _delegatedAssets) revert InvalidAmount();
        _delegatedAssets -= msg.value;
        _idleAssets += msg.value;
        emit AdapterReturned(msg.value);
    }

    function onRewardFunded(uint256 amount) external onlyAdapter {
        // The adapter must have transferred the ETH to this contract first.
        if (amount == 0 || address(this).balance < _idleAssets + amount) revert InvalidAmount();
        _delegatedAssets += amount;
        emit RewardFunded(amount);
    }

    function onLossSimulated(uint256 amount) external onlyAdapter {
        if (amount == 0 || amount > _delegatedAssets) revert InvalidAmount();
        _delegatedAssets -= amount;
        isTerminalState = totalBacking() == 0;
        emit LossSimulated(amount);
    }

    function burnLockedShares(uint256 shares) external onlyQueue { _burn(msg.sender, shares); }

    function withdrawFinalizedETH(address to, uint256 amount) external onlyQueue {
        if (to == address(0) || amount == 0 || amount > _idleAssets) revert InvalidAmount();
        _idleAssets -= amount;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function transfer(address to, uint256 value) external returns (bool) { _transfer(msg.sender, to, value); return true; }
    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; emit Approval(msg.sender, spender, value); return true; }
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) { if (allowed < value) revert InsufficientBalance(); allowance[from][msg.sender] = allowed - value; }
        _transfer(from, to, value);
        return true;
    }

    function transferOwnership(address newOwner) external onlyOwner { if (newOwner == address(0)) revert InvalidReceiver(); owner = newOwner; }
    function renounceOwnership() external onlyOwner { owner = address(0); }

    function _transfer(address from, address to, uint256 value) internal {
        if (to == address(0) || balanceOf[from] < value) revert InsufficientBalance();
        balanceOf[from] -= value; balanceOf[to] += value; emit Transfer(from, to, value);
    }
    function _mint(address to, uint256 value) internal { totalSupply += value; balanceOf[to] += value; emit Transfer(address(0), to, value); }
    function _burn(address from, uint256 value) internal { if (balanceOf[from] < value) revert InsufficientBalance(); balanceOf[from] -= value; totalSupply -= value; emit Transfer(from, address(0), value); }
}
