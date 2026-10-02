import { useEffect, useState, useCallback } from 'react';
import { usePublicClient, useWatchContractEvent } from 'wagmi';
import { CONTRACTS, identityAbi, reputationAbi } from '../config/contracts';

// Agent IDs are sequential starting at 0. Rather than probing one at a
// time (each awaiting the previous network round trip before starting
// the next, which is slow), check a batch of IDs in parallel, then only
// continue to the next batch if that batch had at least one hit. This
// keeps the same "no block-range limit" benefit as before while cutting
// load time roughly by the batch size.
const BATCH_SIZE = 10;
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
    let batchStart = 0n;

    while (batchStart < MAX_AGENTS_TO_PROBE) {
      const batchIds = Array.from({ length: BATCH_SIZE }, (_, i) => batchStart + BigInt(i));
      const results = await Promise.all(
        batchIds.map((agentId) =>
          publicClient.readContract({
            address: CONTRACTS.identity,
            abi: identityAbi,
            functionName: 'isRegistered',
            args: [agentId],
          })
        )
      );

      let anyHitInBatch = false;
      results.forEach((isRegistered, i) => {
        if (isRegistered) {
          ids.push(batchIds[i]);
          anyHitInBatch = true;
        }
      });

      if (!anyHitInBatch) break;
      batchStart += BigInt(BATCH_SIZE);
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
