'use client';

import { formatEther } from 'viem';
import { useChainId, useReadContracts } from 'wagmi';
import { BeaconLiteVaultABI, getDeployment, isConfiguredAddress } from '@/lib/contracts';

export function ProtocolTelemetry() {
  const deployment = getDeployment(useChainId());
  const vault = deployment?.vault;
  const enabled = isConfiguredAddress(vault);
  const { data, isLoading } = useReadContracts({
    contracts: enabled ? [
      { address: vault as `0x${string}`, abi: BeaconLiteVaultABI, functionName: 'totalBacking' },
      { address: vault as `0x${string}`, abi: BeaconLiteVaultABI, functionName: 'idleAssets' },
      { address: vault as `0x${string}`, abi: BeaconLiteVaultABI, functionName: 'delegatedAssets' },
    ] : [],
    query: { enabled },
  });
  const value = (index: number) => data?.[index]?.result;
  const display = (index: number) => typeof value(index) === 'bigint' ? `${formatEther(value(index) as bigint)} ETH` : '—';
  return <div className="grid"><div className="card"><div className="label">Total backing A</div><div className="metric">{isLoading ? '…' : display(0)}</div><p>B + D across active shares</p></div><div className="card"><div className="label">Idle B</div><div className="metric">{isLoading ? '…' : display(1)}</div><p>Available for finalization</p></div><div className="card"><div className="label">Delegated D</div><div className="metric">{isLoading ? '…' : display(2)}</div><p>Held by mock validator adapter</p></div></div>;
}
