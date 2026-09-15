import { useEffect, useState, useCallback } from 'react';
import { usePublicClient, useWatchContractEvent } from 'wagmi';
import { CONTRACTS, escrowAbi, TASK_STATUS } from '../config/contracts';

// Task IDs are assigned sequentially starting at 0, same reasoning as
// useAgents: probe directly rather than scan event history, since that
// breaks once the deploy block is more than ~10,000 blocks behind
// "latest". tasks(taskId) never reverts for an unused ID, it returns a
// zero-initialized struct, so a zero requester address is what marks a
// slot as not-yet-used, since postTask always requires a real funding
// transfer from a real msg.sender.
const MAX_CONSECUTIVE_MISSES = 3;
const MAX_TASKS_TO_PROBE = 500n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export type Task = {
  taskId: bigint;
  requesterAgentId: bigint;
  claimantAgentId: bigint;
  requester: string;
  claimant: string;
  bounty: bigint;
  expectedResult: string;
  submittedProof: string;
  status: (typeof TASK_STATUS)[number];
};

export function useTasks() {
  const publicClient = usePublicClient();
  const [taskIds, setTaskIds] = useState<bigint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const probeTaskIds = useCallback(async () => {
    if (!publicClient) return;
    const ids: bigint[] = [];
    let consecutiveMisses = 0;
    let taskId = 0n;

    while (consecutiveMisses < MAX_CONSECUTIVE_MISSES && taskId < MAX_TASKS_TO_PROBE) {
      const data = (await publicClient.readContract({
        address: CONTRACTS.escrow,
        abi: escrowAbi,
        functionName: 'tasks',
        args: [taskId],
      })) as readonly [bigint, bigint, string, string, bigint, string, string, number];

      const requester = data[2];
      if (requester.toLowerCase() !== ZERO_ADDRESS) {
        ids.push(taskId);
        consecutiveMisses = 0;
      } else {
        consecutiveMisses++;
      }
      taskId++;
    }
    setTaskIds(ids);
  }, [publicClient]);

  useEffect(() => {
    probeTaskIds().finally(() => setIsLoading(false));
  }, [probeTaskIds]);

  // Live updates for newly posted tasks still use the event watcher,
  // which only polls recent blocks (a small range), not full history.
  useWatchContractEvent({
    address: CONTRACTS.escrow,
    abi: escrowAbi,
    eventName: 'TaskPosted',
    onLogs(logs) {
      const newIds = logs.map((log) => (log.args as { taskId: bigint }).taskId);
      setTaskIds((prev) => Array.from(new Set([...prev, ...newIds])).sort((a, b) => (a < b ? -1 : 1)));
    },
  });

  const refetchTaskDetails = useCallback(async () => {
    if (!publicClient || taskIds.length === 0) {
      setTasks([]);
      return;
    }

    const results = await Promise.all(
      taskIds.map(async (taskId) => {
        const data = (await publicClient.readContract({
          address: CONTRACTS.escrow,
          abi: escrowAbi,
          functionName: 'tasks',
          args: [taskId],
        })) as readonly [bigint, bigint, string, string, bigint, string, string, number];

        const [requesterAgentId, claimantAgentId, requester, claimant, bounty, expectedResult, submittedProof, status] =
          data;

        return {
          taskId,
          requesterAgentId,
          claimantAgentId,
          requester,
          claimant,
          bounty,
          expectedResult,
          submittedProof,
          status: TASK_STATUS[status],
        };
      })
    );

    setTasks(results.sort((a, b) => (a.taskId < b.taskId ? -1 : 1)));
  }, [publicClient, taskIds]);

  useEffect(() => {
    refetchTaskDetails();
  }, [refetchTaskDetails]);

  return { tasks, isLoading, refetch: refetchTaskDetails, refetchTaskList: probeTaskIds };
}
