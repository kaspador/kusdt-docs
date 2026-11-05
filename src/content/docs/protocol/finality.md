---
title: Finality
description: When a deposit or a burn counts, on each chain.
---

A signer acts on a deposit or a burn only once it is **final**: deep enough that the chain will not reverse it.

| Chain | A deposit or burn counts once |
|---|---|
| Ethereum | Its block is at or below the `finalized` block |
| BNB Chain | Its block is at or below the `finalized` block |
| Kaspa | Its accepting block is at least 1 000 DAA scores below the virtual DAA score (about 100 seconds); 300 on testnet. Larger burns wait deeper: see [Larger burns wait longer](#larger-burns-wait-longer) |

## Larger burns wait longer

A release on Ethereum or BNB Chain cannot be undone, so the bigger the payout, the deeper a Kaspa reorganization would
have to reach before the bridge pays it. On mainnet a burn output waits:

| Burn output | Waits at least | About |
|---|---|---|
| Up to 10 000 kUSDT | 1 000 DAA scores | 100 seconds |
| Above 10 000 kUSDT | 6 000 DAA scores | 10 minutes |
| Above 100 000 kUSDT | 36 000 DAA scores | 1 hour |

The deployment records the tiers (`kaspa.finalityTiers`, each `{above, daa}` in base units), and the coordinator
serves them in [`GET /status`](/protocol/coordinator-api/). Every signer checks them on its own node before it signs a
release, and the coordinator marks a burn `final` by the same rule. The preflight (`kusdt check`) refuses a mainnet
deployment whose tiers are shallower than these. Skips (refunds) keep the base depth.

This was added on 5 November 2026, after an external review asked why a 250 000 USDT payout waited the same 100
seconds as a small one. The tiers change no contract: finality is checked by the signers.

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
