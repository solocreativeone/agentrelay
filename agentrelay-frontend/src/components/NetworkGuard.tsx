import { useAccount, useSwitchChain } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (isConnected && chainId !== arbitrumSepolia.id) {
    return (
      <div className="mx-auto max-w-md my-12 overflow-hidden rounded-2xl border border-pending/30 bg-surface/90 p-8 text-center shadow-2xl backdrop-blur-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-pending/40 bg-pending/10 text-pending">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="font-display text-base font-semibold text-text-primary">Unsupported Network</h3>
        <p className="mt-1 text-xs text-text-secondary">
          AgentRelay smart contracts are deployed exclusively on Arbitrum Sepolia (Chain ID 421614).
        </p>
        <div className="mt-6">
          <button
            onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-mono text-xs font-semibold text-white shadow-sm border border-primary/40 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isPending && (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            )}
            <span>{isPending ? 'Switching Network...' : 'Switch to Arbitrum Sepolia'}</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
