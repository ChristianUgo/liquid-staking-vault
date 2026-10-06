'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return <button className="button buttonSecondary" onClick={() => disconnect()}>{address?.slice(0, 6)}…{address?.slice(-4)} · Disconnect</button>;
  }

  const connector = connectors[0];
  return <div className="walletControl">
    <button className="button" disabled={!connector || isPending} onClick={() => connector && connect({ connector })}>
      {isPending ? 'Connecting…' : 'Connect wallet'}
    </button>
    {error ? <span className="walletError" role="status">{error.message}</span> : null}
  </div>;
}
