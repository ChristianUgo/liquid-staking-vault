'use client';

import { formatEther } from 'viem';
import { useAccount, useChainId, useReadContracts } from 'wagmi';
import { BeaconLiteVaultABI, getDeployment, isConfiguredAddress } from '@/lib/contracts';

export function PortfolioTelemetry() {
  const { address } = useAccount();
  const deployment = getDeployment(useChainId());
  const vault = deployment?.vault;
  const enabled = Boolean(address && isConfiguredAddress(vault));
  const { data, isLoading } = useReadContracts({
    contracts: enabled ? [
      { address: vault as `0x${string}`, abi: BeaconLiteVaultABI, functionName: 'balanceOf', args: [address as `0x${string}`] },
      { address: vault as `0x${string}`, abi: BeaconLiteVaultABI, functionName: 'totalBacking' },
      { address: vault as `0x${string}`, abi: BeaconLiteVaultABI, functionName: 'totalSupply' },
    ] : [],
    query: { enabled },
  });
  const shares = data?.[0]?.result;
  const backing = data?.[1]?.result;
  const supply = data?.[2]?.result;
  const estimated = typeof shares === 'bigint' && typeof backing === 'bigint' && typeof supply === 'bigint' && supply > 0n ? (shares * backing) / supply : undefined;
  return <div className="grid"><div className="card"><div className="label">blsETH balance</div><div className="metric">{!address ? '—' : isLoading ? '…' : typeof shares === 'bigint' ? formatEther(shares) : '—'}</div><p>Wallet connection required</p></div><div className="card"><div className="label">Estimated ETH</div><div className="metric">{typeof estimated === 'bigint' ? `${formatEther(estimated)} ETH` : '—'}</div><p>Uses the on-chain exchange rate</p></div><div className="card"><div className="label">Pending exits</div><div className="metric">—</div><p>Queue request history coming after finalization indexing</p></div></div>;
}
