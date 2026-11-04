---
title: States and templates (KCC-1)
description: How a covenant stores its state inside its own script, and how templates let wallets recognise a covenant.
---

KCC-1 ("Covenant Concepts, Byte Layouts, and ABI") is the shared language of Kaspa covenants. It fixes how a
covenant program is wrapped, where its state lives, and how others recognise it. KCC-1 does not change
consensus.

## Terms

| Term | Meaning |
|---|---|
| Covenant program `R` | The complete script, including its current state. KCC-1 uses it as the P2SH redeem script |
| Covenant instance | A UTXO locked to a covenant program, identified by its outpoint |
| Transition | A transaction that consumes covenant instances and creates continuations |
| Continuation | An output that a consumed instance accepts as its successor |
| Entrypoint | A named way to spend the covenant, with typed arguments (for example `mint` or `transfer`) |

## The P2SH envelope

A covenant UTXO does not show its program. Its locking script is a pay-to-script-hash (P2SH) commitment:

```text
OP_BLAKE2B OP_DATA_32 <BLAKE2b-256(R)> OP_EQUAL
```

To spend it, the input's signature script pushes the entrypoint arguments, a 4-byte **dispatch tag** that
selects the entrypoint, and finally `R` itself. The node checks that `R` hashes to the committed value, then
runs `R`.

```text
dispatch_tag = BLAKE3("name(type,type,...)")[0:4]
```

## State lives inside the script

A covenant's **state** is a byte range inside `R`. The rest of `R` is its **template**: a prefix and a suffix.

```text
R = template.prefix ‖ encoded_state ‖ template.suffix
```

When state changes, the program changes, so its P2SH hash changes too. A covenant forces its successor by
rebuilding the expected next program and comparing hashes:

```text
R_next   = template.prefix ‖ encode(next_state) ‖ template.suffix
expected = OP_BLAKE2B OP_DATA_32 <BLAKE2b-256(R_next)> OP_EQUAL
```

An unspent UTXO shows only the hash. Its state becomes visible when it is spent, because `R` appears in the
spending input. Indexers and wallets track state from those spends and from the transactions that created the
UTXOs.

## Template hashes

KCC-1 names a template by its hash:

```text
TemplateHash(prefix, suffix) = BLAKE3( LE64(len(prefix)) ‖ prefix ‖ LE64(len(suffix)) ‖ suffix )
```

Two UTXOs with the same template run the same code, whatever their state. That is how a wallet recognises a
KCC-20 token: it checks the template hash. kUSDT's `KCC20` template hash is the standard one, `9703112e…3cf7`.
See [The KCC20 template](/kaspa/kcc20-template/).

## Leaders and delegators

When several inputs of one covenant ID take part in one transition, KCC-1 assigns roles by input order. The
first such input is the **leader**; it validates the whole transition. Every later one is a **delegator**; it
checks only its local conditions, such as its owner's approval, and relies on the leader. KCC-20 transfers work
this way.

## Commitments to larger values

A **virtual element** is a value stored only as a 32-byte hash commitment, with the full value supplied when
needed. KCC-20's `extension_commitment` field is one: it commits to application-specific extended state. kUSDT
uses no extended state, so its commitment is 32 zero bytes.
