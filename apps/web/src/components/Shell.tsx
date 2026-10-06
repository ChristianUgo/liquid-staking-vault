import Link from 'next/link';
import type { ReactNode } from 'react';
import { WalletButton } from './WalletButton';

const links = [
  ['Stake', '/stake'], ['Withdraw', '/withdraw'], ['Portfolio', '/portfolio'],
  ['Protocol', '/protocol'], ['Simulator', '/simulator'], ['Docs', '/docs'],
];

export function Shell({ children }: { children: ReactNode }) {
  return <div className="siteShell">
    <header className="topbar">
      <Link href="/" className="brand"><span className="brandMark">B</span><span>Beacon Lite</span></Link>
      <nav aria-label="Primary navigation">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      <WalletButton />
    </header>
    <main>{children}</main>
    <footer className="footer"><span>Educational testnet project · Validator activity is simulated</span><span>blsETH · Sepolia</span></footer>
  </div>;
}
