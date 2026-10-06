# Beacon Lite economics

Beacon Lite uses one exchange rate for active shares:

```text
A = B + D
rate = A / S
```

`B` is idle ETH in the vault, `D` is ETH delegated to the mock validator adapter, and `S` is outstanding `blsETH` supply. Deposits calculate shares against the pre-deposit state. A pending withdrawal keeps its shares locked and therefore continues to share rewards and losses until FIFO finalization. Finalization burns those shares and moves the calculated ETH amount into queue escrow. This project intentionally omits fees, instant liquidity and real validator accounting.
