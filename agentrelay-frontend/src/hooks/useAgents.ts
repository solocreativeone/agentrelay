import { useEffect, useState, useCallback } from 'react';
import { usePublicClient, useWatchContractEvent } from 'wagmi';
import { CONTRACTS, identityAbi, reputationAbi } from '../config/contracts';

// Agent IDs are assigned sequentially starting at 0, so rather than
// scanning event history (which breaks once the deploy block is more than
// ~10,000 blocks behind "latest", a limit most RPC providers enforce and
// that a month-old contract blows past entirely), we just probe IDs
// directly. isRegistered() is a cheap read with no block-range limit.
const MAX_CONSECUTIVE_MISSES = 3;
const MAX_AGENTS_TO_PROBE = 200n;

export type Agent = {
  agentId: bigint;
  owner: string;
  metadataURI: string;
  reputationScore: number;
  hasRatings: boolean;
};

export function useAgents() {
  const publicClient = usePublicClient();
  const [agentIds, setAgentIds] = useState<bigint[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const probeAgentIds = useCallback(async () => {
    if (!publicClient) return;
    const ids: bigint[] = [];
    let consecutiveMisses = 0;
    let agentId = 0n;

    while (consecutiveMisses < MAX_CONSECUTIVE_MISSES && agentId < MAX_AGENTS_TO_PROBE) {
      const isRegistered = await publicClient.readContract({
        address: CONTRACTS.identity,
        abi: identityAbi,
        functionName: 'isRegistered',
        args: [agentId],
      });
      if (isRegistered) {
        ids.push(agentId);
        consecutiveMisses = 0;
      } else {
        consecutiveMisses++;
      }
      agentId++;
    }
    setAgentIds(ids);
  }, [publicClient]);

  useEffect(() => {
    probeAgentIds().finally(() => setIsLoading(false));
  }, [probeAgentIds]);

  // Live updates for newly registered agents still use the event watcher,
  // which only polls recent blocks (a small range), not full history.
  useWatchContractEvent({
    address: CONTRACTS.identity,
    abi: identityAbi,
    eventName: 'AgentRegistered',
    onLogs(logs) {
      const newIds = logs.map((log) => (log.args as { agentId: bigint }).agentId);
      setAgentIds((prev) => Array.from(new Set([...prev, ...newIds])).sort((a, b) => (a < b ? -1 : 1)));
    },
  });

  useEffect(() => {
    if (!publicClient || agentIds.length === 0) {
      setAgents([]);
      return;
    }

    let cancelled = false;

    async function loadDetails() {
      const results = await Promise.all(
        agentIds.map(async (agentId) => {
          const [owner, metadataURI, reputationData] = await Promise.all([
            publicClient!.readContract({
              address: CONTRACTS.identity,
              abi: identityAbi,
              functionName: 'ownerOf',
              args: [agentId],
            }),
            publicClient!.readContract({
              address: CONTRACTS.identity,
              abi: identityAbi,
              functionName: 'agentMetadata',
              args: [agentId],
            }),
            publicClient!.readContract({
              address: CONTRACTS.reputation,
              abi: reputationAbi,
              functionName: 'reputationOf',
              args: [agentId],
            }),
          ]);

          const [, ratingCount] = reputationData as [bigint, bigint];
          const score = await publicClient!.readContract({
            address: CONTRACTS.reputation,
            abi: reputationAbi,
            functionName: 'averageScore',
            args: [agentId],
          });

          return {
            agentId,
            owner: owner as string,
            metadataURI: metadataURI as string,
            reputationScore: Number(score),
            hasRatings: ratingCount > 0n,
          };
        })
      );

      if (!cancelled) {
        setAgents(results.sort((a, b) => (a.agentId < b.agentId ? -1 : 1)));
      }
    }

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [publicClient, agentIds]);

  return { agents, isLoading, refetch: probeAgentIds };
}
