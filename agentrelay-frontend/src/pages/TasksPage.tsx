import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { stringToHex } from 'viem';
import { CONTRACTS, escrowAbi, erc20Abi } from '../config/contracts';
import { useTasks } from '../hooks/useTasks';
import { useAgents } from '../hooks/useAgents';
import { formatUsdc, truncateAddress } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';

export function TasksPage({ onSelectTask }: { onSelectTask: (taskId: bigint) => void }) {
  const { isConnected, address } = useAccount();
  const { tasks, isLoading, refetch, refetchTaskList } = useTasks();
  const { agents } = useAgents();
  // Only agents the connected wallet actually owns can post a task as
  // that agent, matching the contract's own ownership check.
  const myAgents = agents.filter((a) => a.owner.toLowerCase() === address?.toLowerCase());

  const [showForm, setShowForm] = useState(false);
  const [requesterAgentId, setRequesterAgentId] = useState('');
  const [bounty, setBounty] = useState('');
  const [description, setDescription] = useState('');
  const [step, setStep] = useState<'idle' | 'approving' | 'posting'>('idle');

  const { writeContractAsync } = useWriteContract();

  const handlePostTask = async () => {
    if (!requesterAgentId || !bounty || !description.trim()) return;
    const bountyRaw = BigInt(Math.round(Number(bounty) * 1_000_000));

    setStep('approving');
    await writeContractAsync({
      address: CONTRACTS.usdc,
      abi: erc20Abi,
      functionName: 'approve',
      args: [CONTRACTS.escrow, bountyRaw],
    });

    setStep('posting');
    await writeContractAsync({
      address: CONTRACTS.escrow,
      abi: escrowAbi,
      functionName: 'postTask',
      args: [BigInt(requesterAgentId), bountyRaw, stringToHex(description.trim())],
    });

    setStep('idle');
    setShowForm(false);
    setRequesterAgentId('');
    setBounty('');
    setDescription('');
    await refetchTaskList();
    setTimeout(refetch, 2000);
  };

  return (
    <div>
      {/* Page Header Hero */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[11px] text-text-muted">
              <span className="font-semibold text-primary">MODULE 02</span>
              <span>/</span>
              <span>ESCROW SETTLEMENT</span>
              <span>•</span>
              <span className="text-verified">STYLUS VERIFIED</span>
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Task Escrow Marketplace
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Verifiable work delegation secured by on-chain USDC escrow on Arbitrum Sepolia.
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            disabled={!isConnected || myAgents.length === 0}
            className="self-start sm:self-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-sm border border-primary/40 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
            </svg>
            <span>{showForm ? 'Cancel' : 'Post Task'}</span>
          </button>
        </div>

        {/* Header Metadata Strip (Using Existing Data Only) */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-4 text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="text-text-muted">Total Tasks:</span>
              <span className="font-bold text-text-primary tabular-nums">{tasks.length}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span className="text-text-muted">Open:</span>
              <span className="font-bold text-primary tabular-nums">
                {tasks.filter((t) => t.status === 'Open').length}
              </span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span className="text-text-muted">Active:</span>
              <span className="font-bold text-pending tabular-nums">
                {tasks.filter((t) => t.status === 'Claimed' || t.status === 'ProofSubmitted').length}
              </span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span className="text-text-muted">Settled:</span>
              <span className="font-bold text-verified tabular-nums">
                {tasks.filter((t) => t.status === 'Completed').length}
              </span>
            </span>
          </div>
          <div className="text-[11px] text-text-muted">
            Contract: <span className="text-text-secondary font-mono">{truncateAddress(CONTRACTS.escrow)}</span>
          </div>
        </div>
      </div>

      {isConnected && myAgents.length === 0 && (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-pending/30 bg-pending/10 px-4 py-3 text-xs text-pending">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Register an agent with this wallet first in the Agent Registry before posting an escrowed task.</span>
        </div>
      )}

      {/* Post Task Form */}
      {showForm && (
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-border/80 bg-surface/95 p-6 shadow-xl backdrop-blur-sm">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-arbitrum to-transparent" />
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold text-text-primary">
              Create Escrow Work Contract
            </h3>
            <p className="mt-0.5 text-xs text-text-secondary">
              Locks USDC into the escrow smart contract. Released upon verified Stylus proof or refunded if disputed.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-mono text-xs font-medium uppercase tracking-wider text-text-secondary">
                Requesting Agent
              </label>
              <select
                value={requesterAgentId}
                onChange={(e) => setRequesterAgentId(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 font-mono text-xs text-text-primary focus:border-primary/80 focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                <option value="">Select an agent you own</option>
                {myAgents.map((a) => (
                  <option key={a.agentId.toString()} value={a.agentId.toString()}>
                    Agent #{a.agentId.toString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-xs font-medium uppercase tracking-wider text-text-secondary">
                Escrow Bounty (USDC)
              </label>
              <div className="relative flex items-center rounded-xl border border-border bg-bg overflow-hidden focus-within:border-primary/80 focus-within:ring-1 focus-within:ring-primary/20">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bounty}
                  onChange={(e) => setBounty(e.target.value)}
                  placeholder="1.00"
                  className="w-full bg-transparent px-3 py-2.5 font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
                />
                <span className="mr-2 inline-flex items-center gap-1 rounded border border-[#233B5D] bg-[#101D2E] px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
                  USDC
                </span>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block font-mono text-xs font-medium uppercase tracking-wider text-text-secondary">
                Expected Result (Verification Target)
              </label>
              <p className="mb-2 font-mono text-[11px] text-text-muted">
                What the claimant agent must sign. The Stylus Rust contract verifies the ECDSA signature against this expected result.
              </p>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. rate-limited-api-call-result-v1"
                className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 font-mono text-xs text-text-primary placeholder:text-text-muted focus:border-primary/80 focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handlePostTask}
              disabled={step !== 'idle' || !requesterAgentId || !bounty || !description.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-mono text-xs font-semibold text-white shadow-sm border border-primary/40 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {step !== 'idle' && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              )}
              <span>
                {step === 'approving'
                  ? 'Step 1/2: Approving USDC...'
                  : step === 'posting'
                    ? 'Step 2/2: Depositing Escrow...'
                    : 'Deposit USDC & Create Task'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Tasks Table */}
      {isLoading ? (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface/70 p-6 backdrop-blur-sm">
          <div className="space-y-4">
            <div className="h-4 w-48 animate-pulse rounded bg-border/40" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-surface-subtle" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-surface-subtle" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-surface-subtle" />
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-border/80 bg-surface/60 p-12 text-center backdrop-blur-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/80 bg-surface-subtle text-text-muted">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="font-display text-sm font-semibold text-text-primary">No Tasks Posted</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Post the first task to escrow USDC and delegate work to registered agents.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface/70 shadow-xl shadow-black/20 backdrop-blur-sm">
          {/* Table Header Bar */}
          <div className="flex items-center justify-between border-b border-border/80 bg-[#0A0F1A]/90 px-6 py-3.5 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-text-secondary">
                Escrow Work Contracts
              </span>
              <span className="text-text-muted">•</span>
              <span className="flex items-center gap-1.5 text-verified">
                <span className="h-1.5 w-1.5 rounded-full bg-verified"></span>
                <span>Live State</span>
              </span>
            </div>
            <span className="text-text-muted">
              {tasks.length} {tasks.length === 1 ? 'Contract' : 'Contracts'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-border/80 bg-[#0B111D]/80 text-[11px] font-mono font-semibold uppercase tracking-wider text-text-secondary">
                  <th className="px-6 py-4">Task ID</th>
                  <th className="px-6 py-4">Requester Agent</th>
                  <th className="px-6 py-4">Escrow Bounty</th>
                  <th className="px-6 py-4">Lifecycle Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {tasks.map((task) => (
                  <tr
                    key={task.taskId.toString()}
                    className="group transition-colors duration-150 hover:bg-[#131C2E]/60"
                  >
                    <td className="px-6 py-4.5">
                      <div className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary">
                        <span className="text-primary/60">#</span>
                        <span>{task.taskId.toString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-2 font-mono text-xs text-text-secondary group-hover:text-text-primary">
                        <span className="text-text-muted">Agent</span>
                        <span className="font-semibold text-text-primary">#{task.requesterAgentId.toString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-xs font-bold tracking-tight text-text-primary tabular-nums">
                          {formatUsdc(task.bounty)}
                        </span>
                        <span className="inline-flex items-center rounded border border-[#233B5D] bg-[#101D2E] px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                          USDC
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-6 py-4.5 text-right">
                      <button
                        onClick={() => onSelectTask(task.taskId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-subtle px-3 py-1 font-mono text-xs font-medium text-text-secondary transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95"
                      >
                        <span>View</span>
                        <span className="text-xs transition-transform group-hover:translate-x-0.5">→</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Grounding Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border/80 bg-[#0A0F1A]/90 px-6 py-3 text-xs font-mono text-text-muted">
            <span>AgentRelayEscrow on Arbitrum Sepolia (Chain ID 421614)</span>
            <span>Non-custodial settlement • Stylus Rust verifier</span>
          </div>
        </div>
      )}
    </div>
  );
}
