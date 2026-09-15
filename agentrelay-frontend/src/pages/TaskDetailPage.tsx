import { useState, useEffect } from 'react';
import { useWriteContract, useAccount } from 'wagmi';
import { hexToString, keccak256 } from 'viem';
import { sign } from 'viem/accounts';
import { CONTRACTS, escrowAbi } from '../config/contracts';
import { useAgents } from '../hooks/useAgents';
import { useTasks, type Task } from '../hooks/useTasks';
import { formatUsdc, truncateAddress } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';

const STEPS = ['Posted', 'Claimed', 'Proof submitted', 'Validated', 'Paid'];

function stepIndexForStatus(status: Task['status']): number {
  switch (status) {
    case 'Open':
      return 0;
    case 'Claimed':
      return 1;
    case 'ProofSubmitted':
      return 2;
    case 'Completed':
      return 4;
    case 'Disputed':
      return 2;
    default:
      return 0;
  }
}

export function TaskDetailPage({ taskId, onBack }: { taskId: bigint; onBack: () => void }) {
  const { address } = useAccount();
  const { tasks, refetch } = useTasks();
  const { agents } = useAgents();
  const { writeContractAsync } = useWriteContract();
  const [claimantAgentId, setClaimantAgentId] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const task = tasks.find((t) => t.taskId === taskId);

  useEffect(() => {
    const interval = setInterval(refetch, 4000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (!task) {
    return (
      <div>
        <BackLink onBack={onBack} />
        <p className="mt-4 text-sm text-text-secondary">Loading task...</p>
      </div>
    );
  }

  const activeStep = stepIndexForStatus(task.status);
  const myAgents = agents.filter((a) => a.owner.toLowerCase() === address?.toLowerCase());

  const handleClaim = async () => {
    if (!claimantAgentId) return;
    setIsWorking(true);
    try {
      await writeContractAsync({
        address: CONTRACTS.escrow,
        abi: escrowAbi,
        functionName: 'claimTask',
        args: [task.taskId, BigInt(claimantAgentId)],
      });
      await refetch();
    } finally {
      setIsWorking(false);
    }
  };

  // Demo-only: signs keccak256(expectedResult) directly with a throwaway
  // key, to simulate the claimant agent producing proof of completion.
  // In a real deployment this signing happens inside the claimant agent's
  // own process, not here.
  //
  // This must use viem's raw `sign({ hash })`, not `signMessage`.
  // signMessage applies the EIP-191 prefix ("\x19Ethereum Signed
  // Message:\n..."), which is standard for wallet UX but does not match
  // what ValidationContract checks: a plain, unprefixed ECDSA signature
  // over keccak256(expected_result). Using signMessage here recovers to
  // the wrong address and every validation silently fails.
  const handleSubmitProof = async () => {
    setIsWorking(true);
    try {
      const privateKey = import.meta.env.VITE_DEMO_SIGNER_KEY as `0x${string}`;
      const messageHash = keccak256(task.expectedResult as `0x${string}`);
      const signature = await sign({ hash: messageHash, privateKey, to: 'hex' });
      await writeContractAsync({
        address: CONTRACTS.escrow,
        abi: escrowAbi,
        functionName: 'submitProof',
        args: [task.taskId, signature],
      });
      await refetch();
    } finally {
      setIsWorking(false);
    }
  };

  const handleValidate = async () => {
    setIsWorking(true);
    try {
      await writeContractAsync({
        address: CONTRACTS.escrow,
        abi: escrowAbi,
        functionName: 'validateAndComplete',
        args: [task.taskId],
      });
      await refetch();
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div>
      <BackLink onBack={onBack} />

      <div className="mt-4 mb-8 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-text-primary">Task #{task.taskId.toString()}</h2>
        <StatusBadge status={task.status} />
      </div>

      {/* Stepper: the hero interaction */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                    i <= activeStep
                      ? task.status === 'Disputed' && i === activeStep
                        ? 'bg-disputed text-white'
                        : 'bg-verified text-white'
                      : 'bg-border text-text-secondary'
                  }`}
                >
                  {i < activeStep ? '✓' : i + 1}
                </div>
                <span className="text-xs text-text-secondary">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-0.5 flex-1 ${i < activeStep ? 'bg-verified' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <DetailCard label="Requester" value={`Agent #${task.requesterAgentId.toString()}`} />
        <DetailCard label="Bounty" value={`${formatUsdc(task.bounty)} USDC`} mono />
        <DetailCard
          label="Claimant"
          value={task.claimant !== '0x0000000000000000000000000000000000000000' ? `Agent #${task.claimantAgentId.toString()} (${truncateAddress(task.claimant)})` : 'Not yet claimed'}
        />
        <DetailCard label="Expected result" value={safeHexToString(task.expectedResult)} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-md bg-verified/15 px-2.5 py-1 text-xs font-medium text-verified">
            Stylus verification
          </span>
          <span className="text-xs text-text-secondary">
            Proof is checked by a Rust contract doing native ECDSA recovery.
          </span>
        </div>

        {task.status === 'Open' && (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-text-primary">Claim as agent</label>
              <select
                value={claimantAgentId}
                onChange={(e) => setClaimantAgentId(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              >
                <option value="">Select an agent</option>
                {myAgents.map((a) => (
                  <option key={a.agentId.toString()} value={a.agentId.toString()}>
                    Agent #{a.agentId.toString()}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleClaim}
              disabled={!claimantAgentId || isWorking}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {isWorking ? 'Claiming...' : 'Claim task'}
            </button>
          </div>
        )}

        {task.status === 'Claimed' && (
          <button
            onClick={handleSubmitProof}
            disabled={isWorking}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {isWorking ? 'Submitting...' : 'Submit proof'}
          </button>
        )}

        {task.status === 'ProofSubmitted' && (
          <div className="flex gap-3">
            <button
              onClick={handleValidate}
              disabled={isWorking}
              className="rounded-lg bg-verified px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {isWorking ? 'Validating...' : 'Validate & complete'}
            </button>
            <button className="rounded-lg border border-disputed px-4 py-2 text-sm font-medium text-disputed transition-colors hover:bg-disputed/10">
              Dispute
            </button>
          </div>
        )}

        {task.status === 'Completed' && (
          <p className="text-sm text-verified">Task completed. Bounty paid, reputation updated.</p>
        )}
      </div>
    </div>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="text-sm text-text-secondary hover:text-text-primary">
      ← Back to tasks
    </button>
  );
}

function DetailCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-1 text-xs text-text-secondary">{label}</p>
      <p className={`text-sm text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function safeHexToString(hex: string): string {
  try {
    return hexToString(hex as `0x${string}`);
  } catch {
    return hex;
  }
}
