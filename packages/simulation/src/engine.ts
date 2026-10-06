import type {
  SimulationConfig,
  SimulationState,
  QueuedWithdrawal,
  SimulationEvent,
  LedgerEntry,
  ScheduledExit,
} from './types.ts';

const RAY = 1_000_000_000_000_000_000n;
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';

export class SimulationEngine {
  public config: SimulationConfig;
  public state: SimulationState;
  public queue: QueuedWithdrawal[] = [];
  public pendingExits: ScheduledExit[] = [];
  public balances = new Map<string, bigint>();
  public ledger: LedgerEntry[] = [];
  private nextRequestId: number = 1;
  private nextExitId: number = 1;

  constructor(
    config?: Partial<SimulationConfig>,
    initial?: Partial<Pick<SimulationState, 'idleWei' | 'delegatedWei' | 'totalShares'>>
  ) {
    this.config = {
      initialSeedDepositWei: 10_000_000_000_000_000n, // 0.01 ETH
      minWithdrawalDelaySeconds: 60,
      idleBufferBps: 1000, // 10%
      enforceIdleBuffer: false,
      tvlCapWei: 1000_000_000_000_000_000_000n, // 1,000 ETH
      ...config,
    };

    // Initialize with seed deposit permanently minted
    const seed = initial?.idleWei ?? this.config.initialSeedDepositWei;
    const delegated = initial?.delegatedWei ?? 0n;
    const shares = initial?.totalShares ?? seed;
    this.state = {
      step: 0,
      timestamp: 0,
      idleWei: seed,
      delegatedWei: delegated,
      totalBackingWei: seed + delegated,
      totalShares: shares,
      reservedEscrowWei: 0n,
      exchangeRateRay: shares === 0n ? 0n : ((seed + delegated) * RAY) / shares,
      queueLength: 0,
      finalizedRequestsCount: 0,
      completedClaimsCount: 0,
      isTerminalState: false,
    };

    this.balances.set(DEAD_ADDRESS, shares);

    this.recordLedger('INITIALIZE', `Vault seeded with ${this.formatEth(seed)} ETH at 1:1 rate`);
  }

  public getExchangeRate(): bigint {
    if (this.state.totalShares === 0n || this.state.totalBackingWei === 0n) {
      return 0n;
    }
    return (this.state.totalBackingWei * RAY) / this.state.totalShares;
  }

  public deposit(amountWei: bigint, receiver: string = 'User'): bigint {
    if (this.state.isTerminalState) {
      throw new Error('Deposit rejected: Vault in terminal loss state');
    }
    if (amountWei <= 0n) {
      throw new Error('Deposit rejected: Zero deposit amount');
    }

    if (!receiver) throw new Error('Deposit rejected: Empty receiver');
    if (this.state.totalBackingWei + amountWei > this.config.tvlCapWei) {
      throw new Error('Deposit rejected: Exceeds TVL cap');
    }

    // sharesMinted = floor(d * S / A)
    const sharesMinted = (amountWei * this.state.totalShares) / this.state.totalBackingWei;
    if (sharesMinted <= 0n) {
      throw new Error('Deposit rejected: Zero shares minted');
    }

    this.state.idleWei += amountWei;
    this.state.totalBackingWei += amountWei;
    this.state.totalShares += sharesMinted;
    this.balances.set(receiver, (this.balances.get(receiver) ?? 0n) + sharesMinted);
    this.state.exchangeRateRay = this.getExchangeRate();

    this.recordLedger(
      'DEPOSIT',
      `${receiver} deposited ${this.formatEth(amountWei)} ETH -> minted ${this.formatEth(sharesMinted)} blsETH`
    );

    return sharesMinted;
  }

