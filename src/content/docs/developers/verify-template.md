---
title: Verify the KCC20 template
description: Three ways to check that kUSDT's token code is the standard KCC-20 template.
---

kUSDT's claim that its token code is the unmodified KCC-20 reference can be checked three ways.

## 1. Run the test

```sh
bash tools/rust.sh bridge/kaspa cargo test --test template
```

`kcc20_template_matches_the_one_wallets_accept` compiles the kUSDT app from source, extracts the `KCC20`
template (prefix and suffix) the way wallets do, and compares both byte for byte with
`vendor/third-party/kaspire-kcc20_standard_template.json`, a wallet's copy of the standard template taken from
kcc20-reference commit `c8a0871`.

## 2. Ask the builder

```sh
kusdt-tx template
```

The answer is `{templateHash, prefix, suffix}`, read from the checked-in artifact that every builder uses. The
template hash must be:

```text
9703112ee6e3555107cd168858992b77d3b74f655205b2b463b1f9ec2ec73cf7
```

Compare `prefix` and `suffix` with the standard template file. `tests/artifacts.rs` separately proves that the
checked-in artifact is what the contracts compile to.

## 3. Recompute the hash yourself

KCC-1 defines the template hash as:

```text
TemplateHash(prefix, suffix) = BLAKE3( LE64(len(prefix)) ‖ prefix ‖ LE64(len(suffix)) ‖ suffix )
```

where `LE64` is an 8-byte little-endian length. Take the prefix and suffix from the standard template file,
compute the hash with any BLAKE3 implementation, and compare it with kUSDT's.

## What this proves, and what it does not

It proves that kUSDT balances run exactly the standard KCC-20 token code, so wallets that support KCC-20 handle
kUSDT states correctly. It does not prove that a given UTXO is kUSDT: other tokens share the same template. Check
the covenant ID as well.
