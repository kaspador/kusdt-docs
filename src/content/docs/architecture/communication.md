---
title: Communication
description: Every message between kUSDT components, who signs it, and what checks it.
---

kUSDT's components never take each other's word for anything that moves funds. Each message is either read
directly from a chain or carries signatures that a contract checks.

## Channels

| From | To | What | How the receiver checks it |
|---|---|---|---|
| Vault | Each signer | `Deposit` events | Read from every one of the signer's own EVM RPCs, which must agree on every field; counted only once the block is finalized |
| Kaspa | Each signer | Burn outputs and BridgeMint state | Read from the signer's own Kaspa node; counted only 1 000 DAA below the virtual DAA score (300 on testnet), and deeper for larger burns |
| Signer | Coordinator | Signatures (see below) | The coordinator only relays them; the contracts check them |
| Coordinator | BridgeMint | Mint transactions | BridgeMint checks 3 signatures, the nonce, the limits and every output |
| Coordinator | Vault | `release` and `refund` calls | The vault checks 3 signatures, replay, backing and the allowance |
| Vaults and Kaspa | Monitor | Deposits, releases, refunds, backing, mints, burns, governance | Read from the monitor's own nodes, Kaspa in acceptance order; nothing from the coordinator. Owner events and queued AccessManager operations must agree on every RPC; a disagreement counts as a failed read, and 10 minutes of failed reads is an alarm that pauses everything (see [The monitor](/security/monitor/)) |
| Monitor | Guardian action | Pause | The vault accepts `pause` from the guardian or owner; BridgeMint and the pool accept a transaction signed by the guardian's Kaspa key |
| Coordinator | Web app and wallet | Status, pool, positions, token states | Informational; the wallet verifies every covenant state against its node (see [Following covenant states](/architecture/following-states/)) |
| User | Kaspa | Transfers, swaps, liquidity, burns | Kaspa nodes run the covenants |
| User | Vault | Deposits | The vault checks the amount and the owner scheme |

In the current services, each signer sits behind an HTTP API that only the coordinator may call (with a bearer
token). The request only says what to look at: the signer reads the deposit or the burn itself, from its own
nodes.

## What each key signs

| Key | Held by | Signs | Checked by |
|---|---|---|---|
| Kaspa Schnorr key (×5) | Signers | Mint digest (`kUSDT/mint/v1`) | `BridgeMint.mint`: 3 distinct signers |
| Kaspa Schnorr key (×5) | Signers | Govern digest (`kUSDT/govern/v1`) | `BridgeMint.govern`: 3 or 4 distinct signers |
| EVM ECDSA key (×5) | Signers | EIP-712 `Release` | `KusdtVault.release`: 3 or more distinct current signers |
| EVM ECDSA key (×5) | Signers | EIP-712 `Refund` | `KusdtVault.refund`: same rule |
| Guardian Kaspa key | Monitor | The pause transactions | `BridgeMint.pause`, `Pool.pause` |
| Guardian EVM address | Monitor | The `pause()` call | `KusdtVault.pause` |
| Pool admin key | The operator, offline | `collect`, `unpause`, `set_keys` transactions | `Pool` |
| Vault owner | A Safe, through the AccessManager | Scheduled admin calls, executed after their delay | The AccessManager, then `KusdtVault` (owner only) |
| User keys | Wallet | Token transfers, swaps, deposits | KCC-20 covenants, KasPool, the vault |

Exact byte layouts are on [Messages and digests](/protocol/messages/).

## Who can submit

Anyone can submit a correctly signed mint, release or refund. The coordinator does it normally, but it has no
special permission. If the coordinator stops, any party holding the signatures can submit them. The vault tests
include "anyone may submit a valid release (the coordinator isn't trusted)".

## Ordering

- **Mints** follow each chain's deposit nonce strictly: BridgeMint accepts only a batch that starts at the next
  unminted nonce of that chain. Ethereum and BNB Chain count separately.
- **Releases** have no order. Each burn output is paid at most once, by its `redeemId`.
- **Governance** messages carry BridgeMint's `admin_nonce`, so each one is single-use and they apply in order.