  public allocateToAdapter(amountWei: bigint): void {
    if (amountWei <= 0n) throw new Error('Allocation rejected: Non-positive amount');
    if (amountWei > this.state.idleWei) throw new Error('Allocation rejected: Insufficient idle ETH');

    if (this.config.enforceIdleBuffer) {
      const remainingIdle = this.state.idleWei - amountWei;
      const requiredIdle = (this.state.totalBackingWei * BigInt(this.config.idleBufferBps) + 9_999n) / 10_000n;
      if (remainingIdle < requiredIdle) {
        throw new Error(`Allocation rejected: Must retain ${this.formatEth(requiredIdle)} ETH idle`);
      }
    }

    this.state.idleWei -= amountWei;
    this.state.delegatedWei += amountWei;
    // totalBacking remains invariant: A = (B - x) + (D + x) = B + D
    this.state.exchangeRateRay = this.getExchangeRate();

    this.recordLedger(
      'ALLOCATE',
      `Allocated ${this.formatEth(amountWei)} ETH idle -> adapter (Backing invariant preserved)`
    );
  }

  public returnFromAdapter(amountWei: bigint): void {
    if (amountWei <= 0n) throw new Error('Return rejected: Non-positive amount');
    if (amountWei > this.state.delegatedWei) throw new Error('Return rejected: Insufficient delegated ETH');

    this.state.delegatedWei -= amountWei;
    this.state.idleWei += amountWei;
    // totalBacking remains invariant
    this.state.exchangeRateRay = this.getExchangeRate();

    this.recordLedger(
      'RETURN_PRINCIPAL',
      `Adapter returned ${this.formatEth(amountWei)} ETH principal -> vault idle`
    );
  }

  public fundReward(rewardWei: bigint): void {
    if (rewardWei <= 0n) throw new Error('Reward rejected: Non-positive reward');
    if (this.state.isTerminalState) throw new Error('Reward rejected: Vault in terminal loss state');

    this.state.delegatedWei += rewardWei;
    this.state.totalBackingWei += rewardWei;
    this.state.exchangeRateRay = this.getExchangeRate();

    this.recordLedger(
      'REWARD',
      `Funded reward +${this.formatEth(rewardWei)} ETH added to adapter. Rate increased to ${this.formatRay(this.state.exchangeRateRay)}`
    );
  }

  public simulateLoss(lossWei: bigint): void {
    if (lossWei <= 0n) throw new Error('Loss rejected: Non-positive loss');
    if (lossWei > this.state.delegatedWei) throw new Error('Loss rejected: Exceeds delegated ETH');
    if (this.state.delegatedWei === 0n) throw new Error('Loss rejected: No delegated ETH');

    this.state.delegatedWei -= lossWei;
    this.state.totalBackingWei -= lossWei;

    if (this.state.totalBackingWei === 0n) {
      this.state.isTerminalState = true;
      this.state.exchangeRateRay = 0n;
    } else {
      this.state.exchangeRateRay = this.getExchangeRate();
    }

    this.recordLedger(
      'LOSS',
      `Simulated loss -${this.formatEth(lossWei)} ETH in adapter. Rate decreased to ${this.formatRay(this.state.exchangeRateRay)}${this.state.isTerminalState ? ' [TERMINAL STATE]' : ''}`
    );
  }

  public requestWithdrawal(shares: bigint, owner: string = 'User'): number {
    if (this.state.isTerminalState) throw new Error('Request rejected: Vault in terminal loss state');
    if (shares <= 0n) throw new Error('Request rejected: Non-positive shares');
    const ownerBalance = this.balances.get(owner) ?? 0n;
    if (shares > ownerBalance) throw new Error('Request rejected: Exceeds owner share balance');

    this.balances.set(owner, ownerBalance - shares);

    const requestId = this.nextRequestId++;
    const req: QueuedWithdrawal = {
      id: requestId,
      owner,
      shares,
      requestTimestamp: this.state.timestamp,
      finalized: false,
      claimableWei: 0n,
      claimed: false,
    };

    this.queue.push(req);
    this.state.queueLength = this.getPendingQueueCount();

    this.recordLedger(
      'REQUEST_WITHDRAWAL',
      `Request #${requestId}: Locked ${this.formatEth(shares)} blsETH by ${owner}. Shares remain floating in supply until finalization`
    );

    return requestId;
  }

