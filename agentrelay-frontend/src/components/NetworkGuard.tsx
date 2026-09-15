import { useAccount, useSwitchChain } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (isConnected && chainId !== arbitrumSepolia.id) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-pending bg-pending/10 p-8 text-center">
        <p className="text-sm font-medium text-text-primary">
          Wrong network. AgentRelay only works on Arbitrum Sepolia.
        </p>
        <button
          onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {isPending ? 'Switching...' : 'Switch to Arbitrum Sepolia'}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
