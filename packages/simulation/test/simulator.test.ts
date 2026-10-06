import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../src/engine';
import { SCENARIO_PRESETS } from '../src/presets';

describe('Beacon Lite Simulation Engine', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine();
  });

  it('initializes with seed deposit and 1:1 exchange rate', () => {
    expect(engine.state.idleWei).toBe(10_000_000_000_000_000n); // 0.01 ETH
    expect(engine.state.totalBackingWei).toBe(10_000_000_000_000_000n);
    expect(engine.state.totalShares).toBe(10_000_000_000_000_000n);
    expect(engine.state.exchangeRateRay).toBe(1_000_000_000_000_000_000n); // 1e18
  });

  it('mints shares correctly on initial deposits', () => {
    const minted = engine.deposit(1_000_000_000_000_000_000n); // 1 ETH
    expect(minted).toBe(1_000_000_000_000_000_000n);
    expect(engine.state.totalBackingWei).toBe(1_010_000_000_000_000_000n);
    expect(engine.state.totalShares).toBe(1_010_000_000_000_000_000n);
    expect(engine.state.exchangeRateRay).toBe(1_000_000_000_000_000_000n);
  });

  it('preserves total backing during allocations and returns', () => {
    engine.deposit(10_000_000_000_000_000_000n);
    const backingBefore = engine.state.totalBackingWei;

    engine.allocateToAdapter(8_000_000_000_000_000_000n);
    expect(engine.state.idleWei).toBe(2_010_000_000_000_000_000n);
    expect(engine.state.delegatedWei).toBe(8_000_000_000_000_000_000n);
    expect(engine.state.totalBackingWei).toBe(backingBefore);

    engine.returnFromAdapter(5_000_000_000_000_000_000n);
    expect(engine.state.idleWei).toBe(7_010_000_000_000_000_000n);
    expect(engine.state.delegatedWei).toBe(3_000_000_000_000_000_000n);
    expect(engine.state.totalBackingWei).toBe(backingBefore);
  });

  it('increases exchange rate on funded rewards', () => {
    engine.deposit(10_000_000_000_000_000_000n);
    engine.allocateToAdapter(8_000_000_000_000_000_000n);

    engine.fundReward(1_000_000_000_000_000_000n); // +1 ETH
    expect(engine.state.totalBackingWei).toBe(11_010_000_000_000_000_000n);
    expect(engine.state.totalShares).toBe(10_010_000_000_000_000_000n);
    expect(engine.state.exchangeRateRay).toBeGreaterThan(1_000_000_000_000_000_000n);
  });

  it('runs Preset 1 (Normal Activity) cleanly', () => {
    const preset = SCENARIO_PRESETS[0];
    const eng = new SimulationEngine();
    const ledger = eng.runScenario(preset.events);
    expect(ledger.length).toBeGreaterThan(5);
    expect(eng.state.completedClaimsCount).toBe(1);
    expect(eng.state.reservedEscrowWei).toBe(0n);
  });

  it('runs Preset 3 (Loss Before Finalization) and reflects loss in claimable amount', () => {
    const preset = SCENARIO_PRESETS[2];
    const eng = new SimulationEngine();
    eng.runScenario(preset.events);

    const bobReq = eng.queue[0];
    expect(bobReq.finalized).toBe(true);
    expect(bobReq.claimed).toBe(true);
    // Bob queued 8 shares when total was ~50 ETH backing, then 5 ETH slashed.
    // The claimable amount should be strictly less than 8 ETH.
    expect(bobReq.claimableWei).toBeLessThan(8_000_000_000_000_000_000n);
  });

  it('runs Preset 4 (Loss After Finalization) preserving escrowed ETH', () => {
    const preset = SCENARIO_PRESETS[3];
    const eng = new SimulationEngine();
    eng.runScenario(preset.events);

    const carolReq = eng.queue[0];
    expect(carolReq.finalized).toBe(true);
    expect(carolReq.claimed).toBe(true);
    // Carol finalized 10 shares before the 10 ETH slashing occurred
    // Her payout was locked in escrow at 10 ETH exactly
    expect(carolReq.claimableWei).toBe(10_000_000_000_000_000_000n);
  });

  it('rejects a withdrawal that exceeds the owner balance', () => {
    expect(() => engine.requestWithdrawal(1_000_000_000_000_000_000n, 'Alice')).toThrow(
      'Exceeds owner share balance'
    );
  });

  it('enforces the configured idle buffer when requested', () => {
    const guarded = new SimulationEngine({ enforceIdleBuffer: true });
    guarded.deposit(10_000_000_000_000_000_000n, 'Alice');
    expect(() => guarded.allocateToAdapter(9_100_000_000_000_000_000n)).toThrow('Must retain');
  });

  it('does not complete a scheduled exit before its delay', () => {
    engine.deposit(10_000_000_000_000_000_000n, 'Alice');
    engine.allocateToAdapter(5_000_000_000_000_000_000n);
    const exitId = engine.scheduleAdapterExit(2_000_000_000_000_000_000n, 60);
    expect(() => engine.completeAdapterExit(exitId)).toThrow('Delay not elapsed');
    engine.advanceTime(60);
    engine.completeAdapterExit(exitId);
    expect(engine.state.idleWei).toBe(7_010_000_000_000_000_000n);
  });
});
