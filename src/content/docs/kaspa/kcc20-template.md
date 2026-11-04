---
title: The KCC20 template
description: kUSDT's KCC20 template is byte-identical to the standard reference template, so KCC-20 wallets recognise it.
---

:::note[Confirmed]
kUSDT's `KCC20` template is byte-identical to the standard reference template, hash
`9703112e…3cf7`. Wallets that support KCC-20 recognise kUSDT states.
:::

## Why the template matters

A [template](/concepts/states-and-templates/) is a covenant program with its state cut out: a prefix and a suffix.
An unspent covenant UTXO shows only the hash of its program. A wallet that knows the template can rebuild the
program for any candidate state (`prefix ‖ encoded state ‖ suffix`), hash it, and so find or verify the UTXO that
holds that state. If a program matches the standard KCC-20 template, it is a KCC-20 token state, and the wallet
knows how to decode it and how to spend it.

A token that changed even one byte of the token code would have a different template. Wallets would not
recognise it until they added that template.

## kUSDT's template

| | Value |
|---|---|
| Template hash | `9703112ee6e3555107cd168858992b77d3b74f655205b2b463b1f9ec2ec73cf7` |
| Hash function | `BLAKE3(LE64(len(prefix)) ‖ prefix ‖ LE64(len(suffix)) ‖ suffix)` (KCC-1) |
| Source | The `KCC20` actor of `argent-lang/kcc20-reference`, unmodified |
| Compiler | Argent and rusty-kaspa at the revisions the reference pins |

kUSDT compiles the reference actor with the same compiler, runtime and consensus revisions that the reference
pins. That is what makes the bytes identical.

## What is still kUSDT-specific

The template is shared with every standard KCC-20 token. What makes a state **kUSDT** is its covenant ID. A
wallet must therefore match both:

1. the template, to know it is a KCC-20 state;
2. the covenant ID, to know it is kUSDT and not another token.

## The test

`bridge/kaspa/tests/template.rs` compiles the kUSDT app and compares the `KCC20` template's prefix and suffix
with a third-party copy of the standard template that wallets accept (Kaspire's copy, from kcc20-reference commit
`c8a0871`), checked into `vendor/third-party/`. See [Verify the KCC20 template](/developers/verify-template/).
