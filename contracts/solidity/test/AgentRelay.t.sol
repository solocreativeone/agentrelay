// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRelayIdentity} from "../src/AgentRelayIdentity.sol";
import {AgentRelayReputation} from "../src/AgentRelayReputation.sol";
import {AgentRelayEscrow} from "../src/AgentRelayEscrow.sol";

/// @notice Minimal ERC20 stand-in for USDC. Written by hand rather than
/// pulled from OpenZeppelin so the tests stay readable and so mint() can
/// be called freely without owner plumbing.
contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @notice Stands in for the Stylus ValidationContract. The real one does
/// ECDSA recovery in Rust, which Foundry cannot execute, so these tests
/// use a toggleable mock. That means these tests cover the Solidity
/// contracts' own logic (escrow lifecycle, access control, payout,
/// reputation), not the cryptography itself. Signature verification is
/// covered separately by the Rust unit tests in contracts/stylus and by
/// scripts/test-validation-contract.sh against the live deployment.
contract MockValidationContract {
    bool public shouldVerify = true;

    function setShouldVerify(bool value) external {
        shouldVerify = value;
    }

    function verifyProof(bytes calldata, bytes calldata) external view returns (bool) {
        return shouldVerify;
    }
}

contract AgentRelayTest is Test {
    AgentRelayIdentity identity;
    AgentRelayReputation reputation;
    AgentRelayEscrow escrow;
    MockUSDC usdc;
    MockValidationContract validation;

    address requester = address(0x1111);
    address claimant = address(0x2222);
    address stranger = address(0x3333);

    uint256 constant BOUNTY = 1_000_000; // 1 USDC, 6 decimals
    bytes constant EXPECTED_RESULT = "api-call-result-v1";
    bytes constant PROOF = "any-bytes-the-mock-ignores";

    function setUp() public {
        usdc = new MockUSDC();
        validation = new MockValidationContract();

        // Deploy order matters: reputation needs escrow's address at
        // construction, and escrow learns reputation's address afterwards
        // via setReputationRegistry.
        identity = new AgentRelayIdentity();
        escrow = new AgentRelayEscrow(address(identity), address(validation), address(usdc));
        reputation = new AgentRelayReputation(address(identity), address(escrow));
        escrow.setReputationRegistry(address(reputation));

        usdc.mint(requester, 10 * BOUNTY);
    }

    // --- Identity ---

    function test_RegisterAgent_AssignsSequentialIds() public {
        vm.prank(requester);
        uint256 firstId = identity.registerAgent("ipfs://agent-a");

        vm.prank(claimant);
        uint256 secondId = identity.registerAgent("ipfs://agent-b");

        assertEq(firstId, 0);
        assertEq(secondId, 1);
        assertEq(identity.ownerOf(firstId), requester);
        assertEq(identity.ownerOf(secondId), claimant);
        assertTrue(identity.isRegistered(firstId));
    }

    function test_IsRegistered_FalseForUnusedId() public view {
        assertFalse(identity.isRegistered(999));
    }

    function test_UpdateMetadata_RevertsForNonOwner() public {
        vm.prank(requester);
        uint256 agentId = identity.registerAgent("ipfs://agent-a");

        vm.prank(stranger);
        vm.expectRevert(AgentRelayIdentity.NotAgentOwner.selector);
        identity.updateMetadata(agentId, "ipfs://hijacked");
    }

    // --- Full lifecycle ---

    function test_FullTaskLifecycle_PaysBountyAndUpdatesReputation() public {
        (uint256 requesterAgentId, uint256 claimantAgentId) = _registerBothAgents();
        uint256 taskId = _postTask(requesterAgentId);

        vm.prank(claimant);
        escrow.claimTask(taskId, claimantAgentId);

        vm.prank(claimant);
        escrow.submitProof(taskId, PROOF);

        uint256 claimantBalanceBefore = usdc.balanceOf(claimant);

        vm.prank(requester);
        escrow.validateAndComplete(taskId);

        assertEq(usdc.balanceOf(claimant), claimantBalanceBefore + BOUNTY);
        assertEq(reputation.averageScore(claimantAgentId), 100);

        (,,,,,,, AgentRelayEscrow.TaskStatus status) = escrow.tasks(taskId);
        assertEq(uint8(status), uint8(AgentRelayEscrow.TaskStatus.Completed));
    }

    function test_PostTask_EscrowsBountyImmediately() public {
        (uint256 requesterAgentId,) = _registerBothAgents();
        uint256 escrowBalanceBefore = usdc.balanceOf(address(escrow));

        _postTask(requesterAgentId);

        assertEq(usdc.balanceOf(address(escrow)), escrowBalanceBefore + BOUNTY);
    }

    // --- Validation failure ---

    function test_ValidateAndComplete_RevertsWhenProofInvalid() public {
        (uint256 requesterAgentId, uint256 claimantAgentId) = _registerBothAgents();
        uint256 taskId = _postTask(requesterAgentId);

        vm.prank(claimant);
        escrow.claimTask(taskId, claimantAgentId);
        vm.prank(claimant);
        escrow.submitProof(taskId, PROOF);

        validation.setShouldVerify(false);

        vm.prank(requester);
        vm.expectRevert(AgentRelayEscrow.ProofVerificationFailed.selector);
        escrow.validateAndComplete(taskId);
    }

    function test_FailedValidation_DoesNotPayOrRate() public {
        (uint256 requesterAgentId, uint256 claimantAgentId) = _registerBothAgents();
        uint256 taskId = _postTask(requesterAgentId);

        vm.prank(claimant);
        escrow.claimTask(taskId, claimantAgentId);
        vm.prank(claimant);
        escrow.submitProof(taskId, PROOF);

        validation.setShouldVerify(false);
        uint256 claimantBalanceBefore = usdc.balanceOf(claimant);

        vm.prank(requester);
        vm.expectRevert(AgentRelayEscrow.ProofVerificationFailed.selector);
        escrow.validateAndComplete(taskId);

        assertEq(usdc.balanceOf(claimant), claimantBalanceBefore);
        assertEq(reputation.averageScore(claimantAgentId), 0);
    }

    // --- Access control and state machine ---

    function test_SubmitProof_RevertsForNonClaimant() public {
        (uint256 requesterAgentId, uint256 claimantAgentId) = _registerBothAgents();
        uint256 taskId = _postTask(requesterAgentId);

        vm.prank(claimant);
        escrow.claimTask(taskId, claimantAgentId);

        vm.prank(stranger);
        vm.expectRevert(AgentRelayEscrow.NotTaskClaimant.selector);
        escrow.submitProof(taskId, PROOF);
    }

    function test_ValidateAndComplete_RevertsForNonRequester() public {
        (uint256 requesterAgentId, uint256 claimantAgentId) = _registerBothAgents();
        uint256 taskId = _postTask(requesterAgentId);

        vm.prank(claimant);
        escrow.claimTask(taskId, claimantAgentId);
        vm.prank(claimant);
        escrow.submitProof(taskId, PROOF);

        vm.prank(stranger);
        vm.expectRevert(AgentRelayEscrow.NotTaskRequester.selector);
        escrow.validateAndComplete(taskId);
    }

    function test_ClaimTask_RevertsWhenAlreadyClaimed() public {
        (uint256 requesterAgentId, uint256 claimantAgentId) = _registerBothAgents();
        uint256 taskId = _postTask(requesterAgentId);

        vm.prank(claimant);
        escrow.claimTask(taskId, claimantAgentId);

        vm.prank(stranger);
        vm.expectRevert(AgentRelayEscrow.TaskNotOpen.selector);
        escrow.claimTask(taskId, claimantAgentId);
    }

    function test_SubmitProof_RevertsWhenTaskNotClaimed() public {
        (uint256 requesterAgentId,) = _registerBothAgents();
        uint256 taskId = _postTask(requesterAgentId);

        vm.prank(claimant);
        vm.expectRevert(AgentRelayEscrow.TaskNotClaimed.selector);
        escrow.submitProof(taskId, PROOF);
    }

    function test_PostTask_RevertsForUnregisteredAgent() public {
        vm.startPrank(requester);
        usdc.approve(address(escrow), BOUNTY);
        vm.expectRevert(AgentRelayEscrow.AgentNotRegistered.selector);
        escrow.postTask(999, BOUNTY, EXPECTED_RESULT);
        vm.stopPrank();
    }

    // --- Dispute ---

    function test_DisputeTask_SetsDisputedStatus() public {
        (uint256 requesterAgentId, uint256 claimantAgentId) = _registerBothAgents();
        uint256 taskId = _postTask(requesterAgentId);

        vm.prank(claimant);
        escrow.claimTask(taskId, claimantAgentId);
        vm.prank(claimant);
        escrow.submitProof(taskId, PROOF);

        vm.prank(requester);
        escrow.disputeTask(taskId);

        (,,,,,,, AgentRelayEscrow.TaskStatus status) = escrow.tasks(taskId);
        assertEq(uint8(status), uint8(AgentRelayEscrow.TaskStatus.Disputed));
    }

    /// @notice Documents a known limitation rather than asserting desired
    /// behaviour: disputing does not refund the escrowed bounty, so the
    /// funds stay locked in the contract. Worth fixing before any real
    /// deployment; this test exists so the gap is visible, not hidden.
    function test_DisputeTask_DoesNotRefundBounty_KnownLimitation() public {
        (uint256 requesterAgentId, uint256 claimantAgentId) = _registerBothAgents();
        uint256 taskId = _postTask(requesterAgentId);

        vm.prank(claimant);
        escrow.claimTask(taskId, claimantAgentId);
        vm.prank(claimant);
        escrow.submitProof(taskId, PROOF);

        uint256 requesterBalanceBefore = usdc.balanceOf(requester);

        vm.prank(requester);
        escrow.disputeTask(taskId);

        assertEq(usdc.balanceOf(requester), requesterBalanceBefore);
        assertEq(usdc.balanceOf(address(escrow)), BOUNTY);
    }

    // --- Reputation access control ---

    function test_SubmitFeedback_RevertsForNonEscrowCaller() public {
        vm.prank(stranger);
        vm.expectRevert(AgentRelayReputation.NotAuthorized.selector);
        reputation.submitFeedback(0, 100);
    }

    function test_AverageScore_ZeroWhenNoRatings() public view {
        assertEq(reputation.averageScore(0), 0);
    }

    // --- Known gap, documented as a failing expectation ---

    /// @notice There is currently no check that msg.sender owns the agent
    /// identity it claims to act as, so any address can post or claim a
    /// task while impersonating any registered agent ID. This test proves
    /// the gap exists. It should be inverted to expectRevert once an
    /// ownership check is added to postTask and claimTask.
    function test_ClaimTask_AllowsImpersonatingAnotherAgent_KnownGap() public {
        (uint256 requesterAgentId, uint256 claimantAgentId) = _registerBothAgents();
        uint256 taskId = _postTask(requesterAgentId);

        // stranger does not own claimantAgentId, yet this succeeds.
        vm.prank(stranger);
        escrow.claimTask(taskId, claimantAgentId);

        (, uint256 storedClaimantAgentId,, address storedClaimant,,,,) = escrow.tasks(taskId);
        assertEq(storedClaimantAgentId, claimantAgentId);
        assertEq(storedClaimant, stranger);
    }

    // --- Helpers ---

    function _registerBothAgents() internal returns (uint256 requesterAgentId, uint256 claimantAgentId) {
        vm.prank(requester);
        requesterAgentId = identity.registerAgent("ipfs://requester-agent");
        vm.prank(claimant);
        claimantAgentId = identity.registerAgent("ipfs://claimant-agent");
    }

    function _postTask(uint256 requesterAgentId) internal returns (uint256 taskId) {
        vm.startPrank(requester);
        usdc.approve(address(escrow), BOUNTY);
        taskId = escrow.postTask(requesterAgentId, BOUNTY, EXPECTED_RESULT);
        vm.stopPrank();
    }
}
