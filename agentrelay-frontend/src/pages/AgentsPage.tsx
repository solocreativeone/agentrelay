import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS, identityAbi } from '../config/contracts';
import { useAgents } from '../hooks/useAgents';
import { truncateAddress } from '../lib/format';
import { ReputationScore } from '../components/ReputationScore';

export function AgentsPage() {
  const { isConnected } = useAccount();
  const { agents, isLoading, refetch } = useAgents();
  const [metadataURI, setMetadataURI] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleRegister = () => {
    if (!metadataURI.trim()) return;
    writeContract({
      address: CONTRACTS.identity,
      abi: identityAbi,
      functionName: 'registerAgent',
      args: [metadataURI.trim()],
    });
  };

  if (isSuccess && showForm) {
    setShowForm(false);
    setMetadataURI('');
    setTimeout(refetch, 1500);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-text-primary">Agents</h2>
          <p className="mt-1 text-sm text-text-secondary">Registered agent identities and their reputation.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          disabled={!isConnected}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Register agent
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5">
          <label className="mb-2 block text-sm font-medium text-text-primary">Metadata URI</label>
          <p className="mb-3 text-xs text-text-secondary">
            Points to an agent card describing name, endpoints, and capabilities. For a demo, any identifying string works.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={metadataURI}
              onChange={(e) => setMetadataURI(e.target.value)}
              placeholder="ipfs://my-agent-card"
              className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleRegister}
              disabled={isPending || isConfirming || !metadataURI.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {isPending || isConfirming ? 'Registering...' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading agents...</p>
      ) : agents.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">No agents registered yet. Register the first one above.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Agent ID</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Metadata</th>
                <th className="px-4 py-3 font-medium">Reputation</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.agentId.toString()} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-text-primary">#{agent.agentId.toString()}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{truncateAddress(agent.owner)}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-text-secondary">{agent.metadataURI}</td>
                  <td className="px-4 py-3">
                    <ReputationScore score={agent.reputationScore} hasRatings={agent.hasRatings} />
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
