import { useState } from 'react';
import { useWriteContract, useAccount } from 'wagmi';
import { hexToString, keccak256 } from 'viem';
import { sign } from 'viem/accounts';
import { CONTRACTS, escrowAbi } from '../config/contracts';
import { useAgents } from '../hooks/useAgents';
import { useTasks, type Task } from '../hooks/useTasks';
import { formatUsdc, truncateAddress } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';

type TimelineStep = {
  label: string;
  state: 'done' | 'pending' | 'disputed';
};

// Reverted to deriving step state purely from the task's on-chain status,
// which is already fetched by useTasks with no extra calls. An earlier
// version tried to show a real timestamp per step by searching event
// history, but that search was a major source of RPC load and, under
// rate limiting, produced a confusing state: a checkmark (from the
// reliable status read) sitting next to text that still said "Pending"
// (from the failed event search). Reliability matters more than a
// timestamp today, so the event search is removed entirely for now.
function buildSteps(task: Task): TimelineStep[] {
  const statusIndex = (() => {
    switch (task.status) {
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
  })();

  const steps: TimelineStep[] = [
    { label: 'Posted', state: statusIndex >= 0 ? 'done' : 'pending' },
    { label: 'Claimed', state: statusIndex >= 1 ? 'done' : 'pending' },
    { label: 'Proof submitted', state: statusIndex >= 2 ? 'done' : 'pending' },
  ];

  if (task.status === 'Disputed') {
    steps.push({ label: 'Disputed', state: 'disputed' });
  } else {
    steps.push({ label: 'Validated', state: statusIndex >= 4 ? 'done' : 'pending' });
    steps.push({ label: 'Paid', state: statusIndex >= 4 ? 'done' : 'pending' });
  }

  return steps;
}

export function TaskDetailPage({ taskId, onBack }: { taskId: bigint; onBack: () => void }) {
  const { address } = useAccount();
  const { tasks, refetch } = useTasks();
  const { agents } = useAgents();
  const { writeContractAsync } = useWriteContract();
  const [claimantAgentId, setClaimantAgentId] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const task = tasks.find((t) => t.taskId === taskId);

  if (!task) {
    return (
      <div>
        <BackLink onBack={onBack} />
        <p className="mt-4 text-sm text-text-secondary">Loading task...</p>
      </div>
    );
  }

  const myAgents = agents.filter((a) => a.owner.toLowerCase() === address?.toLowerCase());
  const steps = buildSteps(task);

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
  // Uses viem's raw sign({ hash }), not signMessage, since
  // ValidationContract expects an unprefixed signature.
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

  const handleDispute = async () => {
    setIsWorking(true);
    try {
      await writeContractAsync({
        address: CONTRACTS.escrow,
        abi: escrowAbi,
        functionName: 'disputeTask',
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

      {/* Header */}
      <div className="mt-4 mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary">
            <span>#TASK-{task.taskId.toString()}</span>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            Escrow Settlement
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={task.status} />
        </div>
      </div>

      {/* Main Grid: Stepper + Detail Cards */}
      <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_2fr]">
        {/* Timeline Stepper */}
        <div className="rounded-2xl border border-border/80 bg-surface/80 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Lifecycle Progress
            </span>
            <span className="font-mono text-[10px] text-text-secondary">Arbitrum L2</span>
          </div>
          <ol className="relative pl-1">
            {steps.map((step, i) => (
              <li key={step.label} className="relative pb-6 pl-8 last:pb-0">
                {i < steps.length - 1 && (
                  <span
                    className={`absolute left-[9px] top-5 h-full w-px transition-colors ${
                      step.state === 'done' ? 'bg-verified/70' : 'bg-border/60'
                    }`}
                  />
                )}
                <span
                  className={`absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                    step.state === 'done'
                      ? 'bg-verified text-white ring-4 ring-verified/20'
                      : step.state === 'disputed'
                        ? 'bg-disputed text-white ring-4 ring-disputed/20'
                        : 'border border-border/80 bg-surface-subtle text-text-muted'
                  }`}
                >
                  {step.state === 'done' ? '✓' : step.state === 'disputed' ? '✕' : ''}
                </span>
                <p
                  className={`text-sm font-medium leading-snug ${
                    step.state === 'pending' ? 'text-text-secondary' : 'text-text-primary font-semibold'
                  }`}
                >
                  {step.label}
                </p>
                <div className="mt-1">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                      step.state === 'done'
                        ? 'border border-verified/30 bg-verified/10 text-verified'
                        : step.state === 'disputed'
                          ? 'border border-disputed/30 bg-disputed/10 text-disputed'
                          : 'border border-border/50 bg-surface-subtle text-text-muted'
                    }`}
                  >
                    {step.state === 'done' ? 'Confirmed' : step.state === 'disputed' ? 'Disputed' : 'Pending'}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Detail Cards */}
        <div className="grid grid-cols-1 gap-4 content-start sm:grid-cols-2">
          <DetailCard
            label="Requester Identity"
            value={`Agent #${task.requesterAgentId.toString()}`}
            badge="Origin"
            mono
          />
          <DetailCard
            label="Escrow Bounty"
            value={`${formatUsdc(task.bounty)} USDC`}
            badge="Locked in Escrow"
            isBounty
            mono
          />
          <DetailCard
            label="Claimant Identity"
            value={
              task.claimant !== '0x0000000000000000000000000000000000000000'
                ? `Agent #${task.claimantAgentId.toString()} (${truncateAddress(task.claimant)})`
                : 'Not yet claimed'
            }
            badge="Assigned"
            mono
          />
          <DetailCard
            label="Expected Result"
            value={safeHexToString(task.expectedResult)}
            badge="Verification Target"
            mono
          />
        </div>
      </div>

      {/* Stylus Native Verifier & Action Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface/80 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-verified via-arbitrum to-transparent" />
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg border border-verified/30 bg-verified/10 px-3 py-1 text-xs font-semibold text-verified">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 1L12 3V6.5C12 9.5 9.9 11.7 7 12.5C4.1 11.7 2 9.5 2 6.5V3L7 1Z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
                <path d="M4.7 7L6.3 8.6L9.3 5.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Arbitrum Stylus Verified</span>
            </span>
          </div>
          <span className="font-mono text-xs text-text-secondary">
            Proof is verified by Rust contract doing native ECDSA recovery.
          </span>
        </div>

        {task.status === 'Open' && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block font-mono text-xs font-medium uppercase tracking-wider text-text-secondary">
                Claim as Agent
              </label>
              <select
                value={claimantAgentId}
                onChange={(e) => setClaimantAgentId(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 font-mono text-xs text-text-primary focus:border-primary/80 focus:outline-none focus:ring-1 focus:ring-primary/20"
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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-mono text-xs font-semibold text-white shadow-sm border border-primary/40 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isWorking && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              )}
              <span>{isWorking ? 'Claiming Task...' : 'Claim Task'}</span>
            </button>
          </div>
        )}

        {task.status === 'Claimed' && (
          <div>
            <button
              onClick={handleSubmitProof}
              disabled={isWorking}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-mono text-xs font-semibold text-white shadow-sm border border-primary/40 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isWorking && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              )}
              <span>{isWorking ? 'Submitting Proof...' : 'Submit Verification Proof'}</span>
            </button>
          </div>
        )}

        {task.status === 'ProofSubmitted' && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleValidate}
              disabled={isWorking}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-verified px-5 py-2.5 font-mono text-xs font-semibold text-white shadow-sm border border-verified/40 hover:bg-verified-hover active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isWorking && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              )}
              <span>{isWorking ? 'Validating via Stylus...' : 'Validate & Complete (Stylus)'}</span>
            </button>
            <button
              onClick={handleDispute}
              disabled={isWorking}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-disputed/60 bg-disputed/10 px-5 py-2.5 font-mono text-xs font-semibold text-disputed transition-all hover:bg-disputed/20 active:scale-[0.98] disabled:opacity-50"
            >
              {isWorking && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              )}
              <span>{isWorking ? 'Disputing Task...' : 'Dispute Task'}</span>
            </button>
          </div>
        )}

        {task.status === 'Completed' && (
          <div className="flex items-center gap-2.5 rounded-xl border border-verified/30 bg-verified/10 p-4 text-xs font-mono text-verified">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Task completed and verified by Stylus. Bounty paid, on-chain reputation incremented.</span>
          </div>
        )}

        {task.status === 'Disputed' && (
          <div className="flex items-center gap-2.5 rounded-xl border border-disputed/30 bg-disputed/10 p-4 text-xs font-mono text-disputed">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Task disputed. The escrowed bounty has been refunded to the requester.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="group inline-flex items-center gap-1.5 font-mono text-xs text-text-secondary transition-colors hover:text-text-primary"
    >
      <span className="transition-transform group-hover:-translate-x-1">←</span>
      <span>Back to Escrow Tasks</span>
    </button>
  );
}

function DetailCard({
  label,
  value,
  badge,
  isBounty,
  mono,
}: {
  label: string;
  value: string;
  badge?: string;
  isBounty?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-surface/80 p-4 shadow-sm backdrop-blur-sm">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </p>
        {badge && (
          <span className="rounded border border-border/60 bg-surface-subtle px-1.5 py-0.5 font-mono text-[9px] uppercase text-text-muted">
            {badge}
          </span>
        )}
      </div>
      {isBounty ? (
        <div className="flex items-center gap-2">
          <p className="font-mono text-base font-bold tracking-tight text-text-primary tabular-nums">
            {value.replace(' USDC', '')}
          </p>
          <span className="inline-flex items-center rounded border border-[#233B5D] bg-[#101D2E] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
            USDC
          </span>
        </div>
      ) : (
        <p className={`text-xs text-text-primary break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
      )}
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
