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
      {/* Page Header Hero */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[11px] text-text-muted">
              <span className="font-semibold text-primary">MODULE 01</span>
              <span>/</span>
              <span>IDENTITY REGISTRY</span>
              <span>•</span>
              <span className="text-verified">STYLUS VERIFIED</span>
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Agent Registry
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              ERC-721 autonomous agent identities and verifiable on-chain reputation scores on Arbitrum Sepolia.
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            disabled={!isConnected}
            className="self-start sm:self-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-sm border border-primary/40 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
            </svg>
            <span>{showForm ? 'Cancel' : 'Register Agent'}</span>
          </button>
        </div>

        {/* Header Metadata Strip (Using Existing Data Only) */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4 font-mono text-xs">
          <div className="flex items-center gap-4 text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="text-text-muted">Total Identities:</span>
              <span className="font-bold text-text-primary tabular-nums">{agents.length}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span className="text-text-muted">Rated Agents:</span>
              <span className="font-bold text-text-primary tabular-nums">
                {agents.filter((a) => a.hasRatings).length}
              </span>
            </span>
          </div>
          <div className="text-[11px] text-text-muted">
            Contract: <span className="text-text-secondary font-mono">{truncateAddress(CONTRACTS.identity)}</span>
          </div>
        </div>
      </div>

      {/* Registration Form Modal/Card */}
      {showForm && (
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-border/80 bg-surface/95 p-6 shadow-xl backdrop-blur-sm">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-arbitrum to-transparent" />
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold text-text-primary">
              Register On-Chain Identity
            </h3>
            <p className="mt-0.5 text-xs text-text-secondary">
              Mints a new Agent ID via the Identity Registry contract on Arbitrum Sepolia.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex flex-1 rounded-xl border border-border bg-bg overflow-hidden focus-within:border-primary/80 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <span className="inline-flex items-center border-r border-border bg-surface-subtle px-3.5 font-mono text-xs text-text-muted select-none">
                URI
              </span>
              <input
                type="text"
                value={metadataURI}
                onChange={(e) => setMetadataURI(e.target.value)}
                placeholder="ipfs://bafkreia... or agent card endpoint"
                className="w-full bg-transparent px-3.5 py-2.5 font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <button
              onClick={handleRegister}
              disabled={isPending || isConfirming || !metadataURI.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-mono text-xs font-semibold text-white shadow-sm border border-primary/40 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {(isPending || isConfirming) && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              )}
              <span>
                {isPending
                  ? 'Confirming in Wallet...'
                  : isConfirming
                    ? 'Minting on Arbitrum...'
                    : 'Submit Identity'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Table Content */}
      {isLoading ? (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface/70 p-6 backdrop-blur-sm">
          <div className="space-y-4">
            <div className="h-4 w-48 animate-pulse rounded bg-border/40" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-surface-subtle" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-surface-subtle" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-surface-subtle" />
          </div>
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-2xl border border-border/80 bg-surface/60 p-12 text-center backdrop-blur-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/80 bg-surface-subtle text-text-muted">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="font-display text-sm font-semibold text-text-primary">No Agents Registered</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Connect your wallet and register the first autonomous agent identity.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface/70 shadow-xl shadow-black/20 backdrop-blur-sm">
          {/* Table Header Bar */}
          <div className="flex items-center justify-between border-b border-border/80 bg-[#0A0F1A]/90 px-6 py-3.5 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-text-secondary">
                Registry Entities
              </span>
              <span className="text-text-muted">•</span>
              <span className="flex items-center gap-1.5 text-verified">
                <span className="h-1.5 w-1.5 rounded-full bg-verified"></span>
                <span>Synced</span>
              </span>
            </div>
            <span className="text-text-muted">
              {agents.length} {agents.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px] text-left">
              <thead>
                <tr className="border-b border-border/80 bg-[#0B111D]/80 text-[11px] font-mono font-semibold uppercase tracking-wider text-text-secondary">
                  <th className="px-6 py-4">Agent ID</th>
                  <th className="px-6 py-4">Owner Address</th>
                  <th className="px-6 py-4">Metadata URI</th>
                  <th className="px-6 py-4">Reputation Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {agents.map((agent) => (
                  <tr
                    key={agent.agentId.toString()}
                    className="group transition-colors duration-150 hover:bg-[#131C2E]/60"
                  >
                    <td className="px-6 py-4.5">
                      <div className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary">
                        <span className="text-primary/60">#</span>
                        <span>{agent.agentId.toString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="inline-flex items-center gap-2 font-mono text-xs text-text-secondary group-hover:text-text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-arbitrum"></span>
                        <span className="tracking-tight">{truncateAddress(agent.owner)}</span>
                      </div>
                    </td>
                    <td className="max-w-xs truncate px-6 py-4.5 sm:max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 rounded border border-border/60 bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase text-text-muted">
                          {agent.metadataURI.startsWith('ipfs://') ? 'IPFS' : 'URI'}
                        </span>
                        <span
                          className="truncate font-mono text-xs text-text-secondary/90 group-hover:text-text-primary"
                          title={agent.metadataURI}
                        >
                          {agent.metadataURI}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <ReputationScore score={agent.reputationScore} hasRatings={agent.hasRatings} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Grounding Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border/80 bg-[#0A0F1A]/90 px-6 py-3 text-xs font-mono text-text-muted">
            <span>IdentityRegistry on Arbitrum Sepolia (Chain ID 421614)</span>
            <span>All {agents.length} entries active</span>
          </div>
        </div>
      )}
    </div>
  );
}
