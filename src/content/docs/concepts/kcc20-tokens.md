---
title: KCC-20 tokens
description: The KCC-20 fungible-token convention on Kaspa, and how kUSDT follows it.
---

KCC-20 ("Fungible Token Covenant Specification") is the Kaspa convention for fungible tokens. It fixes the
token state, the transfer interface and the program information that wallets and indexers read. kUSDT's token
actor is the unmodified KCC-20 reference implementation (`argent-lang/kcc20-reference`).

## The token state

Every token UTXO carries one `KCC20State`:

| Field | Type | Meaning | In kUSDT |
|---|---|---|---|
| `amount` | int | Token quantity, never negative | Base units of 10⁻⁶ kUSDT |
| `owner` | byte[32] | Who owns it, read through `owner_scheme` | See [Owner schemes](/concepts/owner-schemes/) |
| `owner_scheme` | byte | The KCC-2 scheme of `owner` | `0x00` to `0x04` |
| `borrow_scheme` | byte | Whether and how others may [borrow](/concepts/borrowed-receive/) the UTXO | `0x00` (disabled) in every minted state |
| `borrow_guard` | byte[32] | Data for the borrow scheme | 32 zero bytes in every minted state |
| `extension_commitment` | byte[32] | Hash of application-specific extended state | Always 32 zero bytes |

States are fungible with each other only if their `extension_commitment` is equal. Every kUSDT state uses zero,
so all kUSDT is one fungible token.

## Transfers

The default KCC-20 configuration has two entrypoints:

```text
transfer(KCC20State[] next_states, byte[] witness)    // the leader
transfer_delegator(byte[] witness)                     // every other token input
```

In a transfer, the first token input of the family is the **leader**. It checks the whole transition:

- `next_states` lists every token output of the family, in order, and each output carries exactly that state;
- the total amount out equals the total amount in;
- every output uses a supported owner scheme, so no transfer can create an unspendable state;
- every input and output has the same `extension_commitment`.

Each other token input is a **delegator** and checks only that its own owner approved.

The first byte of the leader's `witness` selects the path: `0x00` is a normal owner-approved transfer, `0x01` is
a borrowed receive. The rest of the witness carries the owner's authentication:

| Owner scheme | Authentication bytes |
|---|---|
| `p2pk-schnorr/v1` | A 65-byte transaction signature |
| `p2pkh-schnorr/v1` | The 32-byte public key, then a 65-byte transaction signature |
| `p2pkh-ecdsa/v1` | The 33-byte compressed public key, then a 65-byte transaction signature |
| `p2sh/v1` | One byte: the index of the authority input |
| `covenant-id/v1` | Nothing |

A transfer has 1 to 3 token inputs and 1 to 3 token outputs.

## Issuance is up to the application

KCC-20 standardizes transfers, not issuance. The reference ships a `KCC20PublicMint` app that lets anyone mint;
kUSDT does **not** use it. In kUSDT the only way new tokens appear is `BridgeMint`, which needs 3 of the 5
signers. See [BridgeMint](/contracts/bridge-mint/).

## TokenSeed

`TokenSeed` is a reference actor that creates **zero-amount** token states, so someone can prepare a receiving
UTXO. Its `create` entry requires the new state's amount to be exactly 0, so it cannot issue tokens. Its other
entries split a seed, let the seed's owner rebalance its KAS deposit, and reclaim extra seeds, always leaving
one seed alive. kUSDT's genesis creates one `TokenSeed`.

## The program artifact

Each KCC-20 covenant publishes a **program artifact**: the information needed to decode its state and build
transfers (ABI types, state location, entrypoints, templates, supported owner schemes and transfer bounds).
kUSDT's artifact is checked into the repository at `bridge/kaspa/artifacts/kusdt.json`, and a test fails if it
no longer matches the contracts.
