import assert from 'node:assert';
import { SimulationEngine } from '../src/engine.ts';
import { SCENARIO_PRESETS } from '../src/presets.ts';

console.log('=== Running Simulation Engine Test Suite ===\n');

// Test 1: Initialization
{
  const engine = new SimulationEngine();
  assert.strictEqual(engine.state.idleWei, 10_000_000_000_000_000n, 'Seed deposit must be 0.01 ETH');
  assert.strictEqual(engine.state.totalBackingWei, 10_000_000_000_000_000n);
  assert.strictEqual(engine.state.totalShares, 10_000_000_000_000_000n);
  assert.strictEqual(engine.state.exchangeRateRay, 1_000_000_000_000_000_000n, 'Initial rate must be 1.0');
  console.log('✔ Test 1 Passed: Initial seed deposit and 1:1 rate verified.');
}

// Test 2: Deposit Share Math
{
  const engine = new SimulationEngine();
  const minted = engine.deposit(1_000_000_000_000_000_000n, 'Alice'); // 1 ETH
  assert.strictEqual(minted, 1_000_000_000_000_000_000n);
  assert.strictEqual(engine.state.totalBackingWei, 1_010_000_000_000_000_000n);
  assert.strictEqual(engine.state.totalShares, 1_010_000_000_000_000_000n);
  assert.strictEqual(engine.state.exchangeRateRay, 1_000_000_000_000_000_000n);
  console.log('✔ Test 2 Passed: Deposit share calculation matches floor(d * S / A).');
}

// Test 3: Allocation Conservation (A = B + D)
{
  const engine = new SimulationEngine();
  engine.deposit(10_000_000_000_000_000_000n);
  const backingBefore = engine.state.totalBackingWei;

  engine.allocateToAdapter(8_000_000_000_000_000_000n);
  assert.strictEqual(engine.state.idleWei, 2_010_000_000_000_000_000n);
  assert.strictEqual(engine.state.delegatedWei, 8_000_000_000_000_000_000n);
  assert.strictEqual(engine.state.totalBackingWei, backingBefore, 'Allocation must conserve A');

  engine.returnFromAdapter(5_000_000_000_000_000_000n);
  assert.strictEqual(engine.state.idleWei, 7_010_000_000_000_000_000n);
  assert.strictEqual(engine.state.delegatedWei, 3_000_000_000_000_000_000n);
  assert.strictEqual(engine.state.totalBackingWei, backingBefore, 'Return must conserve A');
  console.log('✔ Test 3 Passed: Conservation invariant A = B + D holds.');
}

// Test 4: Funded Rewards Increase Rate
{
  const engine = new SimulationEngine();
  engine.deposit(10_000_000_000_000_000_000n);
  engine.allocateToAdapter(8_000_000_000_000_000_000n);
  const rateBefore = engine.state.exchangeRateRay;

  engine.fundReward(1_000_000_000_000_000_000n); // +1 ETH
  assert.strictEqual(engine.state.totalBackingWei, 11_010_000_000_000_000_000n);
  assert.ok(engine.state.exchangeRateRay > rateBefore, 'Rate must increase on rewards');
  console.log('✔ Test 4 Passed: Funded rewards strictly increase exchange rate.');
}

// Test 5: Simulated Losses Decrease Rate
{
  const engine = new SimulationEngine();
  engine.deposit(10_000_000_000_000_000_000n);
  engine.allocateToAdapter(8_000_000_000_000_000_000n);

  engine.simulateLoss(2_000_000_000_000_000_000n); // -2 ETH
  assert.strictEqual(engine.state.delegatedWei, 6_000_000_000_000_000_000n);
  assert.strictEqual(engine.state.totalBackingWei, 8_010_000_000_000_000_000n);
  assert.ok(engine.state.exchangeRateRay < 1_000_000_000_000_000_000n, 'Rate must decrease on loss');
  console.log('✔ Test 5 Passed: Slashing losses strictly decrease exchange rate.');
}

// Test 6: Preset 1 (Normal Activity)
{
  const preset = SCENARIO_PRESETS[0];
  const engine = new SimulationEngine();
  const ledger = engine.runScenario(preset.events);
  assert.ok(ledger.length >= 6);
  assert.strictEqual(engine.state.completedClaimsCount, 1);
  assert.strictEqual(engine.state.reservedEscrowWei, 0n);
  console.log('✔ Test 6 Passed: Preset 1 (Normal Activity) completed.');
}

// Test 7: Preset 2 (Surge & Blocking)
{
  const preset = SCENARIO_PRESETS[1];
  const engine = new SimulationEngine();
  engine.runScenario(preset.events);
  assert.strictEqual(engine.state.completedClaimsCount, 1);
  console.log('✔ Test 7 Passed: Preset 2 (Withdrawal Surge) completed.');
}

// Test 8: Preset 3 (Loss Before Finalization)
{
  const preset = SCENARIO_PRESETS[2];
  const engine = new SimulationEngine();
  engine.runScenario(preset.events);
  const bobReq = engine.queue[0];
  assert.strictEqual(bobReq.finalized, true);
  assert.ok(bobReq.claimableWei < 20_000_000_000_000_000_000n, 'Bob shares must absorb loss');
  console.log('✔ Test 8 Passed: Preset 3 (Loss Before Finalization) proves fair loss sharing.');
}

// Test 9: Preset 4 (Loss After Finalization)
{
  const preset = SCENARIO_PRESETS[3];
  const engine = new SimulationEngine();
  engine.runScenario(preset.events);
  const carolReq = engine.queue[0];
  assert.strictEqual(carolReq.finalized, true);
  assert.strictEqual(carolReq.claimed, true);
  assert.strictEqual(carolReq.claimableWei, 10_000_000_000_000_000_000n, 'Carol claim preserved in escrow');
  console.log('✔ Test 9 Passed: Preset 4 (Loss After Finalization) proves escrow segregation.');
}

// Test 10: Preset 5 (Delayed Exit)
{
  const preset = SCENARIO_PRESETS[4];
  const engine = new SimulationEngine();
  engine.runScenario(preset.events);
  assert.strictEqual(engine.state.completedClaimsCount, 1);
  console.log('✔ Test 10 Passed: Preset 5 (Delayed Exit) completed.');
}

// Test 11: Preset 6 (Extreme Loss)
{
  const preset = SCENARIO_PRESETS[5];
  const engine = new SimulationEngine();
  engine.runScenario(preset.events);
  assert.ok(engine.state.totalBackingWei <= 10_000_000_000_000_000n);
  console.log('✔ Test 11 Passed: Preset 6 (Extreme Loss) successfully verified.');
}

console.log('\n=========================================');
console.log('ALL 11 SIMULATION ENGINE TESTS PASSED! 🚀');
console.log('=========================================');
