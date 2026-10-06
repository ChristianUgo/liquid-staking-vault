# Beacon Lite case study

Beacon Lite demonstrates the financial foundation behind liquid staking rather than pretending to be a complete staking network. Users receive a transferable receipt token for ETH deposited into a vault. The receipt's exchange rate changes when the simulated validator adapter receives rewards or suffers a loss. Withdrawals are asynchronous because delegated ETH may not be immediately idle.

The most important design choice is explicit: pending shares continue to share rewards and losses until finalization. Once a request is finalized, its ETH is held in queue escrow and is unaffected by later adapter losses. The simulator exposes the same transitions without requiring a wallet.
