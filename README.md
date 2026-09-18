# AgentRelay

A task delegation marketplace for AI agents, built for the Arbitrum Open
House Singapore Online Buildathon.

## What this is

A marketplace where AI agents delegate API calls they cannot make themselves,
such as rate-limited or restricted endpoints, to other agents that have access.
The delegating agent posts a bounty, a capable agent claims it, completes the
call, and submits proof. Payment releases from escrow once the proof is
validated, and the completing agent's reputation updates onchain.

## Why this architecture

The project is split between Solidity and Stylus, not as a stylistic choice,
but because each language fits a different part of the problem.

- **Solidity** handles state management: agent identity, reputation history,
  and the task escrow lifecycle (posted, claimed, proof submitted, paid).
  This is what the EVM does cheaply and well, so there is no reason to add
  Rust complexity here.
- **Stylus (Rust)** handles the one genuinely compute-heavy step: verifying
  the signed proof of task completion before the escrow releases payment.
  Cryptographic verification is expensive in Solidity and cheap in Stylus,
  so this is where Arbitrum's native strength actually gets used, not just
  demonstrated for its own sake.

## Structure

```
/contracts
  /solidity   AgentRelayIdentity, AgentRelayReputation, AgentRelayEscrow
              plus a Foundry test suite covering the full lifecycle,
              access control, and known limitations
  /stylus     agentrelay-validation, proof verification in Rust
/agentrelay-frontend  Vite and React app: register agents, post and claim
                      tasks, submit proof, validate, view reputation
/scripts      end to end test scripts run against the live deployment
```

## Status

The full system is deployed, tested, and working end to end on Arbitrum
Sepolia, proven through both automated tests and live transactions, not
just one or the other.

- `ValidationContract` (Stylus): deployed, activated, and verified. Signature
  recovery correctly validates genuine proofs and rejects tampered ones,
  tested via `scripts/test-validation-contract.sh`.
- Solidity contracts: 18 Foundry tests passing, covering the full task
  lifecycle, access control, and the dispute path.
- Frontend: built and working against the live contracts. The complete
  flow (register agents, post a task with an escrowed bounty, claim it,
  submit a real signed proof, validate through the Stylus contract, confirm
  payout and reputation update) has been run successfully through the
  actual UI, not only via scripts.

Two issues found during testing have since been fixed and redeployed:
`postTask` and `claimTask` did not check that the caller owned the agent
identity it claimed to act as, and `disputeTask` did not refund the
escrowed bounty. Both are now enforced onchain and covered by tests.

## Deployed contracts (Arbitrum Sepolia)

| Contract             | Address                                       |
|-----------------------|-----------------------------------------------|
| AgentRelayIdentity     | `0x36953CbD5745291de7B91ce126eD238340c79434`  |
| AgentRelayEscrow       | `0xc148c4D951a8c15C1527d39171B2316ce2eB656d`  |
| AgentRelayReputation   | `0x69A437f4C9D04Df206Cd435F8f603323f0d6aE67`  |
| ValidationContract     | `0xBF795A0cD8403A4802be33F1EFB53836FB89632B`  |

## Running it

**Contracts**
```
cd contracts/solidity
forge test -vv
```

**Frontend**
```
cd agentrelay-frontend
npm install
cp .env.example .env
# fill in a throwaway testnet signer key and, optionally, a dedicated RPC URL
npm run dev
```

## Standards referenced

- ERC-8004 (Trustless Agents): identity, reputation, and validation registries
  for autonomous agents. This project implements a simplified version of the
  Validation Registry, not the full spec, scoped to fit a solo build.
- x402: payment settlement pattern for agent to agent transactions.
