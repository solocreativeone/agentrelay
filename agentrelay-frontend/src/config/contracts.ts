// Real deployed AgentRelay contract addresses on Arbitrum Sepolia.
// If you redeploy any contract, update its address here, nowhere else.
export const CONTRACTS = {
  identity: '0x36953CbD5745291de7B91ce126eD238340c79434',
  escrow: '0xc148c4D951a8c15C1527d39171B2316ce2eB656d',
  reputation: '0x69A437f4C9D04Df206Cd435F8f603323f0d6aE67',
  validation: '0xBF795A0cD8403A4802be33F1EFB53836FB89632B',
  usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
} as const;

export const identityAbi = [
  {
    type: 'function',
    name: 'registerAgent',
    inputs: [{ name: 'metadataURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'agentMetadata',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
] as const;

export const escrowAbi = [
  {
    type: 'function',
    name: 'postTask',
    inputs: [
      { name: 'requesterAgentId', type: 'uint256' },
      { name: 'bounty', type: 'uint256' },
      { name: 'expectedResult', type: 'bytes' },
    ],
    outputs: [{ name: 'taskId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimTask',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'claimantAgentId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'submitProof',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'proof', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'validateAndComplete',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'disputeTask',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'tasks',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [
      { name: 'requesterAgentId', type: 'uint256' },
      { name: 'claimantAgentId', type: 'uint256' },
      { name: 'requester', type: 'address' },
      { name: 'claimant', type: 'address' },
      { name: 'bounty', type: 'uint256' },
      { name: 'expectedResult', type: 'bytes' },
      { name: 'submittedProof', type: 'bytes' },
      { name: 'status', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'TaskPosted',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'requesterAgentId', type: 'uint256', indexed: true },
      { name: 'bounty', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const reputationAbi = [
  {
    type: 'function',
    name: 'averageScore',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reputationOf',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'totalScore', type: 'uint256' },
      { name: 'ratingCount', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// Task status enum, matching AgentRelayEscrow.sol's TaskStatus exactly.
export const TASK_STATUS = ['Open', 'Claimed', 'ProofSubmitted', 'Completed', 'Disputed'] as const;
