import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { sepolia } from 'viem/chains';

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected({ target: 'metaMask' })],
  transports: { [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) },
  ssr: true,
});
