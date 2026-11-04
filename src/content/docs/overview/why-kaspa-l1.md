---
title: Kaspa L1, not a layer 2
description: kUSDT lives on Kaspa Layer 1 as covenant UTXOs. It does not use the Igra or Kasplex layer-2 networks.
---

kUSDT is a Kaspa **Layer 1** (L1) token. This page explains what that means and why it matters.

## Two ways to put a token "on Kaspa"

**Layer 1** is the Kaspa network itself: the block DAG, the miners, the nodes, and the rules every node checks
before it accepts a transaction.

A **layer 2** (L2) is a separate system built on top of Kaspa. It has its own execution environment for token
logic and uses Kaspa underneath. **Igra** and **Kasplex** are layer-2 networks built on Kaspa.

kUSDT uses neither. No Igra or Kasplex contract, sequencer, bridge or token standard is involved anywhere in
kUSDT.

## What "on L1" means for kUSDT

- **Balances are Kaspa UTXOs.** An unspent transaction output (UTXO) is a coin-like record that a later
  transaction spends in full. Each kUSDT balance is a UTXO that carries a token state: an amount and an owner.
- **Rules are checked by Kaspa consensus.** Each kUSDT UTXO is locked by a *covenant*: a script that inspects
  the transaction spending it and accepts only valid token moves. Every Kaspa node runs these scripts. The
  opcodes that make this possible came with Kaspa's Toccata hard fork ([KIP-17](/concepts/covenants/) and
  [KIP-20](/concepts/covenant-ids/)).
- **Transfers are Kaspa transactions.** Sending kUSDT, swapping it in KasPool and burning it to redeem are
  ordinary Kaspa transactions. They are ordered and confirmed in the block DAG like a KAS payment, and they pay
  normal Kaspa network fees in KAS.
- **The pool is on L1 too.** KasPool is a pair of covenants on Kaspa L1. A swap moves the pool's KAS and its
  kUSDT reserve in one Kaspa transaction, so it happens completely or not at all.
- **Standard tooling applies.** kUSDT's token code is byte-for-byte the standard KCC-20 reference, so wallets
  and indexers that support KCC-20 recognise kUSDT states. See [The KCC20 template](/kaspa/kcc20-template/).

## Comparison

| | kUSDT on Kaspa L1 | A token on a Kaspa layer 2 |
|---|---|---|
| Where the token rules run | Kaspa's script engine, in every node | The layer 2's own execution environment |
| Who orders transactions | Kaspa miners, in the block DAG | Defined by the layer 2 |
| What a transfer is | A Kaspa L1 transaction | A layer-2 transaction |
| Extra systems trusted for transfers | None beyond Kaspa | The layer 2 and its link to Kaspa |

## What L1 does not change

Being on L1 makes kUSDT *transfers* as secure as Kaspa itself. It does not remove the trust in the **bridge**
that connects Kaspa to Ethereum and BNB Chain. Kaspa nodes cannot see Ethereum or BNB Chain, so a federation of
5 signers attests to deposits and burns. The [trust model](/security/trust-model/) describes what that
federation can and cannot do, and [Known limits](/security/known-limits/) describes the planned upgrade to
zero-knowledge light-client verification.
