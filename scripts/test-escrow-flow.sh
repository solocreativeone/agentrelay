#!/usr/bin/env bash
# Exercises the full AgentRelay task lifecycle end to end on Arbitrum Sepolia:
# register two agents, post a task, claim it, submit a real signed proof,
# validate it, and confirm the bounty actually paid out and reputation updated.
#
# One wallet plays both the requester and claimant agent for simplicity.
# Note: neither postTask nor claimTask currently verifies that msg.sender
# owns the agent identity NFT it claims to act as. That's a real gap worth
# closing before this goes further, but doesn't block proving the happy path.
set -euo pipefail

# --- Config ---
RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
IDENTITY="0x36953CbD5745291de7B91ce126eD238340c79434"
ESCROW="0x0B14D5bB0244A1D0A291318A9bf298579928a2C3"
REPUTATION="0x6F4da14334DAc0619838c74168E5A5aDAfd3C076"
VALIDATION="0xBF795A0cD8403A4802be33F1EFB53836FB89632B"
USDC="0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"
DEPLOYER_KEY="${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY in your shell}"
BOUNTY="1000000" # 1 USDC, 6 decimals

echo "=== Step 1: Register requester agent ==="
cast send "$IDENTITY" "registerAgent(string)" "ipfs://requester-agent-card" \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY"
REQUESTER_AGENT_ID=0

echo ""
echo "=== Step 2: Register claimant agent ==="
cast send "$IDENTITY" "registerAgent(string)" "ipfs://claimant-agent-card" \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY"
CLAIMANT_AGENT_ID=1

echo ""
echo "=== Step 3: Check USDC balance before approving ==="
BALANCE=$(cast call "$USDC" "balanceOf(address)(uint256)" "$(cast wallet address --private-key "$DEPLOYER_KEY")" --rpc-url "$RPC_URL")
echo "USDC balance: $BALANCE (need at least $BOUNTY)"
echo "If this is 0, get testnet USDC from https://faucet.circle.com/ before continuing."

echo ""
echo "=== Step 4: Approve escrow to spend the bounty ==="
cast send "$USDC" "approve(address,uint256)" "$ESCROW" "$BOUNTY" \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY"

echo ""
echo "=== Step 5: Register a throwaway signer as the trusted validator ==="
WALLET_OUTPUT=$(cast wallet new)
SIGNER_ADDRESS=$(echo "$WALLET_OUTPUT" | grep "Address:" | awk '{print $2}')
SIGNER_KEY=$(echo "$WALLET_OUTPUT" | grep "Private key:" | awk '{print $3}')
echo "Signer address: $SIGNER_ADDRESS"
cast send "$VALIDATION" "initialize(address)" "$SIGNER_ADDRESS" \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY"

echo ""
echo "=== Step 6: Post the task ==="
EXPECTED_RESULT_TEXT="api-call-result-hash-v1"
EXPECTED_RESULT_HEX=$(cast from-utf8 "$EXPECTED_RESULT_TEXT")
cast send "$ESCROW" "postTask(uint256,uint256,bytes)" "$REQUESTER_AGENT_ID" "$BOUNTY" "$EXPECTED_RESULT_HEX" \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY"
TASK_ID=0

echo ""
echo "=== Step 7: Claim the task ==="
cast send "$ESCROW" "claimTask(uint256,uint256)" "$TASK_ID" "$CLAIMANT_AGENT_ID" \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY"

echo ""
echo "=== Step 8: Generate and submit the completion proof ==="
MESSAGE_HASH=$(cast keccak "$EXPECTED_RESULT_HEX")
SIGNATURE=$(cast wallet sign --no-hash "$MESSAGE_HASH" --private-key "$SIGNER_KEY")
cast send "$ESCROW" "submitProof(uint256,bytes)" "$TASK_ID" "$SIGNATURE" \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY"

echo ""
echo "=== Step 9: Validate and complete, releasing payment ==="
CLAIMANT_BALANCE_BEFORE=$(cast call "$USDC" "balanceOf(address)(uint256)" "$(cast wallet address --private-key "$DEPLOYER_KEY")" --rpc-url "$RPC_URL" | awk '{print $1}')
cast send "$ESCROW" "validateAndComplete(uint256)" "$TASK_ID" \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY"
CLAIMANT_BALANCE_AFTER=$(cast call "$USDC" "balanceOf(address)(uint256)" "$(cast wallet address --private-key "$DEPLOYER_KEY")" --rpc-url "$RPC_URL" | awk '{print $1}')

echo ""
echo "=== Step 10: Confirm payout and reputation update ==="
echo "Balance before: $CLAIMANT_BALANCE_BEFORE"
echo "Balance after:  $CLAIMANT_BALANCE_AFTER"
REPUTATION_SCORE=$(cast call "$REPUTATION" "averageScore(uint256)(uint256)" "$CLAIMANT_AGENT_ID" --rpc-url "$RPC_URL" | awk '{print $1}')
echo "Claimant agent reputation score (expect 100): $REPUTATION_SCORE"

echo ""
if [ "$CLAIMANT_BALANCE_AFTER" -gt "$CLAIMANT_BALANCE_BEFORE" ] && [ "$REPUTATION_SCORE" = "100" ]; then
  echo "PASS: full task lifecycle works end to end."
else
  echo "UNEXPECTED: check balances and reputation score above."
fi
