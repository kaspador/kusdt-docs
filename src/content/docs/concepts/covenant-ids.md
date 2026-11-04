---
title: Covenant IDs and lineage
description: KIP-20 covenant IDs give each covenant application a stable, unforgeable identity on Kaspa L1.
---

KIP-20 ("Covenant IDs") adds a 32-byte **covenant ID** to UTXOs. The covenant ID is the identity of kUSDT: a
wallet that knows kUSDT's covenant ID can tell real kUSDT from any imitation.

## The idea

A UTXO may carry an optional `covenant_id`. Each transaction output may declare a **covenant binding**:

| Field | Meaning |
|---|---|
| `covenant_id` | The covenant this output belongs to |
| `authorizing_input` | The input that authorizes creating it |

Consensus, outside the script engine, allows an output to carry a covenant ID in only two cases:

1. **Continuation.** Its authorizing input spends a UTXO that already carries the same covenant ID.
2. **Genesis.** The ID equals a hash of the authorizing input's outpoint and of the outputs it creates.

An outpoint (a transaction ID and an output index) is never spent twice. So a covenant ID cannot be created
twice, and a UTXO with a given ID can only descend from earlier UTXOs with that ID. KIP-20 says covenant UTXOs
become *uncreatable* when forged, not merely unspendable.

The covenant script must still check its own outputs: their scripts and their bindings. Consensus guarantees
the lineage; the covenant guarantees the rules.

## Genesis hash

```text
covenant_id = BLAKE2b-256 with domain tag "CovenantID" of
    outpoint.tx_id ‖ le_u32(outpoint.index) ‖ le_u64(number of authorized outputs)
    ‖ for each authorized output, in increasing index order:
        le_u32(index) ‖ le_u64(value) ‖ le_u16(script version)
        ‖ le_u64(script length) ‖ script
```

The ID commits to the initial outputs (values and scripts, and therefore the initial state), not only to the
outpoint. The binding itself is left out, to avoid a self-reference.

## Families and lineage

In these docs a **covenant family** is the set of UTXOs that share one covenant ID. Within one transaction,
KCC-20 calls the inputs and continuation outputs that share a covenant ID the transaction's family.

| Family | Created by | Contains |
|---|---|---|
| kUSDT | The kUSDT genesis transaction | `BridgeMint` (one), `TokenSeed` UTXOs, and every kUSDT `KCC20` state |
| KasPool | The pool's genesis transaction | `Pool` (one) and every `Position` |

The pool's kUSDT reserve is a `KCC20` state in the **kUSDT** family. Its *owner* is the KasPool covenant ID (see
[Owner schemes](/concepts/owner-schemes/)).

## Opcodes for families

KIP-20 also gives scripts a cheap view of the families in the spending transaction:

| Opcode | Returns |
|---|---|
| `OpInputCovenantId(idx)` | The covenant ID of input `idx`, or 32 zero bytes |
| `OpAuthOutputCount(input_idx)`, `OpAuthOutputIdx` | The outputs an input authorizes (continuations only) |
| `OpCovInputCount(id)`, `OpCovInputIdx` | The inputs that carry covenant ID `id` |
| `OpCovOutputCount(id)`, `OpCovOutputIdx` | The continuation outputs that carry covenant ID `id` |
| `OpOutputCovenantId(idx)`, `OpOutputAuthorizingInput(idx)` | The binding an output declares |

KasPool uses `OpCovInputCount(token_covid) == 0` to refuse any kUSDT input in transactions that must not touch
its reserve. See [KasPool](/contracts/kaspool/#why-every-entry-guards-the-reserve).

## Patterns

KIP-20 describes three patterns. kUSDT uses all of them:

| Pattern | Meaning | In kUSDT |
|---|---|---|
| Singleton (one-to-one) | One state UTXO that always has exactly one successor | `BridgeMint`, `Pool` |
| One-to-many | One input authorizes several outputs | A mint: `BridgeMint` creates its successor and 1 to 3 `KCC20` states |
| Many-to-many (delegation) | One *leader* input validates the whole transition; the others *delegate* to it | A `KCC20` transfer with several token inputs |

## Storage accounting

KIP-20 treats a covenant UTXO as carrying 32 extra bytes for storage accounting. That pushes kUSDT states into
a larger storage class, which is why each one carries more KAS. See [Storage mass](/kaspa/storage-mass/).
