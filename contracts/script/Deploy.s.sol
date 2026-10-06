// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BeaconLiteVault} from "../src/BeaconLiteVault.sol";
import {WithdrawalQueue} from "../src/WithdrawalQueue.sol";
import {MockValidatorAdapter} from "../src/MockValidatorAdapter.sol";

interface VmScript {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    VmScript private constant vm = VmScript(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (BeaconLiteVault vault, WithdrawalQueue queue, MockValidatorAdapter adapter) {
        vm.startBroadcast();
        address deployer = tx.origin;
        vault = new BeaconLiteVault{value: 0.01 ether}(deployer, deployer, deployer, 1_000 ether);
        queue = new WithdrawalQueue(deployer, 60);
        adapter = new MockValidatorAdapter(deployer, deployer, deployer, 60);
        vault.setDependencies(address(adapter), address(queue));
        queue.setVault(address(vault));
        adapter.setVault(address(vault));
        vm.stopBroadcast();
    }
}