  public finalize(maxRequests: number = 10): number {
    if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
      throw new Error('Finalize rejected: maxRequests must be a positive integer');
    }
    let finalizedCount = 0;
    const minDelay = this.config.minWithdrawalDelaySeconds;

    for (const req of this.queue) {
      if (req.finalized) continue;
      if (finalizedCount >= maxRequests) break;

      // Check delay
      if (this.state.timestamp < req.requestTimestamp + minDelay) {
        // Enforce strict FIFO: if head request is not ripe, queue cannot advance
        break;
      }

      // Calculate claimable ETH: floor(q * A / S)
      const claimable = (req.shares * this.state.totalBackingWei) / this.state.totalShares;

      // Check liquidity headroom in idle B
      if (claimable > this.state.idleWei) {
        // Head-of-line blocking: insufficient idle liquidity to finalize whole request
        break;
      }

      // Execute finalization
      req.finalized = true;
      req.claimableWei = claimable;

      this.state.idleWei -= claimable;
      this.state.reservedEscrowWei += claimable;
      this.state.totalBackingWei -= claimable;
      this.state.totalShares -= req.shares;
      this.state.exchangeRateRay = this.getExchangeRate();

      finalizedCount++;
      this.state.finalizedRequestsCount++;

      this.recordLedger(
        'FINALIZE',
        `Finalized request #${req.id}: Burned ${this.formatEth(req.shares)} blsETH -> Escrowed ${this.formatEth(claimable)} ETH`
      );
    }

