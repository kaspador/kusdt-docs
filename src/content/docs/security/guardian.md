---
title: Guardian and pause
description: The guardian key, what a pause stops on each side, and who can resume.
---

The **guardian** is the pause role, held by the [monitor](/security/monitor/): a Kaspa key stored in BridgeMint and
in the pool, and an EVM address set in each vault. It can pause the bridge and the pool, and do nothing else. On
any alarm, including a failed INV-1, the monitor uses it to pause both vaults, the minter and the pool, and keeps
them paused until an operator acknowledges the alarm. It never unpauses.

## What the guardian can do

| Side | Guardian | Mechanism |
|---|---|---|
| BridgeMint (Kaspa) | Pause minting | `pause`: a transaction signed by the x-only `guardian` key stored in BridgeMint |
| Each vault (EVM) | Pause the vault | `pause()` from the vault's `guardian` address (the owner can also pause) |
| KasPool (Kaspa) | Pause swaps and new liquidity | `pause`: a transaction signed by the pool's `guardian` key, the same Kaspa key as BridgeMint's |

Tests check that nobody else can pause, and that on the vault the guardian can do nothing else. In BridgeMint
the guardian key is checked only by `pause`.

## What a pause stops

| Paused | Stops | Keeps working |
|---|---|---|
| BridgeMint | `mint` | Governance (`govern`), including `skip_nonce` and `set_limits` |
| Vault | `deposit`, `release`, `refund` | Every owner function, so a fix can be made before unpausing |
| KasPool | `buy`, `sell`, `sell_all`, `add`, `init` | `remove`: liquidity providers can always withdraw. `collect` and the admin's key changes |

A pause never affects kUSDT itself. Transfers between users and burns keep working, because the KCC-20 token has
no pause.

## Who resumes

| Side | Resume | Quorum |
|---|---|---|
| BridgeMint | `unpause` through `govern` | 4 of 5 signers. A bad minting quorum of 3 cannot undo the pause |
| Vault | `unpause()` | The owner only; the guardian cannot unpause |
| KasPool | `unpause` | The pool admin only |

## Replacing the guardian

| Side | How |
|---|---|
| BridgeMint | `set_signers`, which sets the signer set and the guardian together; 4 of 5 signers |
| Vault | `setGuardian`, by the owner (through the timelock on mainnet) |
| KasPool | `set_keys`, by the pool admin |
