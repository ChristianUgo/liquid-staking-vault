'use client';

import { useMemo, useState } from 'react';
import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { BeaconLiteVaultABI, WithdrawalQueueABI, getDeployment, isConfiguredAddress } from '@/lib/contracts';

export function WithdrawForm() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const deployment = getDeployment(chainId);
  const vault = deployment?.vault;
  const queue = deployment?.withdrawalQueue;
  const [shares, setShares] = useState('');
  const [error, setError] = useState('');
  const { data: balance } = useReadContract({ address: vault, abi: BeaconLiteVaultABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: Boolean(isConfiguredAddress(vault) && address) } });
  const { data: allowance } = useReadContract({ address: vault, abi: BeaconLiteVaultABI, functionName: 'allowance', args: address && isConfiguredAddress(queue) ? [address, queue] : undefined, query: { enabled: Boolean(isConfiguredAddress(vault) && isConfiguredAddress(queue) && address) } });
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const requested = useMemo(() => { try { return shares ? parseUnits(shares, 18) : 0n; } catch { return 0n; } }, [shares]);

  function submit() {
    setError('');
    if (!address || !isConnected) return setError('Connect the wallet that owns the blsETH.');
    if (!isConfiguredAddress(vault) || !isConfiguredAddress(queue)) return setError('A verified Sepolia deployment is not configured yet.');
    if (requested <= 0n) return setError('Enter a blsETH amount greater than zero.');
    if (typeof balance === 'bigint' && requested > balance) return setError('Amount exceeds your blsETH balance.');
    const needsApproval = typeof allowance !== 'bigint' || allowance < requested;
    if (needsApproval) {
      writeContract({ address: vault, abi: BeaconLiteVaultABI, functionName: 'approve', args: [queue, requested] });
    } else {
      writeContract({ address: queue, abi: WithdrawalQueueABI, functionName: 'requestWithdrawal', args: [requested] });
    }
  }

  return <div className="formStack">
    <label htmlFor="withdraw-shares">blsETH shares</label>
    <input id="withdraw-shares" inputMode="decimal" placeholder="0.01" value={shares} onChange={(event) => setShares(event.target.value)} />
    <div className="formHint">Wallet balance: {typeof balance === 'bigint' ? balance.toString() : '—'} raw shares</div>
    <button className="button" onClick={submit} disabled={isPending || isConfirming}>{isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : 'Approve / queue withdrawal'}</button>
    {isSuccess && <p className="success">Transaction confirmed. If this was approval, click again to queue the request.</p>}
    {error && <p className="error">{error}</p>}
    {hash && <a className="textLink" href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">View transaction</a>}
  </div>;
}
