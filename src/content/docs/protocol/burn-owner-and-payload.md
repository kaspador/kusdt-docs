---
title: Burn owner and payload
description: The exact bytes of the burn owner that fixes a redemption's payout, and of the redemption payload.
---

## The burn script R

A burn owner is the P2SH hash of a short script `R` that names the payout:

```text
R(chain, address) = 6a ‖ 0f ‖ "kUSDT/redeem/v1" ‖ 01 ‖ chain ‖ 14 ‖ address[20]
burn owner        = owner_scheme 0x03 (p2sh), owner = BLAKE2b-256(R)
```

| Bytes | Value | Meaning |
|---|---|---|
| 1 | `6a` | `OP_RETURN`: the script fails as soon as it runs |
| 1 | `0f` | Push the next 15 bytes |
| 15 | `kUSDT/redeem/v1` | Tag (ASCII) |
| 1 | `01` | Push the next byte |
| 1 | `01` or `02` | Chain code: Ethereum or BNB Chain |
| 1 | `14` | Push the next 20 bytes |
| 20 | address | The EVM address to pay |

`R` is always 40 bytes.

## Why it works

- **Nobody can spend it.** A `p2sh` owner approves only through an input whose redeem script is exactly `R`.
  `R` starts with `OP_RETURN`, so that input always fails. Tokens sent to a burn owner can never move again.
- **Nobody can redirect it.** The payout chain and address are inside `R`, and `R` is fixed by the hash in the
  token state. A signer checks that a `Release` names exactly that chain and address.
- **Nobody can borrow into it.** The burn state must use borrow scheme `0x00`, with a zero borrow guard and a
  zero extension commitment. Otherwise a third party could recreate it at a new outpoint with one more unit,
  which would look like a second burn. Signers refuse any other burn state, and its kUSDT is lost.

## Worked example

For chain `01` (Ethereum) and the address `0x1111111111111111111111111111111111111111`:

```text
R     = 6a0f6b555344542f72656465656d2f76310101141111111111111111111111111111111111111111
owner = 09d6acad2a8e131ae14825cbf7362cc85042f7355baed747aed5599f76afe87e   (BLAKE2b-256 of R)
```

These values were computed from the formula above. Check your own with
[`kusdt-tx burn-owner`](/developers/kusdt-tx/#protocol-helpers), which returns the owner and the script.

## The redemption payload

A Kaspa transaction has a free *payload* field. A redemption transaction should carry the preimages of its burn
owners there, so the bridge can find and check them:

```text
payload = "KUSDT" ‖ 01 ‖ count[1] ‖ count × ( output_index[1] ‖ chain[1] ‖ address[20] )
```

| Bytes | Value | Meaning |
|---|---|---|
| 5 | `KUSDT` | Magic (ASCII, upper case) |
| 1 | `01` | Payload kind: redemption |
| 1 | count | Number of burn outputs described, 1 to 255 |
| 22 × count | entries | For each: output index (1 byte), chain code (1 byte), EVM address (20 bytes) |

A payload is `7 + 22 × count` bytes. For one burn at output 0 to the address above on Ethereum:

```text
4b55534454 01 01 00 01 1111111111111111111111111111111111111111
```

## A missing payload

The payload is a convenience, not a requirement. If a burn has no payload, or the payload is wrong, anyone can
later give the coordinator the preimage: the transaction ID, output index, chain and address, with the burn state. The coordinator
checks it against the burn owner. The [coordinator API](/protocol/coordinator-api/) accepts it on
`POST /redeems`.

:::note
The tag in `R` is `kUSDT/redeem/v1` (mixed case). The tag in the EVM redeem ID is `kusdt/redeem/v1` (lower case),
and the payload magic is `KUSDT`. All three are exact byte strings; do not normalise them.
:::
