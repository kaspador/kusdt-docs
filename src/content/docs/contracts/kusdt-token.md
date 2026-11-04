---
title: The kUSDT token family
description: The kUSDT app on Kaspa L1, its genesis, its covenant ID, and its unmodified KCC-20 token actor.
---

kUSDT is one Argent *app* (`bridge/kaspa/contracts/kusdt.ag`) with three actors that share one covenant ID:

```text
app KUSDT {
    actor KCC20;       // the standard KCC-20 token state and transfers, unmodified
    actor TokenSeed;   // the reference actor for zero-amount receiving states
    actor BridgeMint;  // the only way new kUSDT comes into existence
}
```

| Actor | Source | Role |
|---|---|---|
| `KCC20` | KCC-20 reference (`argent-lang/kcc20-reference`), unmodified | Balances and transfers |
| `TokenSeed` | KCC-20 reference, unmodified | Empty receiving states |
| `BridgeMint` | kUSDT | Issuance. See [BridgeMint](/contracts/bridge-mint/) |

## Launch

| Step | Transaction | Creates |
|---|---|---|
| 1 | KCC-23 preparation (version 1) | One output, and the metadata in its payload |
| 2 | Genesis, spending that output | One `BridgeMint` and one `TokenSeed`; no token balance |

The genesis transaction's covenant ID **is** kUSDT's identity. Wallets and the web app pin it. Because the ID
commits to the preparation outpoint, it also commits to the metadata. See [Token metadata](/concepts/metadata/).

On testnet (TN10) kUSDT's covenant ID is `6711958e2bc51c590426037020d9683ebd5daf42593de1797b65d25b92566314`. The
mainnet one is **to be published**.

## Rules every kUSDT state follows

| Rule | Value |
|---|---|
| Extension commitment | 32 zero bytes, in every state. All kUSDT is one fungible token |
| Template | The standard KCC20 template, hash `9703112ee6e3555107cd168858992b77d3b74f655205b2b463b1f9ec2ec73cf7` |
| Owner schemes | `0x00` to `0x04`, as in KCC-2 |
| Transfers | Standard KCC-20: 1 to 3 token inputs, 1 to 3 token outputs, amounts preserved |
| New states from a mint | Borrowing disabled (`0x00`, zero guard) |

## Why the token code is unmodified

The `KCC20` actor compiles to exactly the bytes of the standard template. Wallets and indexers that already
accept KCC-20 therefore recognise kUSDT states with no kUSDT-specific code. All kUSDT-specific behaviour lives
in `BridgeMint`, which only issues tokens. A transfer of kUSDT never runs BridgeMint's code.

Two tests guard this:

| Test | Shows |
|---|---|
| `tests/template.rs` | The compiled `KCC20` template prefix and suffix equal the standard template wallets accept (a third-party copy, from kcc20-reference commit `c8a0871`) |
| `tests/artifacts.rs` | The checked-in artifact `artifacts/kusdt.json` is what the contracts compile to today |

See [The KCC20 template](/kaspa/kcc20-template/) and [Verify the KCC20 template](/developers/verify-template/).

## TokenSeed

`TokenSeed` lets anyone create a zero-amount kUSDT state for a recipient. It cannot issue tokens:

| Entry | Effect |
|---|---|
| `create(recipient_state)` | Creates a `KCC20` state with amount exactly 0, the token's extension commitment, and a valid owner and borrow scheme; the seed survives unchanged |
| `split(new_owner)` | Creates an additional seed for `new_owner` |
| `rebalance_value(owner_signature)` | The seed's owner changes the seed's KAS deposit |
| `reclaim()` with `reclaim_delegator` | Retires an extra seed with its owner's signature; a seed always survives |

In the simnet run, the genesis seed's owner is the coordinator's key.
