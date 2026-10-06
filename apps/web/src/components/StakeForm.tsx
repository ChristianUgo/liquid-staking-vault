'use client';

import { useMemo, useState } from 'react';
import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
import { BeaconLiteVaultABI, getDeployment, isConfiguredAddress } from '@/lib/contracts';

export function StakeForm() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const deployment = getDeployment(chainId);
  const vault = deployment?.vault;
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const parsedAmount = useMemo(() => {
    try { return amount ? parseEther(amount) : 0n; } catch { return 0n; }
  }, [amount]);
  const { data: previewShares } = useReadContract({
    address: vault,
    abi: BeaconLiteVaultABI,
    functionName: 'previewDeposit',
    args: parsedAmount > 0n ? [parsedAmount] : undefined,
    query: { enabled: Boolean(isConfiguredAddress(vault) && parsedAmount > 0n) },
  });
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function submit() {
    setError('');
    if (!address || !isConnected) return setError('Connect a Sepolia wallet first.');
    if (!isConfiguredAddress(vault)) return setError('A verified Sepolia deployment is not configured yet.');
    if (parsedAmount <= 0n) return setError('Enter an ETH amount greater than zero.');
    writeContract({
      address: vault,
      abi: BeaconLiteVaultABI,
      functionName: 'deposit',
      args: [address, typeof previewShares === 'bigint' ? previewShares : 0n, BigInt(Math.floor(Date.now() / 1000) + 900)],
      value: parsedAmount,
    });
  }

  return <div className="formStack">
    <label htmlFor="stake-amount">ETH amount</label>
    <input id="stake-amount" inputMode="decimal" placeholder="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
    <div className="formHint">Estimated blsETH: {typeof previewShares === 'bigint' ? previewShares.toString() : '—'}</div>
    <button className="button" onClick={submit} disabled={isPending || isConfirming}>{isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : 'Deposit ETH'}</button>
    {isSuccess && <p className="success">Deposit confirmed.</p>}
    {error && <p className="error">{error}</p>}
    {hash && <a className="textLink" href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">View transaction</a>}
  </div>;
}
