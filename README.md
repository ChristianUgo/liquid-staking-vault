# Beacon Lite — Liquid Staking Foundation & Risk Simulator

Beacon Lite is a small educational liquid-staking project. It demonstrates ETH deposits, transferable `blsETH` receipt shares, simulated validator rewards and losses, and a delayed FIFO withdrawal queue.

> **Scope:** validator activity is simulated. This is a portfolio and testnet demonstration, not a production staking service or an audited mainnet protocol.

## Project structure

```text
contracts/                         Solidity 0.8.28 + Foundry contracts
apps/web/                          Next.js App Router frontend + vanilla CSS
packages/simulation/               Deterministic TypeScript reference model
packages/protocol-config/          ABIs and per-chain deployment manifest
```

The contracts are deliberately small:

- `BeaconLiteVault` combines the ERC-20 `blsETH` token and ETH vault.
- `WithdrawalQueue` locks shares, finalizes requests in FIFO order and escrows claims.
- `MockValidatorAdapter` simulates delegated ETH, rewards, losses and delayed exits.

## Accounting model

`A = B + D`, where `B` is idle ETH and `D` is ETH delegated to the mock adapter. Deposits mint `floor(deposit × totalShares / A)` shares using the pre-deposit state. Pending requests continue to share rewards and losses until finalization. Once finalized, the ETH claim is separated into queue escrow and is unaffected by later adapter losses.

## Run locally

Prerequisites: Node.js 20+ and Foundry (`forge`, `anvil`).

```bash
npm ci
cd contracts
forge build
forge test
cd ..
npm run test --workspace=packages/simulation
npm run typecheck --workspace=apps/web
npm run build --workspace=apps/web
npm run dev --workspace=apps/web
```

Open `http://localhost:3000`. The app is wallet-aware, but contract writes remain unavailable until a verified deployment manifest is configured for the selected chain.

For a deployed Sepolia demo, set `NEXT_PUBLIC_SEPOLIA_RPC_URL` for the browser RPC and replace the zero Sepolia addresses in the deployment manifest only after deployment and verification.

## Scenarios

The simulation package includes six deterministic scenarios: normal activity, withdrawal surge, loss before finalization, loss after finalization, delayed adapter exit and extreme loss. All monetary calculations use `bigint`; scenario output is hypothetical and has no effect on deployed contracts.

## Deployment

The local Anvil addresses in `packages/protocol-config/deployments.json` are examples. Sepolia addresses must remain zero until a real deployment is made, verified and recorded with its deployment block. Never present zero addresses as a live testnet deployment.

The current educational Sepolia deployment is recorded in the manifest (block `11717287`):

- Vault: `0xa2f591f76adb03a62b174c29711bceb56adddb03`
- Withdrawal queue: `0xc08b7862740363ff53bcf1e6cd7238749c40e491`
- Mock validator adapter: `0x0694adc4538e20f6c4f7e9db058c7e2904b1bad4`

## License

MIT. See [LICENSE](LICENSE).
