#!/usr/bin/env bash
# Tests the deployed AgentRelay ValidationContract on Arbitrum Sepolia.
#
# What this proves: that verify_proof correctly returns true for a valid
# signature over the expected result, and false once that signature is
# tampered with. A clean build and a successful deploy only prove the code
# runs; this is the step that proves the logic is actually correct.
set -euo pipefail

# --- Config: fill these in before running ---
RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
CONTRACT="0xbf795a0cd8403a4802be33f1efb53836fb89632b"
DEPLOYER_KEY="${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY in your shell, e.g. export DEPLOYER_PRIVATE_KEY=0x...}"

# --- Step 1: generate a throwaway wallet to act as the "trusted signer" ---
# This does not need funds, it only ever signs messages offline.
echo "Generating throwaway signer wallet..."
WALLET_OUTPUT=$(cast wallet new)
SIGNER_ADDRESS=$(echo "$WALLET_OUTPUT" | grep "Address:" | awk '{print $2}')
SIGNER_KEY=$(echo "$WALLET_OUTPUT" | grep "Private key:" | awk '{print $3}')
echo "Signer address: $SIGNER_ADDRESS"

# --- Step 2: register this address as the contract's trusted signer ---
echo "Calling initialize($SIGNER_ADDRESS)..."
cast send "$CONTRACT" "initialize(address)" "$SIGNER_ADDRESS" \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY"

# --- Step 3: build a test "expected result" and its keccak256 hash ---
# This stands in for the hash of a real API response a claimant agent
# would produce after completing a delegated task.
EXPECTED_RESULT_TEXT="test-task-completion-proof"
EXPECTED_RESULT_HEX=$(cast from-utf8 "$EXPECTED_RESULT_TEXT")
MESSAGE_HASH=$(cast keccak "$EXPECTED_RESULT_HEX")
echo "Expected result: $EXPECTED_RESULT_TEXT"
echo "Message hash: $MESSAGE_HASH"

# --- Step 4: sign the raw hash directly (no EIP-191 prefix) ---
# --no-hash is required here: our contract recovers over the bare
# keccak256(expected_result), not an Ethereum Signed Message-prefixed hash.
SIGNATURE=$(cast wallet sign --no-hash "$MESSAGE_HASH" --private-key "$SIGNER_KEY")
echo "Signature: $SIGNATURE"

# --- Step 5: call verifyProof with the real signature, expect true ---
# set +e/-e brackets this call specifically: a revert here is diagnostic
# information we want to react to, not a reason for the whole script to
# die via set -e before we get a chance to retry with more gas.
echo ""
echo "Calling verifyProof with a VALID signature..."
set +e
RESULT=$(cast call "$CONTRACT" "verifyProof(bytes,bytes)(bool)" "$SIGNATURE" "$EXPECTED_RESULT_HEX" --rpc-url "$RPC_URL" 2>&1)
RESULT_STATUS=$?
set -e
echo "Result (expect true):  $RESULT"

if [ $RESULT_STATUS -ne 0 ]; then
  echo ""
  echo "Default call failed. Retrying with an explicit high gas limit,"
  echo "in case the default eth_call gas cap is too low for signature recovery..."
  set +e
  RESULT=$(cast call "$CONTRACT" "verifyProof(bytes,bytes)(bool)" "$SIGNATURE" "$EXPECTED_RESULT_HEX" --rpc-url "$RPC_URL" --gas-limit 30000000 2>&1)
  RESULT_STATUS=$?
  set -e
  echo "Result with --gas-limit 30000000 (expect true): $RESULT"
fi

# --- Step 6: tamper with the signature, confirm it now fails closed ---
# Flips the first byte after 0x, which corrupts r without changing the
# signature's length, so it exercises the actual recovery/comparison logic
# rather than just the length check at the top of verify_proof.
TAMPERED_SIGNATURE="0x00${SIGNATURE:4}"
echo ""
echo "Calling verifyProof with a TAMPERED signature..."
set +e
TAMPERED_RESULT=$(cast call "$CONTRACT" "verifyProof(bytes,bytes)(bool)" "$TAMPERED_SIGNATURE" "$EXPECTED_RESULT_HEX" --rpc-url "$RPC_URL" --gas-limit 30000000 2>&1)
set -e
echo "Result (expect false): $TAMPERED_RESULT"

echo ""
if [ "$RESULT" = "true" ] && [ "$TAMPERED_RESULT" = "false" ]; then
  echo "PASS: verify_proof behaves correctly."
else
  echo "UNEXPECTED: check the two results above against what was expected."
fi
