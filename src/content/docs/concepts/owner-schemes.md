---
title: Owner schemes (KCC-2)
description: The five standard ways a KCC-20 state can name its owner, and how kUSDT uses each of them.
---

KCC-2 ("Authority Schemes") defines how a covenant names an **authority**: a key, a key hash, a script or a
covenant lineage whose approval an operation needs. KCC-20 uses it for a token state's `owner`. A one-byte
`owner_scheme` says how to read the 32-byte `owner` value.

## The schemes

| Byte | Scheme | `owner` holds | Approval requires |
|---|---|---|---|
| `0x00` | `p2pk-schnorr/v1` | The 32-byte x-only Schnorr public key | A signature by that key |
| `0x01` | `p2pkh-schnorr/v1` | `BLAKE3(pubkey)` of a 32-byte Schnorr key | Reveal the key, then a signature by it |
| `0x02` | `p2pkh-ecdsa/v1` | `BLAKE3(pubkey)` of a 33-byte compressed ECDSA key | Reveal the key, then a signature by it |
| `0x03` | `p2sh/v1` | `BLAKE2b-256(R)` of one exact redeem script `R` | An input in the same transaction locked to that P2SH script |
| `0x04` | `covenant-id/v1` | A KIP-20 covenant ID | An input in the same transaction that belongs to that covenant |

Bytes `0x05` to `0x7f` are reserved for future standards and must be rejected. Bytes `0x80` to `0xff` are for
custom schemes.

For `p2sh/v1` and `covenant-id/v1`, the authority approves by *taking part* in the transaction. The matching
input runs its own script, and that script decides whether to accept.

## How kUSDT uses them

| Use | Scheme | Why |
|---|---|---|
| A user with a Schnorr address (`kaspa:q…`) | `0x00` | The common case |
| A user with an ECDSA address | `0x02` | `owner = BLAKE3(compressed key)` |
| A user with a P2SH address (`kaspa:p…`) | `0x03` | The 32-byte script hash |
| A contract | `0x04` | The contract's covenant ID |
| A redemption **burn owner** | `0x03` | The hash of a script that starts with `OP_RETURN`, so no input can ever satisfy it |
| The **KasPool reserve** | `0x04` | Owned by the pool's covenant ID, so only a transaction that includes the pool can move it |

The vaults accept owner schemes `0x00` to `0x04` in deposits and reject any other byte. See
[Kaspa recipients](/protocol/identifiers-and-units/#kaspa-recipients). The web app's Bridge form is narrower
than the vault: it takes a Schnorr address (`0x00`) only, since that is the one owner the wallets here can send,
sell and redeem from. A deposit to another scheme is made by calling the vault directly.

## A caution about covenant-ID owners

KCC-2 sets *participation* as the minimum check for `covenant-id/v1`: any input of the owner's covenant ID
counts. That input's own rules must then make sure it is not approving more than intended.

KasPool has two kinds of UTXO in its family, `Pool` and `Position`. Without care, a transaction that spends
only a `Position` would still count as the pool taking part, and could move the pool's kUSDT reserve. KasPool
closes this: every entry that does not check the kUSDT family refuses any kUSDT input. See
[KasPool](/contracts/kaspool/#why-every-entry-guards-the-reserve).
