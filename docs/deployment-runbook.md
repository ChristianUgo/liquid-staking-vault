# Deployment runbook

1. Install Node.js 20.9+ and Foundry.
2. Run `npm ci`, `forge build` and both test suites from a clean checkout.
3. Deploy `BeaconLiteVault` with a real testnet seed, then deploy the queue and adapter.
4. Call `setDependencies`, `setVault` and `setVault` on the adapter exactly once.
5. Read back owner, operator, guardian, adapter, queue, TVL cap and minimum delay.
6. Verify all three contracts using the exact compiler and optimizer settings.
7. Update `packages/protocol-config/deployments.json` with nonzero addresses, deployment block and chain name only after verification.
8. Run a fresh-wallet deposit → request → finalize → claim smoke test.

Never use mainnet funds. The adapter is simulated and the testnet deployment is disposable.
