import Link from 'next/link';

export default function HomePage() {
  return <section className="hero">
    <div className="eyebrow">Educational liquid staking foundation</div>
    <h1>See what a staking receipt is worth under pressure.</h1>
    <p className="lede">Beacon Lite models ETH deposits, blsETH shares, simulated validator rewards, slashing losses and a delayed FIFO withdrawal queue in a small, inspectable system.</p>
    <div className="actions"><Link className="button" href="/simulator">Explore simulator</Link><Link className="button buttonSecondary" href="/stake">Open demo</Link></div>
    <div className="notice">Validator activity is simulated. Contracts are deployed on Sepolia for this portfolio demo.</div>
    <div className="grid"><div className="card"><div className="label">Backing model</div><div className="metric">A = B + D</div><p>Idle ETH plus delegated ETH backs every outstanding share.</p></div><div className="card"><div className="label">Share token</div><div className="metric">blsETH</div><p>Transferable receipt whose exchange rate moves with rewards and losses.</p></div><div className="card"><div className="label">Exit model</div><div className="metric">FIFO queue</div><p>Requests wait for the mock validator exit before claimable ETH is reserved.</p></div></div>
  </section>;
}
