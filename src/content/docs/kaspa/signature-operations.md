---
title: Signature operations
description: Kaspa relays at most 15 signature operations per P2SH input, counted over the whole script. How this shaped BridgeMint.
---

:::note[Confirmed on a node]
Observed on kaspad v2.1.0 (simnet): relay policy allows at most **15 signature operations per P2SH input**,
counted **statically over the whole redeem script**.
:::

## What the rule says

When a node decides whether to relay a transaction, it counts the signature-checking opcodes in each P2SH
input's redeem script. The count is static: every signature check in the script counts, whether or not the
branch that contains it runs. An input whose script has more than 15 is not relayed.

Two consequences for covenant authors:

- **Every entry counts.** A covenant program contains all of its entrypoints, so the checks of entries that a
  transaction does not use still count against it.
- **Loops count at their bound.** Kaspa script has no loops. A compiler unrolls a loop to its declared maximum, so
  a signature check inside a loop of bound N counts N times.

## How it shaped BridgeMint

BridgeMint verifies a quorum in a loop bounded by 4 (the governance quorum). Its whole script has:

| Entry | Signature checks |
|---|---|
| `mint` (quorum loop, bound 4) | 4 |
| `govern` (one quorum loop, bound 4) | 4 |
| `pause` (one guardian signature) | 1 |
| **Total** | **9** |

A first design with one entry per governance action would have needed five quorum loops of 4, which is 20, plus
mint and pause: 25 in total, above the limit. So every governance action goes through one `govern` entry with a
single quorum check, and an action byte selects what it does.

## Checking it in tests

The VM test harness (`bridge/kaspa/tests/common/mod.rs`) runs every test transaction through the same static
counter that nodes use, `post_toccata_p2sh_sig_scanner` from rusty-kaspa, and fails if any input has more than 15.
The transaction builders check standardness the same way before they return a transaction.

An ignored test, `report_compute_budgets`, prints the compute budget each covenant input commits for mints,
KCC-20 transfers, pause and governance:

```sh
bash tools/rust.sh bridge/kaspa cargo test --test bridge_mint report_compute_budgets -- --ignored --nocapture
```
