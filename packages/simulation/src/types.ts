/**
 * Core types and data models for Beacon Lite Simulation Engine
 */

export interface SimulationConfig {
  initialSeedDepositWei: bigint;
  minWithdrawalDelaySeconds: number;
  idleBufferBps: number; // e.g. 1000 = 10%
  enforceIdleBuffer: boolean;
  tvlCapWei: bigint;
}

export interface SimulationState {
  step: number;
  timestamp: number; // Simulated unix timestamp in seconds
  idleWei: bigint; // B: idle accounted ETH in vault
  delegatedWei: bigint; // D: delegated accounted ETH in adapter
  totalBackingWei: bigint; // A = B + D
  totalShares: bigint; // S: outstanding shares (including pending in queue)
  reservedEscrowWei: bigint; // R: finalized ETH in withdrawal queue
  exchangeRateRay: bigint; // Rate scaled by 1e18 (assets per share)
  queueLength: number; // Count of pending requests
  finalizedRequestsCount: number;
  completedClaimsCount: number;
  isTerminalState: boolean;
}

export interface QueuedWithdrawal {
  id: number;
  owner: string;
  shares: bigint;
  requestTimestamp: number;
  finalized: boolean;
  claimableWei: bigint;
  claimed: boolean;
}

export interface ScheduledExit {
  id: number;
  amountWei: bigint;
  scheduledAt: number;
  readyAt: number;
  completed: boolean;
}

export type EventType =
  | 'DEPOSIT'
  | 'ALLOCATE_TO_ADAPTER'
  | 'REWARD'
  | 'LOSS'
  | 'REQUEST_WITHDRAWAL'
  | 'SCHEDULE_ADAPTER_EXIT'
  | 'COMPLETE_ADAPTER_EXIT'
  | 'FINALIZE_QUEUE'
  | 'CLAIM_WITHDRAWAL';

export interface SimulationEvent {
  step?: number;
  timeDeltaSeconds?: number;
  type: EventType;
  actor?: string;
  amountWei?: bigint;
  shares?: bigint;
  requestId?: number;
  exitId?: number;
  exitDelaySeconds?: number;
  maxRequests?: number;
  notes?: string;
}

export interface LedgerEntry {
  step: number;
  timestamp: number;
  action: string;
  details: string;
  idleWei: string;
  delegatedWei: string;
  totalBackingWei: string;
  totalShares: string;
  reservedEscrowWei: string;
  exchangeRate: string;
  queueDepth: number;
}

export interface ScenarioPreset {
  id: string;
  title: string;
  description: string;
  initialIdleWei: bigint;
  initialDelegatedWei: bigint;
  initialShares: bigint;
  events: SimulationEvent[];
}
