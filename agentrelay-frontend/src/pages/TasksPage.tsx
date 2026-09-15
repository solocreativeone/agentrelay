import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { stringToHex } from 'viem';
import { CONTRACTS, escrowAbi, erc20Abi } from '../config/contracts';
import { useTasks } from '../hooks/useTasks';
import { useAgents } from '../hooks/useAgents';
import { formatUsdc } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';

export function TasksPage({ onSelectTask }: { onSelectTask: (taskId: bigint) => void }) {
  const { isConnected } = useAccount();
  const { tasks, isLoading, refetch, refetchTaskList } = useTasks();
  const { agents } = useAgents();
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-text-primary">Tasks</h2>
          <p className="mt-1 text-sm text-text-secondary">Delegated work, escrowed and paid on completion.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          disabled={!isConnected || agents.length === 0}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Post task
        </button>
      </div>

      {agents.length === 0 && isConnected && (
        <p className="mb-4 text-sm text-text-secondary">Register an agent first before posting a task.</p>
      )}

      {showForm && (
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-text-primary">Requesting agent</label>
            <select
              value={requesterAgentId}
              onChange={(e) => setRequesterAgentId(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
            >
              <option value="">Select an agent</option>
              {agents.map((a) => (
                <option key={a.agentId.toString()} value={a.agentId.toString()}>
                  Agent #{a.agentId.toString()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-text-primary">Bounty (USDC)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={bounty}
              onChange={(e) => setBounty(e.target.value)}
              placeholder="1.00"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-text-primary">Expected result</label>
            <p className="mb-2 text-xs text-text-secondary">
              What proof of completion should describe. The claimant's signed proof is checked against this.
            </p>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. rate-limited-api-call-result-v1"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
            />
          </div>
          <button
            onClick={handlePostTask}
            disabled={step !== 'idle' || !requesterAgentId || !bounty || !description.trim()}
            className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {step === 'approving' ? 'Approving USDC...' : step === 'posting' ? 'Posting task...' : 'Post task'}
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">No tasks posted yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Task ID</th>
                <th className="px-4 py-3 font-medium">Requester</th>
                <th className="px-4 py-3 font-medium">Bounty</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.taskId.toString()} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-text-primary">#{task.taskId.toString()}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">
                    Agent #{task.requesterAgentId.toString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-primary">{formatUsdc(task.bounty)} USDC</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onSelectTask(task.taskId)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
