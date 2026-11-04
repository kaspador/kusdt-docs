---
title: Borrowed receive
description: How KCC-20 lets a sender add tokens to a recipient's existing UTXO, and why kUSDT disables it where it matters.
---

Receiving tokens normally creates a new UTXO, and every UTXO needs some KAS. **Borrowed receive** (KCC-20 §5)
lets a sender use one of the recipient's existing token UTXOs as the destination instead. The UTXO is
"borrowed" for one transaction and recreated with a higher amount, without the recipient's signature.

## The rules

A borrowed receive is allowed only on the transfer leader's path, so at most one state per family per
transaction is borrowed. The borrowed successor is the first output of the family, `next_states[0]`. It must:

- **increase** the token amount;
- keep `owner`, `owner_scheme`, `borrow_scheme` and `extension_commitment` unchanged;
- use the expected next `borrow_guard`;
- carry at least the KAS value of the borrowed input.

A borrower can never move tokens to another owner, lower the amount, or reduce the KAS in the UTXO. It does
change the UTXO's outpoint.

## Borrow schemes

| Byte | Scheme | `borrow_guard` holds | Who may borrow |
|---|---|---|---|
| `0x00` | `disabled/v1` | Unused | Nobody |
| `0x01` | `amount-threshold/v1` | A threshold in the first 8 bytes | Anyone who adds more than the threshold |
| `0x02` | `schnorr-signature/v1` | A Schnorr public key | The holder of that key |
| `0x03` | `hash-chain/v1` | The current hash-chain commitment | Whoever holds the next released link, once per link |

## The cost

Because borrowing changes the outpoint, it invalidates any unconfirmed transaction that spends the old one, and
the owner's wallet must find the successor before spending. Repeated borrowing can deny an owner a stable
outpoint.

## Where kUSDT disables it

| State | Borrow scheme | Why |
|---|---|---|
| Every freshly minted kUSDT state | `0x00`, guard all zero | BridgeMint enforces it on every recipient |
| A redemption burn state | `0x00` (required by the specification) | Otherwise anyone could borrow it: add one base unit and recreate it at a new outpoint, which would look like a new burn of the whole amount |
| The KasPool kUSDT reserve | `0x00` | The pool forces it on every reserve successor, so its outpoint changes only through the pool |

A user may turn borrowing on for their own states later, with a normal owner-approved transfer.
