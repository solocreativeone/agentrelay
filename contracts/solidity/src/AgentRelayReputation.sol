// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentRelayIdentity} from "./AgentRelayIdentity.sol";

/// @title AgentRelayReputation
/// @notice Records feedback for agents after task completion, so trust can be
///         checked before an agent is hired for a future task.
/// @dev Deliberately simple: an append-only list of scores per agent plus a
///      running average. The full ERC-8004 Reputation Registry supports richer
///      feedback schemas, but for a solo three-week build a bounded score with
///      an onchain average is enough to prove the mechanism end to end.
contract AgentRelayReputation {
    /// @dev Reverts when the caller is not the authorized TaskEscrow contract.
    error NotAuthorized();

    /// @dev Reverts when a score outside the 0 to 100 range is submitted.
    error InvalidScore();

    AgentRelayIdentity public immutable identityRegistry;

    /// @notice The only contract allowed to submit feedback, set once at deploy time.
    /// @dev Restricting writes to the TaskEscrow contract prevents agents from
    ///      rating themselves or colluding to inflate scores outside a real task flow.
    address public immutable taskEscrow;

    struct ReputationSummary {
        uint256 totalScore;
        uint256 ratingCount;
    }

    mapping(uint256 agentId => ReputationSummary summary) public reputationOf;

    event FeedbackSubmitted(uint256 indexed agentId, uint256 score, uint256 newAverage);

    constructor(address identityRegistryAddress, address taskEscrowAddress) {
        identityRegistry = AgentRelayIdentity(identityRegistryAddress);
        taskEscrow = taskEscrowAddress;
    }

    modifier onlyTaskEscrow() {
        if (msg.sender != taskEscrow) revert NotAuthorized();
        _;
    }

    /// @notice Submits a feedback score for an agent after a task completes.
    /// @param agentId The agent being rated.
    /// @param score A value from 0 to 100.
    function submitFeedback(uint256 agentId, uint256 score) external onlyTaskEscrow {
        if (score > 100) revert InvalidScore();

        ReputationSummary storage summary = reputationOf[agentId];
        summary.totalScore += score;
        summary.ratingCount += 1;

        emit FeedbackSubmitted(agentId, score, averageScore(agentId));
    }

    /// @notice Returns the agent's average score, or 0 if it has no ratings yet.
    function averageScore(uint256 agentId) public view returns (uint256) {
        ReputationSummary storage summary = reputationOf[agentId];
        if (summary.ratingCount == 0) return 0;
        return summary.totalScore / summary.ratingCount;
    }
}
