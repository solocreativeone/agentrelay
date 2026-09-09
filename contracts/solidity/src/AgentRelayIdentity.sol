// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title AgentRelayIdentity
/// @notice Gives each AI agent a persistent onchain identity as an ERC-721 token.
/// @dev Simplified from the full ERC-8004 Identity Registry spec, scoped to what
///      this marketplace actually needs: a stable agent ID plus a metadata URI
///      pointing to an agent card (name, endpoints, capabilities). Using ERC-721
///      rather than a plain mapping means agent identities are transferable and
///      composable with existing wallet/NFT tooling, matching the ERC-8004 pattern.
contract AgentRelayIdentity is ERC721 {
    /// @dev Reverts when a caller tries to update metadata for an agent they do not own.
    error NotAgentOwner();

    /// @dev Reverts when querying an agent ID that has not been registered.
    error AgentNotRegistered();

    uint256 private _nextAgentId;

    /// @notice Maps agent ID to a URI describing the agent (endpoints, capabilities).
    mapping(uint256 agentId => string metadataURI) public agentMetadata;

    /// @notice Emitted when a new agent registers.
    event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI);

    /// @notice Emitted when an agent's metadata is updated.
    event AgentMetadataUpdated(uint256 indexed agentId, string metadataURI);

    constructor() ERC721("Agent Identity", "AGENT") {}

    /// @notice Registers a new agent identity and mints it to the caller.
    /// @param metadataURI Points to an agent card, for example an IPFS URI describing
    ///        the agent's name, supported endpoints, and capabilities.
    /// @return agentId The newly minted agent's ID.
    function registerAgent(string calldata metadataURI) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        agentMetadata[agentId] = metadataURI;
        emit AgentRegistered(agentId, msg.sender, metadataURI);
    }

    /// @notice Updates an existing agent's metadata. Only the current owner may call this.
    function updateMetadata(uint256 agentId, string calldata metadataURI) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        agentMetadata[agentId] = metadataURI;
        emit AgentMetadataUpdated(agentId, metadataURI);
    }

    /// @notice Returns true if the given agent ID has been registered.
    function isRegistered(uint256 agentId) public view returns (bool) {
        return _ownerOf(agentId) != address(0);
    }
}
