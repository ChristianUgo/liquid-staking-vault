# Beacon Lite — implementation plan

Prepared: 15 September 2026. Status: approved direction for a small educational portfolio project; this is not a production-readiness or audit claim.

## 1. Purpose and assumptions

Build a small portfolio project that demonstrates the foundation of liquid staking: a deposit receipt token, an exchange rate that changes with rewards and losses, delegated versus idle backing, and a delayed withdrawal queue. A reviewer should be able to understand the rules, run the contracts and complete one end-to-end demo without needing production infrastructure.

Confirmed requirements: a simple foundation project, modern Next.js using the latest stable release, and vanilla CSS.

Decisions applied from that premise:

- Working name: **Beacon Lite**; share token: **blsETH**. The name is intentionally modest: it describes a learning implementation, not a competing production staking network.
- Solidity and Foundry for contracts and tests.
- Custom protocol with one explicitly simulated validator adapter. No real beacon-chain integration in this project.
- Local Anvil network for development; Sepolia for the public contract demo. The public deployment is a disposable educational testnet deployment.
- Focused first release with one vault, one adapter, one queue and one dashboard. Multi-operator infrastructure and governance are out of scope.
- TypeScript for frontend and simulator. Vanilla CSS includes standard `.css` and `.module.css` files; no Tailwind, Sass or CSS-in-JS.
- Immutable first-release contracts, one mock validator adapter, no protocol fees, no governance token, no leverage and no promised market liquidity.

The token is transferable, but transferability does not guarantee a buyer or instant ETH redemption. The interface and documentation must explain this distinction. The app must repeatedly label the validator layer as simulated.

## 2. Deliverables and definition of success

1. Public repository containing the three contracts, deployment scripts, frontend, small reference simulator and documentation.
2. Sepolia contracts with chain, addresses, deployment block and exact build settings recorded.
3. Working deposit, share-balance, withdrawal-request, finalization and claim journeys.
4. Dashboard showing total backing, idle/delegated backing, share rate and queue status.
5. Wallet-free scenario panel with six reproducible scenarios and assumptions visible.
6. Foundry unit, fuzz and a small set of stateful invariants.
7. Browser smoke tests covering the happy path and representative failure states.
8. A short case study explaining the foundation concepts and limitations.

Portfolio acceptance scenario: a reviewer deposits test ETH, receives blsETH, observes one simulated reward, requests an exit, sees a queued withdrawal, and claims ETH after the mock adapter returns liquidity. A wallet-free visitor can explore the same sequence and one loss scenario in the simulator.

## 3. Technology baseline

| Layer | Choice | Implementation rule |
|---|---|---|
| Web framework | Next.js 16.3.5 | npm `latest` verified on preparation date; recheck stable tag when implementation starts and pin the selected patch |
| Routing | App Router | Server Components for route shells and read-only content; small Client Components for wallet flows and simulation |
| UI runtime | Compatible stable React and React DOM | Match Next.js peer requirements; pin matching versions |
| Language | TypeScript, strict mode | Use bigint for monetary calculations; serialize to decimal strings at JSON boundaries |
| Styling | Vanilla CSS and CSS Modules | Shared CSS custom properties, native grid/flex layouts and component styles |
| Wallet layer | Wagmi, Viem, TanStack Query | Verify compatible stable versions together; injected wallet first, WalletConnect as a release enhancement |
| Contracts | Solidity, OpenZeppelin primitives | Select and pin a reviewed compiler/library combination and explicit target EVM version |
| Contract tooling | Foundry / Anvil | Repeatable builds, scripts, fuzzing and stateful testing |
| Frontend tests | Vitest and Playwright | Model tests, component behavior and browser journeys |
| CI | GitHub Actions | Contract tests, types, build and browser smoke checks; add ESLint or Biome when the UI grows |
| Hosting | Next.js-compatible managed host | Choose deployment provider during setup; no background keeper inside request handlers |

