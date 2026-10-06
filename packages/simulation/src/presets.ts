import type { ScenarioPreset } from './types.ts';

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'preset-1-normal',
    title: '1. Normal Activity',
    description: 'Orderly user deposits, funded validator rewards, standard queue request, and prompt claim.',
    initialIdleWei: 10_000_000_000_000_000n, // Seed 0.01 ETH
    initialDelegatedWei: 0n,
    initialShares: 10_000_000_000_000_000n,
    events: [
      {
        type: 'DEPOSIT',
        actor: 'Alice',
        amountWei: 10_000_000_000_000_000_000n, // 10 ETH
        notes: 'Alice deposits 10 ETH',
      },
      {
        type: 'ALLOCATE_TO_ADAPTER',
        amountWei: 9_000_000_000_000_000_000n, // 9 ETH (90% to staking)
        notes: 'Allocate 90% idle to validator adapter',
      },
      {
        timeDeltaSeconds: 3600,
        type: 'REWARD',
        amountWei: 500_000_000_000_000_000n, // 0.5 ETH reward (5% gain)
        notes: 'Staking reward of 0.5 ETH generated',
      },
      {
        timeDeltaSeconds: 60,
        type: 'REQUEST_WITHDRAWAL',
        actor: 'Alice',
        shares: 800_000_000_000_000_000n, // 0.8 blsETH (~0.84 ETH, fits in 1.01 ETH idle buffer)
        notes: 'Alice requests withdrawal of 0.8 shares',
      },
      {
        timeDeltaSeconds: 120, // > 60s min delay
        type: 'FINALIZE_QUEUE',
        maxRequests: 5,
        notes: 'Keeper finalizes batch (covered by 1.01 ETH idle pool)',
      },
      {
        timeDeltaSeconds: 30,
        type: 'CLAIM_WITHDRAWAL',
        requestId: 1,
        actor: 'Alice',
        notes: 'Alice claims her escrowed ETH',
      },
    ],
  },
  {
    id: 'preset-2-surge',
    title: '2. Withdrawal Surge',
    description: '60% of total shares request exit simultaneously while 90% of backing is delegated, highlighting queue blocking until exit completion.',
    initialIdleWei: 10_000_000_000_000_000n,
    initialDelegatedWei: 0n,
    initialShares: 10_000_000_000_000_000n,
    events: [
      {
        type: 'DEPOSIT',
        actor: 'Whale',
        amountWei: 100_000_000_000_000_000_000n, // 100 ETH
        notes: 'Whale deposits 100 ETH',
      },
      {
        type: 'ALLOCATE_TO_ADAPTER',
        amountWei: 90_000_000_000_000_000_000n, // 90 ETH to adapter, 10 ETH idle
        notes: 'Allocate 90 ETH to validator adapter',
      },
      {
        timeDeltaSeconds: 60,
        type: 'REQUEST_WITHDRAWAL',
        actor: 'Whale',
        shares: 60_000_000_000_000_000_000n, // 60 shares (~60 ETH)
        notes: 'Withdrawal surge: Whale requests exit for 60 shares',
      },
      {
        timeDeltaSeconds: 120,
        type: 'FINALIZE_QUEUE',
        maxRequests: 5,
        notes: 'Attempt finalization: blocked because 60 ETH > 10 ETH idle buffer!',
      },
      {
        timeDeltaSeconds: 300,
        type: 'COMPLETE_ADAPTER_EXIT',
        amountWei: 55_000_000_000_000_000_000n, // 55 ETH returns from validator
        notes: 'Validator exit completes: returns 55 ETH to idle liquidity',
      },
      {
        timeDeltaSeconds: 10,
        type: 'FINALIZE_QUEUE',
        maxRequests: 5,
        notes: 'Finalization retried: successfully finalizes Whale request now that idle >= 60 ETH',
      },
      {
        timeDeltaSeconds: 20,
        type: 'CLAIM_WITHDRAWAL',
        requestId: 1,
        actor: 'Whale',
        notes: 'Whale claims 60 ETH',
      },
    ],
  },
  {
    id: 'preset-3-loss-before-finalization',
    title: '3. Loss Before Finalization',
    description: 'Slashing occurs while withdrawal is pending in queue. Proves queued shares share the loss.',
    initialIdleWei: 10_000_000_000_000_000n,
    initialDelegatedWei: 0n,
    initialShares: 10_000_000_000_000_000n,
    events: [
      {
        type: 'DEPOSIT',
        actor: 'Bob',
        amountWei: 50_000_000_000_000_000_000n, // 50 ETH
        notes: 'Bob deposits 50 ETH',
      },
      {
        type: 'ALLOCATE_TO_ADAPTER',
        amountWei: 40_000_000_000_000_000_000n, // 40 ETH delegated
        notes: 'Allocate 40 ETH to adapter',
      },
      {
        timeDeltaSeconds: 60,
        type: 'REQUEST_WITHDRAWAL',
        actor: 'Bob',
        shares: 8_000_000_000_000_000_000n, // 8 shares (~7.2 ETH, fits in 10.01 ETH idle buffer)
        notes: 'Bob queues 8 shares for exit',
      },
      {
        timeDeltaSeconds: 10,
        type: 'LOSS',
        amountWei: 5_000_000_000_000_000_000n, // 5 ETH slashing penalty
        notes: 'Validator slashed by 5 ETH while Bob is waiting in queue',
      },
      {
        timeDeltaSeconds: 100, // delay satisfied
        type: 'FINALIZE_QUEUE',
        maxRequests: 1,
        notes: 'Finalized: Bob receives reduced ETH reflecting the slashed rate',
      },
      {
        timeDeltaSeconds: 10,
        type: 'CLAIM_WITHDRAWAL',
        requestId: 1,
        actor: 'Bob',
        notes: 'Bob claims slashed ETH payout',
      },
    ],
  },
  {
    id: 'preset-4-loss-after-finalization',
    title: '4. Loss After Finalization',
    description: 'Slashing occurs AFTER finalization but before claim. Proves escrowed ETH is strictly segregated.',
    initialIdleWei: 10_000_000_000_000_000n,
    initialDelegatedWei: 0n,
    initialShares: 10_000_000_000_000_000n,
    events: [
      {
        type: 'DEPOSIT',
        actor: 'Carol',
        amountWei: 50_000_000_000_000_000_000n,
        notes: 'Carol deposits 50 ETH',
      },
      {
        type: 'ALLOCATE_TO_ADAPTER',
        amountWei: 30_000_000_000_000_000_000n, // 20 ETH idle remains
        notes: 'Delegate 30 ETH',
      },
      {
        timeDeltaSeconds: 60,
        type: 'REQUEST_WITHDRAWAL',
        actor: 'Carol',
        shares: 10_000_000_000_000_000_000n, // 10 shares
        notes: 'Carol queues 10 shares',
      },
      {
        timeDeltaSeconds: 70,
        type: 'FINALIZE_QUEUE',
        maxRequests: 1,
        notes: 'Carol request finalized into Escrow R (10 ETH locked)',
      },
      {
        timeDeltaSeconds: 10,
        type: 'LOSS',
        amountWei: 10_000_000_000_000_000_000n, // 10 ETH slashing on remaining active backing
        notes: 'Massive slashing event of 10 ETH hits validator adapter',
      },
      {
        timeDeltaSeconds: 10,
        type: 'CLAIM_WITHDRAWAL',
        requestId: 1,
        actor: 'Carol',
        notes: 'Carol claims 100% of her 10 ETH: completely unaffected by post-finalization slashing!',
      },
    ],
  },
  {
    id: 'preset-5-delayed-exit',
    title: '5. Delayed Adapter Exit',
    description: 'Solvent backing with insufficient immediate cash. Demonstrates liquidity rationing and solvency vs. liquidity.',
    initialIdleWei: 10_000_000_000_000_000n,
    initialDelegatedWei: 0n,
    initialShares: 10_000_000_000_000_000n,
    events: [
      {
        type: 'DEPOSIT',
        actor: 'Dave',
        amountWei: 20_000_000_000_000_000_000n,
        notes: 'Dave deposits 20 ETH',
      },
      {
        type: 'ALLOCATE_TO_ADAPTER',
        amountWei: 19_500_000_000_000_000_000n, // Only 0.5 ETH idle left
        notes: 'Over-allocated: 19.5 ETH delegated, 0.51 ETH idle',
      },
      {
        timeDeltaSeconds: 60,
        type: 'REQUEST_WITHDRAWAL',
        actor: 'Dave',
        shares: 5_000_000_000_000_000_000n, // 5 ETH requested
        notes: 'Dave requests 5 ETH exit',
      },
      {
        timeDeltaSeconds: 70,
        type: 'FINALIZE_QUEUE',
        maxRequests: 1,
        notes: 'Finalization fails: protocol is 100% solvent but illiquid',
      },
      {
        timeDeltaSeconds: 500,
        type: 'COMPLETE_ADAPTER_EXIT',
        amountWei: 10_000_000_000_000_000_000n,
        notes: 'Adapter exit completes and restores liquid buffer',
      },
      {
        timeDeltaSeconds: 10,
        type: 'FINALIZE_QUEUE',
        maxRequests: 1,
        notes: 'Queue finalization proceeds successfully',
      },
      {
        timeDeltaSeconds: 10,
        type: 'CLAIM_WITHDRAWAL',
        requestId: 1,
        actor: 'Dave',
        notes: 'Dave claims 5 ETH',
      },
    ],
  },
  {
    id: 'preset-6-extreme-loss',
    title: '6. Extreme Loss & Terminal State',
    description: 'Catastrophic slashing wipes 100% of delegated backing. Protocol transitions safely to terminal loss state.',
    initialIdleWei: 10_000_000_000_000_000n,
    initialDelegatedWei: 0n,
    initialShares: 10_000_000_000_000_000n,
    events: [
      {
        type: 'DEPOSIT',
        actor: 'Eve',
        amountWei: 10_000_000_000_000_000_000n,
        notes: 'Eve deposits 10 ETH',
      },
      {
        type: 'ALLOCATE_TO_ADAPTER',
        amountWei: 10_000_000_000_000_000_000n,
        notes: '10 ETH allocated to adapter',
      },
      {
        timeDeltaSeconds: 60,
        type: 'LOSS',
        amountWei: 10_000_000_000_000_000_000n, // 100% loss of delegated ETH
        notes: '10 ETH catastrophic slashing event',
      },
    ],
  },
];
