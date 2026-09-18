// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AgentRelayReputation} from "../src/AgentRelayReputation.sol";
import {AgentRelayEscrow} from "../src/AgentRelayEscrow.sol";

/// @notice Redeploys AgentRelayEscrow (now with ownership checks and a
/// dispute refund) and AgentRelayReputation (which must be redeployed
/// alongside it, since its constructor is given escrow's address).
/// AgentRelayIdentity and the Stylus ValidationContract are unchanged and
/// stay at their existing addresses; only Escrow's bytecode changed, so
/// only Escrow and its dependent, Reputation, need fresh addresses.
contract RedeployEscrow is Script {
    // Unchanged from the original deployment.
    address constant IDENTITY = 0x36953CbD5745291de7B91ce126eD238340c79434;
    address constant VALIDATION_CONTRACT = 0xBF795A0cD8403A4802be33F1EFB53836FB89632B;
    address constant USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        AgentRelayEscrow escrow = new AgentRelayEscrow(IDENTITY, VALIDATION_CONTRACT, USDC);
        console.log("AgentRelayEscrow (v2, with ownership checks) deployed at:", address(escrow));

        AgentRelayReputation reputation = new AgentRelayReputation(IDENTITY, address(escrow));
        console.log("AgentRelayReputation (v2) deployed at:", address(reputation));

        escrow.setReputationRegistry(address(reputation));
        console.log("Wired AgentRelayEscrow.reputationRegistry to:", address(reputation));

        vm.stopBroadcast();
    }
}
