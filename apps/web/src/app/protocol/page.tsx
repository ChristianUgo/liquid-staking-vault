import { ProtocolTelemetry } from '@/components/ProtocolTelemetry';

export default function ProtocolPage() { return <section className="page"><div className="pageHeader"><div className="eyebrow">Transparent accounting</div><h1>Protocol telemetry</h1><p className="lede">The protocol view separates solvency from liquidity so the queue never looks instant when backing is delegated.</p></div><ProtocolTelemetry /><div className="notice">Values are read from the verified Sepolia vault. Validator activity remains simulated.</div></section>; }
