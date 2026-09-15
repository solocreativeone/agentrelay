import { http, createConfig } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// The public Arbitrum Sepolia RPC is prone to CORS/rate-limit interference
// from some browser extensions. Set VITE_RPC_URL to a dedicated endpoint
// (e.g. a free Alchemy or Infura key) to avoid this in development or demos.
const rpcUrl = import.meta.env.VITE_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected()],
  transports: {
    [arbitrumSepolia.id]: http(rpcUrl),
  },
});
