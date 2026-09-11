// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AgentRelayIdentity} from "../src/AgentRelayIdentity.sol";
import {AgentRelayReputation} from "../src/AgentRelayReputation.sol";
import {AgentRelayEscrow} from "../src/AgentRelayEscrow.sol";

/// @notice Deploys the full Solidity side of AgentRelay and wires it to the
/// already-deployed Stylus ValidationContract, in the required order:
/// identity has no dependencies, escrow needs identity and the validation
/// contract, reputation needs identity and escrow, then escrow needs to be
/// told where reputation ended up since that address doesn't exist yet at
/// the time escrow is deployed.
contract DeployAgentRelay is Script {
    // Circle-issued USDC on Arbitrum Sepolia, confirmed against Circle's own
    // developer docs (developers.circle.com/stablecoins/usdc-contract-addresses)
    // rather than assumed, since third-party sources disagreed on this address.
    address constant USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    // AgentRelay's Stylus ValidationContract, deployed and verified working
    // on Arbitrum Sepolia earlier in this project.
    address constant VALIDATION_CONTRACT = 0xbf795a0cd8403a4802be33f1efb53836fb89632b;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        AgentRelayIdentity identity = new AgentRelayIdentity();
        console.log("AgentRelayIdentity deployed at:", address(identity));

        AgentRelayEscrow escrow = new AgentRelayEscrow(address(identity), VALIDATION_CONTRACT, USDC);
        console.log("AgentRelayEscrow deployed at:", address(escrow));

        AgentRelayReputation reputation = new AgentRelayReputation(address(identity), address(escrow));
        console.log("AgentRelayReputation deployed at:", address(reputation));

        escrow.setReputationRegistry(address(reputation));
        console.log("Wired AgentRelayEscrow.reputationRegistry to:", address(reputation));

        vm.stopBroadcast();
    }
}
