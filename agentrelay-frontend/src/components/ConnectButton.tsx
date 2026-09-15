import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { truncateAddress } from '../lib/format';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="rounded-lg border border-border bg-surface px-4 py-2 font-mono text-sm text-text-primary transition-colors hover:border-primary"
      >
        {truncateAddress(address)}
      </button>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      disabled={isPending}
      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
    >
      {isPending ? 'Connecting...' : 'Connect wallet'}
    </button>
  );
}
