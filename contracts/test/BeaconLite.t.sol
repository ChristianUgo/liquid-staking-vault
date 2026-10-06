// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BeaconLiteVault} from "../src/BeaconLiteVault.sol";
import {WithdrawalQueue} from "../src/WithdrawalQueue.sol";
import {MockValidatorAdapter} from "../src/MockValidatorAdapter.sol";

interface Vm {
    function deal(address who, uint256 newBalance) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
}

contract BeaconLiteTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    BeaconLiteVault private vault;
    WithdrawalQueue private queue;
    MockValidatorAdapter private adapter;
    address private alice = address(0xA11CE);

    function setUp() public {
        vault = new BeaconLiteVault{value: 0.01 ether}(address(this), address(this), address(this), 1_000 ether);
        queue = new WithdrawalQueue(address(this), 60);
        adapter = new MockValidatorAdapter(address(this), address(this), address(0xBEEF), 60);
        vault.setDependencies(address(adapter), address(queue));
        queue.setVault(address(vault));
        adapter.setVault(address(vault));
        vm.deal(alice, 10 ether);
    }

    function testDepositAndExchangeRate() public {
        vm.prank(alice);
        uint256 shares = vault.deposit{value: 1 ether}(alice, 1 ether, block.timestamp + 1);
        require(shares == 1 ether, "shares");
        require(vault.totalBacking() == 1.01 ether, "backing");
        require(vault.convertToAssets(shares) == 1 ether, "assets");
    }

    function testQueueFinalizationAndClaim() public {
        vm.prank(alice);
        uint256 shares = vault.deposit{value: 1 ether}(alice, 0, block.timestamp + 1);
        vm.prank(alice);
        vault.approve(address(queue), shares);
        vm.prank(alice);
        uint256 requestId = queue.requestWithdrawal(shares / 2);
        vm.warp(block.timestamp + 61);
        queue.finalize(1);
        uint256 beforeBalance = alice.balance;
        vm.prank(alice);
        queue.claim(requestId, alice);
        require(alice.balance > beforeBalance, "claim");
    }

    function testRewardChangesRateAndLossReducesIt() public {
        vm.prank(alice);
        vault.deposit{value: 1 ether}(alice, 0, block.timestamp + 1);
        uint256 beforeRate = (vault.totalBacking() * 1e18) / vault.totalSupply();
        vault.allocateToAdapter(0.5 ether);
        adapter.fundReward{value: 0.1 ether}();
        uint256 rewardRate = (vault.totalBacking() * 1e18) / vault.totalSupply();
        require(rewardRate > beforeRate, "reward rate");
        adapter.simulateLoss(0.1 ether);
        uint256 lossRate = (vault.totalBacking() * 1e18) / vault.totalSupply();
        require(lossRate < rewardRate, "loss rate");
    }
}
