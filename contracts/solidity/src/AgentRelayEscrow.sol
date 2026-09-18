// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgentRelayIdentity} from "./AgentRelayIdentity.sol";
import {AgentRelayReputation} from "./AgentRelayReputation.sol";

/// @notice Interface to the Stylus validation contract. Kept minimal so the
///         Solidity side does not need to know how proof verification works
///         internally, only that it returns true or false.
interface IValidationContract {
    function verifyProof(bytes calldata proof, bytes calldata expectedResult) external view returns (bool);
}

/// @title AgentRelayEscrow
/// @notice The core marketplace: agents post bounties for API calls they cannot
///         make themselves, other agents claim and complete them, and payment
///         releases from escrow once the completion proof is validated.
/// @dev Task state moves through a strict linear lifecycle (Open, Claimed,
///      ProofSubmitted, Completed, or Disputed) enforced with custom errors
///      rather than require strings, since custom errors are cheaper and give
///      callers a typed reason to handle programmatically.
contract AgentRelayEscrow {
    error TaskNotOpen();
    error TaskNotClaimed();
    error NotTaskClaimant();
    error NotTaskRequester();
    error ProofNotSubmitted();
    error ProofVerificationFailed();
    error AgentNotRegistered();
    error BountyTransferFailed();
    error NotAgentOwner();

    enum TaskStatus {
        Open,
        Claimed,
        ProofSubmitted,
        Completed,
        Disputed
    }

    struct Task {
        uint256 requesterAgentId;
        uint256 claimantAgentId;
        address requester;
        address claimant;
        uint256 bounty;
        bytes expectedResult;
        bytes submittedProof;
        TaskStatus status;
    }

    AgentRelayIdentity public immutable identityRegistry;
    AgentRelayReputation public reputationRegistry;
    IValidationContract public immutable validationContract;
    IERC20 public immutable bountyToken;

    uint256 private _nextTaskId;
    mapping(uint256 taskId => Task task) public tasks;

    event TaskPosted(uint256 indexed taskId, uint256 indexed requesterAgentId, uint256 bounty);
    event TaskClaimed(uint256 indexed taskId, uint256 indexed claimantAgentId);
    event ProofSubmitted(uint256 indexed taskId, bytes proof);
    event TaskCompleted(uint256 indexed taskId, uint256 indexed claimantAgentId, uint256 payout);
    event TaskDisputed(uint256 indexed taskId, uint256 refundedBounty);

    constructor(address identityRegistryAddress, address validationContractAddress, address bountyTokenAddress) {
        identityRegistry = AgentRelayIdentity(identityRegistryAddress);
        validationContract = IValidationContract(validationContractAddress);
        bountyToken = IERC20(bountyTokenAddress);
    }

    /// @notice Wired once after AgentRelayReputation is deployed, since it
    ///         needs this contract's address at its own construction time.
    ///         Deploy order is Identity, then Escrow, then Reputation, then
    ///         this setter.
    function setReputationRegistry(address reputationRegistryAddress) external {
        reputationRegistry = AgentRelayReputation(reputationRegistryAddress);
    }

    /// @dev Reverts unless msg.sender actually owns the given agent identity.
    ///      Without this, any address could post or claim tasks while
    ///      impersonating an agent it does not control.
    function _requireOwnsAgent(uint256 agentId) internal view {
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotAgentOwner();
    }

    /// @notice Posts a new task with a bounty held in escrow.
    /// @param requesterAgentId The identity of the posting agent. Caller must own it.
    /// @param bounty Amount of bountyToken to escrow, requires prior approval.
    /// @param expectedResult A hash or descriptor of what a valid completion proof must match.
    function postTask(uint256 requesterAgentId, uint256 bounty, bytes calldata expectedResult)
        external
        returns (uint256 taskId)
    {
        if (!identityRegistry.isRegistered(requesterAgentId)) revert AgentNotRegistered();
        _requireOwnsAgent(requesterAgentId);

        bool success = bountyToken.transferFrom(msg.sender, address(this), bounty);
        if (!success) revert BountyTransferFailed();

        taskId = _nextTaskId++;
        tasks[taskId] = Task({
            requesterAgentId: requesterAgentId,
            claimantAgentId: 0,
            requester: msg.sender,
            claimant: address(0),
            bounty: bounty,
            expectedResult: expectedResult,
            submittedProof: "",
            status: TaskStatus.Open
        });

        emit TaskPosted(taskId, requesterAgentId, bounty);
    }

    /// @notice Claims an open task on behalf of a registered agent the caller owns.
    function claimTask(uint256 taskId, uint256 claimantAgentId) external {
        Task storage task = tasks[taskId];
        if (task.status != TaskStatus.Open) revert TaskNotOpen();
        if (!identityRegistry.isRegistered(claimantAgentId)) revert AgentNotRegistered();
        _requireOwnsAgent(claimantAgentId);

        task.claimantAgentId = claimantAgentId;
        task.claimant = msg.sender;
        task.status = TaskStatus.Claimed;

        emit TaskClaimed(taskId, claimantAgentId);
    }

    /// @notice Submits proof of task completion. Only the claimant may call this.
    /// @param proof Opaque bytes passed to the Stylus validation contract, for
    ///        example a signed attestation or a Merkle proof of the API response.
    function submitProof(uint256 taskId, bytes calldata proof) external {
        Task storage task = tasks[taskId];
        if (task.status != TaskStatus.Claimed) revert TaskNotClaimed();
        if (msg.sender != task.claimant) revert NotTaskClaimant();

        task.submittedProof = proof;
        task.status = TaskStatus.ProofSubmitted;

        emit ProofSubmitted(taskId, proof);
    }

    /// @notice Validates the submitted proof and, if valid, releases the bounty
    ///         and records reputation. Verification is delegated to the Stylus
    ///         contract because signature and proof checks are cheaper there
    ///         than the equivalent Solidity implementation.
    function validateAndComplete(uint256 taskId) external {
        Task storage task = tasks[taskId];
        if (task.status != TaskStatus.ProofSubmitted) revert ProofNotSubmitted();
        if (msg.sender != task.requester) revert NotTaskRequester();

        bool isValid = validationContract.verifyProof(task.submittedProof, task.expectedResult);
        if (!isValid) revert ProofVerificationFailed();

        task.status = TaskStatus.Completed;

        bool success = bountyToken.transfer(task.claimant, task.bounty);
        if (!success) revert BountyTransferFailed();

        // A full score would likely factor in speed and dispute history; a flat
        // score of 100 on successful, verified completion is enough for the MVP.
        if (address(reputationRegistry) != address(0)) {
            reputationRegistry.submitFeedback(task.claimantAgentId, 100);
        }

        emit TaskCompleted(taskId, task.claimantAgentId, task.bounty);
    }

    /// @notice Lets the requester flag a task as disputed instead of validating it,
    ///         for example if the proof is present but the result is wrong.
    ///         Refunds the escrowed bounty back to the requester, since the
    ///         claimant never gets paid for disputed work.
    function disputeTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        if (task.status != TaskStatus.ProofSubmitted) revert ProofNotSubmitted();
        if (msg.sender != task.requester) revert NotTaskRequester();

        task.status = TaskStatus.Disputed;

        bool success = bountyToken.transfer(task.requester, task.bounty);
        if (!success) revert BountyTransferFailed();

        emit TaskDisputed(taskId, task.bounty);
    }
}
