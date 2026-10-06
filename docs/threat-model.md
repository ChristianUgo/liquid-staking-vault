# Threat model

This is an educational testnet project. The main risks modelled are first-depositor share inflation, unauthorized mint/burn or adapter callbacks, reentrancy during ETH claims, double claims, FIFO bypass, stale or insufficient idle liquidity, arithmetic rounding, forced ETH and operator key misuse.

The vault has one owner, one operator, one guardian and one approved mock adapter. Owner powers are deployment configuration and pause controls; the adapter can report only funded rewards, delegated returns and explicit losses. There is no generic admin withdrawal. Production deployment would require independent review, oracle design, distributed operator controls and incident procedures.