    this.state.queueLength = this.getPendingQueueCount();
    return finalizedCount;
  }

  public claim(requestId: number, receiver: string = 'User', caller: string = receiver): bigint {
    const req = this.queue.find((r) => r.id === requestId);
    if (!req) throw new Error(`Claim rejected: Request #${requestId} not found`);
    if (!req.finalized) throw new Error(`Claim rejected: Request #${requestId} not yet finalized`);
    if (req.claimed) throw new Error(`Claim rejected: Request #${requestId} already claimed`);
    if (caller !== req.owner) throw new Error('Claim rejected: Caller does not own request');

    req.claimed = true;
    const claimAmount = req.claimableWei;
    this.state.reservedEscrowWei -= claimAmount;
    this.state.completedClaimsCount++;

    this.recordLedger(
      'CLAIM',
      `Claimed request #${requestId}: Paid ${this.formatEth(claimAmount)} ETH to ${receiver}`
    );

    return claimAmount;
  }

  public advanceTime(seconds: number): void {
    if (!Number.isInteger(seconds) || seconds < 0) throw new Error('Time advance rejected: Non-negative integer required');
    this.state.timestamp += seconds;
    this.recordLedger('TIME_ADVANCE', `Advanced time by ${seconds}s (Current: ${this.state.timestamp}s)`);
  }

  public executeEvent(event: SimulationEvent): void {
    if (event.timeDeltaSeconds && event.timeDeltaSeconds > 0) {
      this.advanceTime(event.timeDeltaSeconds);
    }

    switch (event.type) {
      case 'DEPOSIT':
        this.deposit(event.amountWei || 0n, event.actor);
        break;
      case 'ALLOCATE_TO_ADAPTER':
        this.allocateToAdapter(event.amountWei || 0n);
        break;
      case 'REWARD':
        this.fundReward(event.amountWei || 0n);
        break;
      case 'LOSS':
        this.simulateLoss(event.amountWei || 0n);
        break;
      case 'REQUEST_WITHDRAWAL':
        this.requestWithdrawal(event.shares || 0n, event.actor);
        break;
      case 'SCHEDULE_ADAPTER_EXIT':
        this.scheduleAdapterExit(event.amountWei || 0n, event.exitDelaySeconds ?? this.config.minWithdrawalDelaySeconds);
        break;
      case 'COMPLETE_ADAPTER_EXIT':
        this.completeAdapterExit(event.exitId, event.amountWei);
        break;
      case 'FINALIZE_QUEUE':
        this.finalize(event.maxRequests ?? 10);
        break;
      case 'CLAIM_WITHDRAWAL':
        if (event.requestId) {
          this.claim(event.requestId, event.actor, event.actor);
        }
        break;
      default:
        break;
    }
  }

  public scheduleAdapterExit(amountWei: bigint, delaySeconds: number = this.config.minWithdrawalDelaySeconds): number {
    if (amountWei <= 0n) throw new Error('Exit rejected: Non-positive amount');
    if (amountWei > this.state.delegatedWei) throw new Error('Exit rejected: Insufficient delegated ETH');
    if (!Number.isInteger(delaySeconds) || delaySeconds < 0) throw new Error('Exit rejected: Invalid delay');

    const exit: ScheduledExit = {
      id: this.nextExitId++,
      amountWei,
      scheduledAt: this.state.timestamp,
      readyAt: this.state.timestamp + delaySeconds,
      completed: false,
    };
    this.pendingExits.push(exit);
    this.recordLedger('SCHEDULE_EXIT', `Scheduled exit #${exit.id} for ${this.formatEth(amountWei)} ETH (ready at ${exit.readyAt}s)`);
    return exit.id;
  }

  public completeAdapterExit(exitId?: number, amountWei?: bigint): void {
    const exit = exitId === undefined
      ? this.pendingExits.find((candidate) => !candidate.completed && candidate.readyAt <= this.state.timestamp)
      : this.pendingExits.find((candidate) => candidate.id === exitId && !candidate.completed);
    if (exit) {
      if (exit.readyAt > this.state.timestamp) throw new Error('Exit rejected: Delay not elapsed');
      exit.completed = true;
      this.returnFromAdapter(exit.amountWei);
      return;
    }
    if (exitId !== undefined) throw new Error('Exit rejected: Unknown or completed exit');
    if (amountWei === undefined) throw new Error('Exit rejected: No ready exit');
    this.returnFromAdapter(amountWei);
  }

  public runScenario(events: SimulationEvent[]): LedgerEntry[] {
    for (const evt of events) {
      this.executeEvent(evt);
    }
    return this.ledger;
  }

  private getPendingQueueCount(): number {
    return this.queue.filter((r) => !r.finalized).length;
  }

  private recordLedger(action: string, details: string): void {
    this.state.step++;
    this.ledger.push({
      step: this.state.step,
      timestamp: this.state.timestamp,
      action,
      details,
      idleWei: this.state.idleWei.toString(),
      delegatedWei: this.state.delegatedWei.toString(),
      totalBackingWei: this.state.totalBackingWei.toString(),
      totalShares: this.state.totalShares.toString(),
      reservedEscrowWei: this.state.reservedEscrowWei.toString(),
      exchangeRate: this.formatRay(this.state.exchangeRateRay),
      queueDepth: this.state.queueLength,
    });
  }

  public formatEth(wei: bigint): string {
    const isNegative = wei < 0n;
    const absWei = isNegative ? -wei : wei;
    const integerPart = absWei / 1_000_000_000_000_000_000n;
    const remainder = absWei % 1_000_000_000_000_000_000n;
    const fractionPart = remainder.toString().padStart(18, '0').slice(0, 4);
    return `${isNegative ? '-' : ''}${integerPart}.${fractionPart}`;
  }

  public formatRay(ray: bigint): string {
    const intPart = ray / 1_000_000_000_000_000_000n;
    const frac = (ray % 1_000_000_000_000_000_000n).toString().padStart(18, '0').slice(0, 6);
    return `${intPart}.${frac}`;
  }
}
