---
title: BridgeMint
description: The only issuer of kUSDT. A Kaspa covenant that mints with 3 of 5 signatures, exactly once per deposit, within a rate limit and a hard cap.
---

`BridgeMint` is an actor in the kUSDT covenant family (`bridge/kaspa/contracts/bridge_mint.ag`). It is the only
way new kUSDT comes into existence. There is exactly one BridgeMint UTXO; every spend creates its successor.

## What it enforces, whoever builds the transaction

| Property | How |
|---|---|
| Quorum | 3 of the 5 signers sign every mint, over a digest that names the covenant, the chain, the first nonce and every recipient and amount |
| Exactly once, in order | Each vault numbers deposits 0, 1, 2, …; BridgeMint keeps the next nonce per chain. A mint must start at that nonce and moves it forward |
| Rate limit | Mints draw on an allowance that refills over DAA score up to a ceiling |
| Hard cap | `remaining` only goes down. Nothing can raise it |
| Pause | The guardian key can pause minting. Only 4 of the 5 signers can resume it, so a bad minting quorum of 3 cannot undo a pause |
| Governance | Unpausing, changing limits, the signer set or the guardian, and skipping a nonce need 4 of 5 and a fresh admin nonce. Only changing the minter's own KAS deposit needs 3 |

## Constants

| Name | Value |
|---|---|
| `SIGNERS` | 5 |
| `MINT_QUORUM` | 3 |
| `ADMIN_QUORUM` | 4 |
| `MAX_MINTS` | 3 recipients per mint |
| `CHAIN_ETHEREUM`, `CHAIN_BSC` | `0x01`, `0x02` |
| Actions | `0x01` unpause, `0x02` set_limits, `0x03` set_signers, `0x04` skip_nonce, `0x05` set_value |

## State

| Field | Type | Meaning |
|---|---|---|
| `remaining` | int | Issuance left under the hard cap, in base units. Starts at 10¹⁵ |
| `bucket` | int | The mint allowance at DAA score `last_daa`, before refilling |
| `last_daa` | int | DAA score of the last mint, or of genesis |
| `capacity` | int | Ceiling of the allowance |
| `refill_per_daa` | int | Allowance regained per DAA score unit |
| `nonce_ethereum`, `nonce_bsc` | int | Next deposit nonce to mint, per chain |
| `admin_nonce` | int | Nonce the next governance message must carry |
| `paused` | bool | Minting stopped |
| `signer_set` | byte[32] | `BLAKE3(k₀ ‖ k₁ ‖ k₂ ‖ k₃ ‖ k₄)` of the five x-only keys, in order |
| `guardian` | pubkey | x-only key that may pause |
| `extension_commitment` | byte[32] | The KCC-20 extension commitment of every kUSDT state: zero |

## Entries

### `mint`

```text
mint(chain, first_nonce, now_daa, recipients: KCC20State[], signer_keys, signer_indices, signatures)
emits minter: BridgeMint, minted: KCC20[1..=3]
```

Checks, in order:

1. not paused, and one minted output per recipient;
2. every recipient: `amount > 0`, a valid owner scheme, borrow scheme `0x00`, borrow guard zero, extension
   commitment equal to the minter's (zero);
3. `chain` is `0x01` or `0x02`, and `first_nonce` equals that chain's next nonce;
4. `tx.daa ≥ now_daa` (the lock time) and `now_daa ≥ last_daa`;
5. `total ≤ refilled allowance` and `total ≤ remaining`;
6. the quorum: `signer_keys` hash to `signer_set`, exactly 3 indices in strictly increasing order and below 5, and
   each signature verifies over the mint digest with the indexed key;
7. the successor BridgeMint has exactly: `remaining − total`, `bucket = available − total`, `last_daa = now_daa`,
   the advanced nonce, everything else unchanged, and the same KAS value;
8. each minted output is a `KCC20` state equal to its recipient. Its KAS value is unrestricted: the submitter
   funds it (in kUSDT, the coordinator, out of the deposit fee).

### `pause`

```text
pause(guardian_signature)    emits minter: BridgeMint
```

A transaction signature by the `guardian` key. The successor is identical except `paused = true`, with the same
KAS value.

### `govern`

```text
govern(action, params, now_daa, signer_keys, signer_indices, signatures)    emits minter: BridgeMint
```

One entry for every governance action. The quorum is 3 for `set_value` and 4 for every other action, `unpause` included. The
signatures cover the govern digest at the current `admin_nonce`; the successor has `admin_nonce + 1`.

| Action | Effect |
|---|---|
| `unpause` | `paused = false`. Params must be empty. Needs 4, so that 3 bad signers cannot undo the guardian's pause |
| `set_limits` | New `capacity` and `refill_per_daa`, both non-negative. The allowance is first settled at the old rate up to `now_daa` (proved by the lock time), then lowered to the new ceiling if above it, and `last_daa = now_daa` |
| `set_signers` | New `signer_set` and `guardian`. Takes effect at once: the old set can no longer mint |
| `skip_nonce` | Moves one chain past its current nonce, which must be named exactly. The vault then refunds that deposit |
| `set_value` | Sets the minter's own KAS deposit (above 0), keeping its state |

Every governance message is single-use, because it names `admin_nonce` and each one advances it.

## The allowance, without overflow

```text
refilled(bucket, last_daa, now_daa, capacity, refill):
    if refill > 0 and bucket < capacity:
        needed = ceil((capacity − bucket) / refill)
        filled = capacity                        if now_daa − last_daa ≥ needed
               = bucket + elapsed × refill       otherwise
    return min(filled, capacity)
```

The product `elapsed × refill` is formed only when it stays below `capacity − bucket + refill`, so it never
overflows 64 bits.

## Signature-operation budget

Kaspa nodes relay at most 15 signature operations per P2SH input, counted over the whole script whether or not
they run. BridgeMint's quorum loop is unrolled to 4, so:

| Entry | Signature checks |
|---|---|
| `mint` | 4 |
| `govern` | 4 |
| `pause` | 1 |
| Total in the script | 9 |

Five separate governance entries would have needed 20 on their own, 25 in the whole script, above the limit. That is why governance is a single entry with one
quorum check. See [Signature operations](/kaspa/signature-operations/).

## Tests

21 tests run BridgeMint in Kaspa's script engine (`bridge/kaspa/tests/bridge_mint.rs`). Every test transaction
is also checked for relay standardness (at most 15 signature operations per input). They cover:

| Area | What is shown |
|---|---|
| Genesis and minting | Genesis creates the minter and a seed in one family; one deposit with 3 signatures; a batch of 3; minted tokens spend through the standard KCC-20 transfer |
| Exactly once | Chains count nonces separately; a deposit cannot be minted twice; skipping ahead is refused |
| Quorum | 2 signatures, a repeated signer, signers out of order, an index past the set, a wrong key set, and 4 or 5 signatures where 3 are expected are all rejected |
| Binding | Signatures for another amount, owner, chain or covenant are rejected; unknown chains are refused |
| Output shape | Minted states must be plain kUSDT; every standard owner scheme is accepted |
| Limits | The allowance refills over DAA score and stops at the ceiling; `now_daa` must be covered by the lock time; the hard cap cannot be exceeded |
| Successor | The minter keeps its KAS deposit; a successor that forgets a mint, restores its cap or changes signers is rejected |
| Pause and governance | Only the guardian pauses; a minting quorum of 3 cannot unpause, 4 can; governance messages are single-use; limits and signer rotation need 4; rotation takes effect at once; a nonce can be skipped by 4; the KAS deposit changes only by quorum |
