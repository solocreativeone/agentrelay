import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { truncateAddress } from '../lib/format';

export function ConnectButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="inline-flex items-center rounded-xl border border-border bg-surface/90 p-1 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-text-secondary border-r border-border/80">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-verified/50 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-verified"></span>
          </span>
          <span className="hidden sm:inline">{chain?.name ?? 'Arbitrum Sepolia'}</span>
        </div>
        <button
          onClick={() => disconnect()}
          title="Connected. Click to disconnect wallet"
          className="group flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-mono text-text-primary transition-colors hover:bg-disputed/10 hover:text-disputed"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-cyan-400 text-[9px] font-bold text-white shadow-inner">
            {address.slice(2, 4).toUpperCase()}
          </span>
          <span className="font-medium">{truncateAddress(address)}</span>
          <svg
            className="h-3 w-3 text-text-muted transition-colors group-hover:text-disputed"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm border border-primary/40 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      <span>{isPending ? 'Connecting...' : 'Connect Wallet'}</span>
    </button>
  );
}
