---
title: Finality
description: When a deposit or a burn counts, on each chain.
---

A signer acts on a deposit or a burn only once it is **final**: deep enough that the chain will not reverse it.

| Chain | A deposit or burn counts once |
|---|---|
| Ethereum | Its block is at or below the `finalized` block |
| BNB Chain | Its block is at or below the `finalized` block |
| Kaspa | Its accepting block is at least 1 000 DAA scores below the virtual DAA score (about 100 seconds); 300 on testnet |

## Terms

| Term | Meaning |
|---|---|
| `finalized` block | The block tag that Ethereum and BNB Chain nodes report for the newest block their consensus has finalized |
| DAA score | Kaspa's measure of the DAG's progress. It rises about 10 times per second |
| Virtual DAA score | The DAA score of the node's *virtual* block, its current view that merges all DAG tips |
| Accepting block | The block that accepts a transaction into Kaspa's ledger |

## Why it matters

- A deposit minted before it is final could be reversed on the EVM chain after the kUSDT exists. The kUSDT would
  then be unbacked.
- A burn released before it is final could be reversed on Kaspa after the USDT is paid. The vault would then pay
  for tokens that were never burned.

Each signer measures finality on its own nodes. A request from the coordinator that claims finality is not
evidence.
