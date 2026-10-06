'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatEther, isAddress } from 'viem';
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { WithdrawalQueueABI, getDeployment, isConfiguredAddress } from '@/lib/contracts';

type RequestRecord = readonly [
  `0x${string}`,
  bigint,
  bigint,
  bigint,
  boolean,
  boolean,
];

function normalizeRequest(value: unknown): RequestRecord | undefined {
  if (Array.isArray(value)) return value as RequestRecord;
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<Record<'owner' | 'shares' | 'requestTimestamp' | 'claimableAssets' | 'finalized' | 'claimed', unknown>>;
  if (typeof candidate.owner !== 'string' || typeof candidate.shares !== 'bigint' || typeof candidate.requestTimestamp !== 'bigint' || typeof candidate.claimableAssets !== 'bigint' || typeof candidate.finalized !== 'boolean' || typeof candidate.claimed !== 'boolean') return undefined;
  return [candidate.owner as `0x${string}`, candidate.shares, candidate.requestTimestamp, candidate.claimableAssets, candidate.finalized, candidate.claimed];
}

export function OperatorTools() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const deployment = getDeployment(chainId);
  const queue = deployment?.withdrawalQueue;
  const enabled = Boolean(isConfiguredAddress(queue));
  const [requestIdInput, setRequestIdInput] = useState('');
  const [maxRequestsInput, setMaxRequestsInput] = useState('1');
  const [receiver, setReceiver] = useState('');
  const [error, setError] = useState('');
  const [action, setAction] = useState<'finalize' | 'claim' | null>(null);
  const [hasAutoSelectedLatest, setHasAutoSelectedLatest] = useState(false);

  const requestId = useMemo(() => {
    try {
      if (!requestIdInput.trim()) return undefined;
      const value = BigInt(requestIdInput);
      return value > 0n ? value : undefined;
    } catch {
      return undefined;
    }
  }, [requestIdInput]);
  const maxRequests = useMemo(() => {
    try {
      if (!maxRequestsInput.trim()) return 0n;
      const value = BigInt(maxRequestsInput);
      return value > 0n ? value : 0n;
    } catch {
      return 0n;
    }
  }, [maxRequestsInput]);

  const { data: nextRequestId, refetch: refetchNextRequestId } = useReadContract({
    address: queue,
    abi: WithdrawalQueueABI,
    functionName: 'nextRequestId',
    query: { enabled },
  });
  const { data: queueOwner } = useReadContract({
    address: queue,
    abi: WithdrawalQueueABI,
    functionName: 'owner',
    query: { enabled },
  });
  const { data: status, isLoading: isLoadingStatus, isFetching: isFetchingStatus, refetch: refetchStatus } = useReadContract({
    address: queue,
    abi: WithdrawalQueueABI,
    functionName: 'requestStatus',
    args: requestId !== undefined ? [requestId] : undefined,
    query: { enabled: enabled && requestId !== undefined },
  });
  const { data: hash, writeContract, isPending, error: writeError, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash });
  const request = normalizeRequest(status);
  const isOwner = Boolean(address && typeof queueOwner === 'string' && address.toLowerCase() === queueOwner.toLowerCase());
  const connectedReceiver = receiver || address || '';

  useEffect(() => {
    if (!hasAutoSelectedLatest && nextRequestId !== undefined && nextRequestId > 1n) {
      setRequestIdInput((nextRequestId - 1n).toString());
      setHasAutoSelectedLatest(true);
    }
  }, [hasAutoSelectedLatest, nextRequestId]);

  useEffect(() => {
    if (!isSuccess) return;
    void refetchStatus();
    void refetchNextRequestId();
  }, [isSuccess, refetchNextRequestId, refetchStatus]);

  function finalize() {
    setError('');
    if (!isConnected) return setError('Connect the deployer wallet to finalize requests.');
    if (!isConfiguredAddress(queue) || !isOwner) return setError('Only the configured queue owner can finalize requests.');
    if (maxRequests <= 0n) return setError('Enter a max request count greater than zero.');
    reset();
    setAction('finalize');
    writeContract({ address: queue, abi: WithdrawalQueueABI, functionName: 'finalize', args: [maxRequests] });
  }

  function claim() {
    setError('');
    if (!isConnected || !address) return setError('Connect the wallet that owns this request.');
    if (!isConfiguredAddress(queue) || requestId === undefined) return setError('Enter a valid request ID first.');
    if (!isAddress(connectedReceiver)) return setError('Enter a valid claim receiver address.');
    if (!request || request[0].toLowerCase() !== address.toLowerCase()) return setError('This wallet does not own the selected request.');
    if (!request[4]) return setError('Finalize this request before claiming it.');
    if (request[5]) return setError('This request has already been claimed.');
    reset();
    setAction('claim');
    writeContract({ address: queue, abi: WithdrawalQueueABI, functionName: 'claim', args: [requestId, connectedReceiver as `0x${string}`] });
  }

  return <section className="operatorTools" aria-labelledby="operator-tools-title">
    <div className="operatorHeader">
      <div>
        <div className="eyebrow">Self-contained demo control</div>
        <h2 id="operator-tools-title">Operator tools</h2>
      </div>
      <span className={isOwner ? 'ownerBadge' : 'mutedBadge'}>{isOwner ? 'Queue owner' : 'Read-only'}</span>
    </div>
    <p className="formHint">Use the deployer wallet to finalize after the 60-second delay. The request owner can then claim the finalized ETH.</p>

    <div className="operatorGrid">
      <div className="operatorField">
        <label htmlFor="request-id">Request ID</label>
        <input id="request-id" inputMode="numeric" placeholder="1" value={requestIdInput} onChange={(event) => setRequestIdInput(event.target.value)} />
        <span className="formHint">Latest: {typeof nextRequestId === 'bigint' && nextRequestId > 0n ? (nextRequestId - 1n).toString() : '—'}</span>
      </div>
      <div className="operatorField">
        <label htmlFor="max-requests">Finalize count</label>
        <input id="max-requests" inputMode="numeric" value={maxRequestsInput} onChange={(event) => setMaxRequestsInput(event.target.value)} />
        <span className="formHint">Owner-only action</span>
      </div>
    </div>

    <div className="operatorActions">
      <button className="button" onClick={finalize} disabled={isPending || isConfirming || !isOwner}>{isPending && action === 'finalize' ? 'Confirm in wallet…' : isConfirming && action === 'finalize' ? 'Finalizing…' : 'Finalize request'}</button>
      <button className="button buttonSecondary" onClick={() => void refetchStatus()} disabled={isFetchingStatus || requestId === undefined}>{isFetchingStatus ? 'Refreshing…' : 'Refresh status'}</button>
    </div>

    <div className="requestStatus" aria-live="polite">
      <strong>Request status</strong>
      {!requestId ? <span className="formHint">Enter a request ID to inspect it.</span> : isLoadingStatus || isFetchingStatus ? <span className="formHint">Reading the queue…</span> : !request || request[0] === '0x0000000000000000000000000000000000000000' ? <span className="formHint">No request found for this ID.</span> : <div className="statusList">
        <span>Owner <b>{request[0]}</b></span>
        <span>Shares <b>{formatEther(request[1])} blsETH</b></span>
        <span>Claimable <b>{formatEther(request[3])} ETH</b></span>
        <span>State <b>{request[5] ? 'Claimed' : request[4] ? 'Finalized · ready to claim' : 'Queued · waiting for finalization'}</b></span>
      </div>}
    </div>

    <div className="operatorField claimField">
      <label htmlFor="claim-receiver">Claim receiver</label>
      <input id="claim-receiver" inputMode="text" placeholder={address ?? '0x…'} value={receiver} onChange={(event) => setReceiver(event.target.value)} />
    </div>
    <button className="button buttonSecondary" onClick={claim} disabled={isPending || isConfirming || !request || !request[4] || request[5]}>{isPending && action === 'claim' ? 'Confirm in wallet…' : isConfirming && action === 'claim' ? 'Claiming…' : 'Claim finalized ETH'}</button>

    {isSuccess && action === 'finalize' && <p className="success">Finalization confirmed. Refresh the request status.</p>}
    {isSuccess && action === 'claim' && <p className="success">Claim confirmed. The ETH has been sent to the receiver.</p>}
    {(error || writeError || receiptError) && <p className="error">{error || writeError?.message || receiptError?.message}</p>}
    {hash && <a className="textLink" href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">View operator transaction</a>}
  </section>;
}