Use the Node.js LTS supported by the selected Next.js release and host. Record exact versions and lockfiles. Keep experimental Next.js features outside the critical transaction path.

Sources: [Next.js latest package](https://registry.npmjs.org/next/latest), [Next.js 16.3 release](https://nextjs.org/blog/next-16-3), [Next.js CSS documentation](https://nextjs.org/docs/app/getting-started/css), [Wagmi setup](https://wagmi.sh/react/getting-started).

## 4. Scope and standards

### First release (small foundation)

- Deposit native test ETH and mint ERC-20 shares.
- Move available ETH to a simulated staking adapter.
- Apply one funded reward path and one explicit simulated loss path.
- Request withdrawal by locking shares.
- Return delegated ETH after a configured simulated delay.
- Finalize requests in FIFO order when backing is available.
- Claim escrowed ETH exactly once.
- Read activity, balances, exchange rate, queue state and liquidity.
- Explore six scenarios: normal activity, withdrawal surge, loss before finalization, loss after finalization, delayed adapter exit and extreme loss.

### Deferred

Real beacon-chain validators, distributed balance oracles, multiple operators, DEX liquidity, instant exits, lending integration, restaking, cross-chain functionality, fees, upgradeable governance, NFT withdrawal tickets and partial queue fulfillment.

The first release uses a custom native-ETH vault API and an ERC-20 share token. It must not claim ERC-4626 or ERC-7540 compliance. ERC-4626 assumes an ERC-20 underlying asset; asynchronous redemption also changes interface requirements. A future WETH-based standard-compliant version would require a dedicated interface and conformance review. See [OpenZeppelin vault guidance](https://docs.openzeppelin.com/contracts/5.x/erc4626) and [ERC-7540](https://eips.ethereum.org/EIPS/eip-7540).

Sepolia is suitable for this application demo. Real validator testing is outside this project; if it is pursued later, evaluate Hoodi separately. See [Ethereum network guidance](https://ethereum.org/developers/docs/networks/).

## 5. Architecture

```text
Next.js application
  ├── read-only protocol pages → public RPC → contracts
  ├── wallet transaction panels → user's wallet → contracts
  ├── activity reader → bounded event queries / optional later indexer
  └── scenario explorer → local deterministic TypeScript model

BeaconLiteVault (also ERC-20 share token)
  ├── WithdrawalQueue (locked shares and finalized ETH escrow)
  └── MockValidatorAdapter (delegated backing and delayed returns)

Local demo runner / restricted testnet operator
  └── funded rewards, loss events and simulated exit processing
```

No application database is required for the first functional slice. Contract state is authoritative. Historical analytics may later justify a small reorg-aware event indexer. The public web server never signs user transactions or holds an operator key.

### Contract responsibilities

| Contract | Responsibilities |
|---|---|
| `BeaconLiteVault` | ERC-20 supply, deposit conversion, active backing ledger, adapter allocation and accounting updates |
| `WithdrawalQueue` | Monotonic request IDs, owner and share records, FIFO cursor, locked shares, reserved ETH and single-use claims |
| `MockValidatorAdapter` | Hold delegated ETH, schedule one simulated return, accept funded rewards and apply explicit simulated losses |

Keep token and vault combined initially to reduce cross-contract authorization. The queue and adapter addresses are fixed after controlled initialization. Test initialization cannot be front-run or repeated.

## 6. Financial specification — settle before writing contracts

### Variables

- `B`: accounted idle ETH in the vault.
- `D`: accounted ETH held by the approved adapter, including pending exits until actually returned.
- `A = B + D`: backing of all outstanding shares.
- `S`: total share supply, including shares locked in pending withdrawal requests.
- `R`: finalized ETH reserved in the queue; excluded from `A`.

Use integer wei and integer share units with full-precision multiply/divide. Display conversion rates separately; do not use JavaScript floating point for financial state.

### Initialization

Use a real deployment seed deposit and permanently locked seed shares to avoid an empty initial supply. Testnet seed: 0.01 ETH with 18-decimal shares at a 1:1 initial rate. Document seed capital and the fact that it cannot be withdrawn. Do not introduce unsupported virtual backing.

Unexpected ETH transfers do not automatically increase recorded backing. All accounted inflows pass through explicit funded entry points. Reconcile actual balances against the ledger; for the first release, surplus is visible and cannot be swept by an administrator. Direct token donations to the queue must not create withdrawal entitlements.

### Deposits

For deposit `d`, using backing before the deposit:

```text
sharesMinted = floor(d × S / A)
B' = B + d
S' = S + sharesMinted
```

Reject zero deposits, zero-share results, invalid receivers and expired transactions. Require caller-provided `minSharesOut`. The received `msg.value` must not enter the denominator before calculating new shares. Set a configurable deployment-time TVL cap for the demo.

### Rewards, allocation and losses

- Allocating `x` moves backing from `B` to `D`; `A` stays constant.
- Returning principal moves backing from `D` to `B`; `A` stays constant.
- A funded reward increases backing without minting user shares.
- A simulated loss removes adapter-held ETH into a separate loss sink and reduces `D` by the same amount atomically.
- No arbitrary numerical reward may increase backing without actual ETH funding.
- No arbitrary exchange-rate setter is exposed.

The mock must notify/update the vault within the same transaction as a reward or loss. Delayed reporting is outside this version: otherwise depositors could trade against stale accounting. Real validator integration requires a new reporting and stale-state design.

If `A == 0` while shares exist, enter a terminal loss state: disable new deposits and ordinary conversions; preserve claims on already reserved ETH. Specify a zero-value pending-request resolution path, and use a new deployment for any later recapitalization. Test near-zero backing for overflow and extreme exchange rates as well.

### Withdrawal economics

Chosen simple rule: pending withdrawals remain shares. They continue to share rewards and losses until finalized. This avoids a second snapshot-price ledger and keeps the exchange-rate calculation in one place. The UI must say that the claim amount is variable until finalization; this is an educational simplification and is not intended to reproduce every rule of Lido.

1. Request: move `q` shares to the queue and record the owner. Supply and backing do not change.
2. Pending: shares cannot be transferred by the user; their eventual ETH value is still variable.
3. Finalization: calculate `x = floor(q × A / S)`, burn the locked shares, reduce `B` by `x` and transfer exactly `x` ETH to queue escrow. Record `x` as fixed claimable value.
4. Claim: reduce escrow liability, mark claimed and send ETH to the owner's chosen nonzero receiver.

After finalization, later staking losses do not affect that request because its ETH is segregated. Never lend, stake or sweep reserved ETH. Use checks-effects-interactions and reentrancy protection on external transfers.

Worked example, ignoring seed and rounding: 100 ETH backs 100 shares. A 5 ETH reward makes the rate 1.05. A user queues 10 shares; then a 10 ETH loss reduces backing to 95 ETH. If finalized now, their claim is 9.5 ETH. After burning 10 shares and reserving 9.5 ETH, 85.5 ETH backs 90 shares. The rate remains 0.95. Claiming the 9.5 ETH changes neither active backing nor supply.

### Queue and liquidity rules

- Strict FIFO, bounded requests per finalization call; no loop over every user.
- Requests finalize whole; a large head request can delay later requests. Document and test this tradeoff. Partial fulfillment is a future enhancement.
- No cancellation or transferable withdrawal NFT in the first version.
- Finalization is permissionless once the minimum delay and funding conditions are satisfied.
- Testnet minimum delay: 60 seconds so the queue is visible during a demo; production timing is out of scope.
- Preserve idle ETH for queued demand before allocating new funds to the adapter.
- Target idle buffer: 10% of active backing. It is a policy target, not a promise of immediate liquidity.
- Cap each request and bound batch size; determine exact values through gas and queue tests.
- Do not promise a fixed completion time. Display a simulated earliest eligibility time separately from actual liquidity readiness.

## 7. Proposed interfaces and roles

Interfaces are design sketches; finalize signatures alongside the economic specification.

```text
Vault
  deposit(receiver, minSharesOut, deadline) payable
  previewDeposit(assets)
  convertToAssets(shares)
  totalBacking() / idleAssets() / delegatedAssets()
  allocateToAdapter(assets)

Queue
  requestWithdrawal(shares)
  finalize(maxRequests)
  claim(requestId, receiver)
  requestStatus(requestId)
  reservedAssets() / nextPendingRequestId()

Mock validator adapter / demo control
  fundReward() payable
  simulateLoss(assets)
  scheduleExit(assets)
  completeExit(exitId)
```

Withdrawal request uses an explicit token approval unless a reviewed permit flow is added later. Bind request ownership to the caller. Emit events for deposits, allocations, rewards, losses, requests, finalizations and claims.

Roles: deployer configures and relinquishes unnecessary powers; operator manages adapter allocation and testnet scenarios; guardian pauses new exposure during an incident. Document each role's exact authority and trust implications. There is no generic administrator withdrawal function. Pauses should be granular: pausing deposits or allocations should not ordinarily prevent already-funded claims. A dedicated emergency claim pause, if included, needs its own rationale and tests.

## 8. Frontend pages and visual system

| Route | Contents and acceptance requirements |
|---|---|
| `/` | Clear explanation, project scope, testnet/simulation label, working app and simulator entry points |
| `/stake` | ETH amount, balance and gas headroom, share quote, rate, minimum output, wallet submission and receipt |
| `/portfolio` | Share balance, estimated ETH value, pending requests, claimable amounts and activity |
| `/withdraw` | Approval, share amount, variable-value explanation, queue placement and request tracking |
| `/protocol` | Backing, idle/delegated split, reserves, share supply, queue pressure, roles and contract links |
| `/simulator` | Inputs, scenarios, timeline, charts, tables, reset and export |
| `/docs` | Architecture, economics, test evidence, limitations and case study |

Visual direction: a restrained financial dashboard with legible typography, generous spacing and one consistent accent color. Use native CSS grid/flex, fluid sizing and shared tokens for spacing, color, radius and typography. Provide a light/dark theme only if both can be verified properly. Do not hard-code invented TVL, yield or participant metrics.

Component set: app shell, wallet menu, network badge, amount field, metric card, allocation bar, transaction stepper, queue table, status badge, empty state, alert, modal and chart/table pair.

Accessibility: keyboard navigation, visible focus, semantic labels, text equivalents for chart data, reduced-motion support and statuses distinguished by text/icons as well as color. Review at phone, tablet and desktop widths; avoid sideways page scrolling.

### Wallet and transaction states

Handle disconnected wallet, unsupported chain, insufficient funds including gas, approval required, simulation failure, signature request, user rejection, submitted, confirming, success, revert, replacement/cancellation and RPC outage. Keep transaction hashes and explorer links visible. Refresh relevant chain state after receipts; a cached quote must never be treated as execution truth.

Use a read-only server shell with a client wallet provider. Preserve server/client hydration consistency. Do not render wallet-specific balances from a globally cached server response. Boundaries passing bigint data use strings or an explicitly supported serializer.

### Reads and history

- Read related financial values at the same block where practical.
- Show block number or update age on live metrics; display unavailable/stale states instead of zero.
- Cache static explanatory content; use explicit short freshness policies for public aggregates.
- Key wallet queries by chain ID, contract version and account.
- Bound historical event reads from the known deployment block and paginate by provider limits.
- Treat recent logs as provisional and reconcile after confirmations/reorgs.
- If a provider cannot support scalable history, show a bounded activity window and explorer links; do not silently claim complete history.
- Never put private RPC credentials in public environment variables. A server RPC endpoint must have method allowlists, input limits and abuse controls.

## 9. Stress simulator

Build a deterministic TypeScript model with the same documented rounding and state transitions as the contracts. Keep its arithmetic independent enough to catch contract mistakes; compare both implementations using shared scenario fixtures.

Inputs: initial backing and shares, idle buffer, user deposits, withdrawal requests, funded reward events, loss events and simulated exit delay. Percentage inputs are parsed to integer basis points. Events execute in a visible ordered timeline.

Presets:

1. Normal activity: deposits, rewards and orderly withdrawals.
2. Withdrawal surge: 60% of shares request exit while most backing is delegated.
3. Loss before finalization: queued shares absorb the loss.
4. Loss after finalization: escrowed claims remain unchanged.
5. Delayed adapter exit: solvent backing with insufficient immediate cash.
6. Extreme loss: terminal or near-zero backing behavior.

Outputs: exchange rate, backing composition, outstanding shares, queue length, reserved claims, completed withdrawals and elapsed simulated time. Include a numerical ledger table as well as charts. Export scenario inputs and results as JSON; optionally CSV. Label all hypothetical yields and timelines as assumptions.

The public simulator is wallet-free and has no effect on deployed contracts. Real testnet scenario operations use a separate restricted runner; visitors cannot apply losses to other users' shared testnet positions. Local test environments can offer a complete resettable on-chain demo.

## 10. Test and security plan

### Unit and integration tests

Cover initialization, first and later deposits, transfers, allowance handling, mint rounding, minimum output, funded reward accounting, loss limits, allocation/return conservation, FIFO requests, delay enforcement, double claims, receiver failures, unauthorized calls and each pause mode.

Use adversarial receiver contracts for reentrancy and reverted ETH transfers. Verify failure of one claim cannot block another user's claim. Verify forced ETH and unsolicited token transfers do not manufacture claims or corrupt backing. Cover same-block ordering, near-zero backing, full loss, large numeric values and repeated tiny operations.

### Stateful invariants

- Actual accounted custody covers active backing plus escrow liabilities.
- `A == B + D`; queue reserve liabilities never exceed queue ETH.
- Pending locked shares remain in supply and reconcile to request records.
- Finalized shares are burned exactly once; requests pay at most once.
- Allocate/return movements do not create rewards or losses.
- Deposit/finalization do not materially change exchange rate beyond specified integer rounding bounds.
- Users cannot extract value using repeated split deposits/withdrawals beyond the proven rounding bounds.
- Newer requests cannot bypass a pending FIFO head.
- Reserved claims are unaffected by later adapter losses.

Set bounds mathematically for rounding assertions; do not hide drift behind broad tolerances. Preserve failing seeds and counterexample traces in regression tests. Initial target: a small, repeatable fuzz set for each accounting function plus a short invariant run in CI. Expand the campaign only if a counterexample or meaningful arithmetic risk justifies it.

### Frontend and end-to-end tests

Run a deterministic local chain, deploy fixtures, execute deposit → reward → request → loss → exit → finalize → claim, and reconcile displayed values to chain reads. Include wrong-chain, rejected signature, reverted transaction, stale read and duplicate-click cases. Mock wallet transport only where necessary and add an actual browser-wallet smoke check for public testnet release.

### Review gate

Run static analysis, inspect findings, review role powers and document known limitations. A portfolio release is not an audited mainnet product. No mainnet fundraising or production deposit launch is part of this plan.

## 11. Repository layout

```text
apps/web/
  src/app/
  src/components/
  src/features/{staking,withdrawals,portfolio,simulator}/
  src/lib/{chain,formatting,queries}/
  src/styles/{globals.css,tokens.css}
contracts/
  src/{BeaconLiteVault.sol,WithdrawalQueue.sol}
  src/interfaces/
  src/mocks/
  test/{unit,integration,invariant}/
  script/
packages/
  protocol-config/    # generated ABIs and chain deployment manifests
  simulation/         # reference model and scenario fixtures
docs/
  economics.md
  architecture.md
  threat-model.md
  decisions/
  deployment-runbook.md
  case-study.md
.github/workflows/
```

Use a simple workspace setup; a monorepo build orchestrator is optional. ABIs come from the tested contract build. CI checks deployed addresses are never mixed between local, preview and testnet environments.

## 12. Phased execution and completion gates

Effort estimates below are planning ranges for one developer familiar with Solidity and React, not delivery promises. Review and learning may extend them. Phases can overlap only after their dependencies are stable.

| Phase | Work | Completion gate | Indicative effort |
|---|---|---|---|
| 0. Specification | Confirm the selected token model, custody, roles, parameters and one wireframe | Economics examples and threat model written | 0.5–1 day |
| 1. Foundation | Workspace, pinned dependencies, Foundry, Next.js/CSS shell and CI | Clean install, contract smoke test and web build pass | 0.5–1 day |
| 2. Core accounting | Shares, deposits, adapter, one reward path, one loss path and seed model | Accounting tests and deposit cases pass | 1–2 days |
| 3. Withdrawals | FIFO queue, escrow, one simulated exit, claims and minimal pause behavior | Deposit → request → finalize → claim passes locally | 1–2 days |
| 4. Connected app | Wallet integration, stake/request/claim panels and protocol reads | Complete local browser journey with basic errors | 1–2 days |
| 5. Simulator | Reference engine, six presets, timeline and simple charts/table | Contract/model fixtures agree; wallet-free page works | 1 day |
| 6. Hardening | Focused security review, accessibility, mobile and RPC failure checks | Findings resolved or documented; CI is green | 1–2 days |
| 7. Publication | Sepolia deploy/verify, hosting, case study and portfolio link | Fresh-wallet smoke journey and reproducible repository | 0.5–1 day |

Total indicative effort: 8–12 focused working days. The core demonstration is complete after the connected app and simulator; hardening and publication remain necessary for a credible portfolio release.

## 13. Deployment and operating checklist

- Recheck dependency versions and advisories, freeze lockfiles and record source commit.
- Verify target network, RPC configuration, bytecode/compiler settings and constructor parameters.
- Deploy and seed contracts; configure limited roles; record addresses and deployment block.
- Verify source code on an explorer and independently read back configuration.
- Publish frontend with exact deployment manifest and visible testnet labels.
- Use separate testnet operator credentials stored outside the frontend/Next.js server.
- Run fresh-wallet deposit and withdrawal smoke checks; confirm metrics and history.
- Monitor frontend errors, RPC failures, queue age, adapter return failures and backing reconciliation.
- Keep keeper functions callable manually if automation stops. Use a dedicated worker only if a keeper becomes necessary.
- For a contract defect: pause affected operations, preserve safe claims, publish the issue and deploy a new immutable version. Frontend rollback alone does not repair deployed contracts.
- Update portfolio card to a factual status and working links after release verification.

## 14. Portfolio presentation

Project title: Beacon Lite — Liquid Staking Foundation and Risk Simulator.

Case study structure: problem; financial specification; architecture; one worked reward/loss/withdrawal example; adversarial tests; demo; limitations; next steps.

Evidence should include an architecture diagram, contract addresses, representative invariant properties, CI results, a short demo and the exact simulated-validator disclosure. Avoid unsupported audit, production, TVL and adoption claims.

On the existing portfolio, the cards identified for possible “In development” labels are Orbis AMM Lab and Liquid Staking Vault because their repository/demo links were marked coming soon. Confirm actual completion status before changing their labels.

## 15. Decisions now settled

1. Custom protocol with one simulated validator adapter. No existing-protocol integration or real validators in this project.
2. Focused foundation release. No multi-operator, governance or advanced integration architecture.
3. Name: Beacon Lite; share symbol: blsETH. Foundry and Solidity remain the contract-tooling choice.
4. Pending shares continue to receive rewards and losses until finalization because it uses one exchange-rate calculation and the fewest accounting states.
5. Native ETH with a custom vault API is recommended for v1. It makes the staking story visible and avoids adding WETH wrapping plus ERC-4626/ERC-7540 compliance work to a foundation project.

These decisions are the implementation baseline. Revisit them only if the project grows beyond its educational portfolio purpose.
