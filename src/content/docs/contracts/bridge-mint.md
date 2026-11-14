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
| Pause | The guardian key can pause minting. Only 4 of the 5 signers can resume it, so a bad minting quorum of 3 cannot undo a pause. A pause also voids every governance signature made before it |
| Governance | Unpausing, changing limits, the signer set or the guardian, skipping a nonce and changing the minter's own KAS deposit need 4 of 5 and a fresh admin nonce |
| Recovery | If two keys are lost for good, 3 signers can propose a new signer set and guardian. It can be carried out once the minter has stood untouched for 72 hours, and any single signer can veto it until then |
| Settled inputs | Every entry checks every input (`require_settled_inputs`, since rc.22). The minter input's sequence is exactly the age claimed, above 0 only on a minter coin already in a block. Every other input asks no age, is in a block or comes from the transaction that made the minter coin, and is a plain Schnorr P2PK coin or a kUSDT coin. At most 8 inputs. So a minter transaction a node accepts, a copy of a signed one included, is one a block can take |

## Constants

| Name | Value |
|---|---|
| `SIGNERS` | 5 |
| `MINT_QUORUM` | 3 |
| `ADMIN_QUORUM` | 4 |
| `MAX_MINTS` | 3 recipients per mint |
| `MAX_LIMIT` | 10¹⁵ base units: the highest allowance ceiling and refill rate `set_limits` accepts (the lifetime cap) |
| `MIN_MINTED_VALUE` | 100 000 000 sompi (1 KAS): the least KAS every minted output carries |
| `CHAIN_ETHEREUM`, `CHAIN_BSC` | `0x01`, `0x02` |
| Actions | `0x01` unpause, `0x02` set_limits, `0x03` set_signers, `0x04` skip_nonce, `0x05` set_value |

## State

| Field | Type | Meaning |
|---|---|---|
| `remaining` | int | Issuance left under the hard cap, in base units. Starts at 10¹⁵ |
| `bucket` | int | The mint allowance held when this UTXO was created, before its age refills it |
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
mint(chain, first_nonce, age_daa, recipients: KCC20State[], signer_keys, signer_indices, signatures)
emits minter: BridgeMint, minted: KCC20[1..=3]
```

Checks, in order:

1. not paused, and one minted output per recipient;
2. every recipient: `amount > 0`, a valid owner scheme, borrow scheme `0x00`, borrow guard zero, extension
   commitment equal to the minter's (zero);
3. `chain` is `0x01` or `0x02`, and `first_nonce` equals that chain's next nonce;
4. `age_daa` is at most the minter UTXO's age: consensus holds the input back until it is that old (a relative lock, 0 to 2³² − 1; the input's sequence is exactly `age_daa`, and an age above 0 needs the minter UTXO in a block). The spend starts a new UTXO at age zero, so no stretch of time refills the allowance twice;
5. `total ≤ refilled allowance` and `total ≤ remaining`;
6. the quorum: `signer_keys` hash to `signer_set`, exactly 3 indices in strictly increasing order and below 5, and
   each signature verifies over the mint digest with the indexed key;
7. the successor BridgeMint has exactly: `remaining − total`, `bucket = available − total`,
   the advanced nonce, everything else unchanged, and the same KAS value;
8. each minted output is a `KCC20` state equal to its recipient, and carries at least `MIN_MINTED_VALUE` (1 KAS).
   The submitter funds it (in kUSDT, the coordinator, out of the deposit fee, with 1.5 KAS each).

The floor in rule 8 is new in rc.16. The signers sign who gets how much kUSDT, not the KAS each output carries. So
anyone who sees a signed mint before it is accepted can send a copy of it with their own funding, and before the
floor that copy could give a recipient almost no KAS: the kUSDT arrived, but a recipient holding no KAS could not
move it until they got some. Now a copy carries at least 1 KAS per output, which is enough to send all of that kUSDT or to redeem all of it
with no other coin (kUSDT Wallet then takes the fee of a send out of that KAS, and says so in the review). Sending or redeeming only a part of it leaves change, and that usually needs more KAS: the wallet says so before anything is signed and offers all of it instead. It can
still carry less than the coordinator's 1.5 KAS. The floor applies to every minted output, also one whose owner is a
burn owner (a deposit can name one, and the mint is then the burn): the coordinator funds that output like any other.

### `pause`

```text
pause(guardian_signature)    emits minter: BridgeMint
```

A transaction signature by the `guardian` key, on a minter that is not paused. The successor is identical except
`paused = true` and `admin_nonce + 1`, with the same KAS value. Moving the nonce voids every 4-of-5 message signed for
the nonce the minter held. It does not void a message signed for the nonce it moves to (which is why an unpause signs
the paused coin itself, below), a mint signed earlier (good again once unpaused, until its nonce is minted or skipped
or its signers are replaced), or a recovery proposal or veto.

### `govern`

```text
govern(action, params, age_daa, signer_keys, signer_indices, signatures)    emits minter: BridgeMint
```

One entry for every governance action. The quorum is 4 for every action, `unpause` and `set_value` included, because each one moves the shared `admin_nonce`. The
signatures cover the govern digest at the current `admin_nonce` (for `unpause`, the unpause digest, which also names the
minter coin being spent); the successor has `admin_nonce + 1`.

```text
govern digest:   BLAKE3("kUSDT/govern/v2"  ‖ covenant_id[32] ‖ nonce[8] ‖ age_daa[8] ‖ action[1] ‖ params)
unpause digest:  BLAKE3("kUSDT/unpause/v2" ‖ covenant_id[32] ‖ admin_nonce[8] ‖ age_daa[8] ‖ outpoint_txid[32] ‖ outpoint_index[8])
```

Integers are 8 bytes, little-endian. `nonce` is `admin_nonce`, or `recovery_nonce` for a recovery proposal or veto.
`age_daa` is the `age_daa` argument of the spend: the script puts the argument itself into the digest it checks, so the
signatures are good for that one age.

| Action | Effect |
|---|---|
| `unpause` | `paused = false`, only on a paused minter. Params must be empty. Needs 4, so that 3 bad signers cannot undo the guardian's pause. Signed over the unpause digest, the outpoint being the paused minter UTXO it spends. So it cannot be signed before the pause exists, and any other spend of the paused minter voids it: a recovery proposal (3 signers), and, while a proposal stands, a veto by any one signer. With a proposal standing, veto it or let it be carried out first, then sign the unpause |
| `set_limits` | New `capacity` and `refill_per_daa`, both from 0 to `MAX_LIMIT` (10¹⁵; the ceiling is new in rc.16). Without it, four signers could set limits so large that every later step overflowed: no mint, no change of limits, no recovery, for good. The allowance, already settled at the old rate (every action settles it), is lowered to the new ceiling if above it |
| `set_signers` | New `signer_set` and `guardian`. Takes effect at once: the old set can no longer mint |
| `skip_nonce` | Moves one chain past its current nonce, which must be named exactly. The vault then refunds that deposit |
| `set_value` | Sets the minter's own KAS deposit (above 0), keeping its state |

Every governance message is single-use, because it names `admin_nonce` and each one advances it.

A spend restarts the minter UTXO's age, so every `govern` action settles the allowance first, with the `age_daa` it claims. A mint's `age_daa` is part of the mint digest, so nobody can resubmit a signed mint claiming less and throw the refill away. Since rc.16 the same holds for governance: `age_daa` is part of the govern digest and of the unpause digest. `pause` and `execute_recovery` claim no age: time since the last spend is not credited to the allowance.

**What each entry does about the age**

| Entry | Age it claims | Who fixes it |
|---|---|---|
| `mint` | `age_daa`, at most the UTXO's real age | The 3 signers: it is in the mint digest |
| `govern`, every action but `unpause` | `age_daa`, at most the UTXO's real age | The signers of the action (4, 3 for a proposal, 1 for a veto): it is in the govern digest |
| `govern`, `unpause` | `age_daa`, at most the paused UTXO's real age | The 4 signers: it is in the unpause digest, next to the coin |
| `pause` | None. The allowance stays as the UTXO held it | Nobody: there is no age to choose. The guardian signs the whole transaction |
| `execute_recovery` | None. The allowance stays as the UTXO held it | Nobody: there is no age to choose, and no signature. The input's sequence must be `recovery_delay` |

**A signed age is also a wait.** Consensus holds a spend back until the minter UTXO is as old as the age it claims.
Governance signatures name no coin (an unpause aside) and are gathered over minutes or hours. If anything spends the
minter in between, the new UTXO starts at age zero, and an action signed for age N can be sent only once that UTXO is
N DAA old. Others can make that happen: a deposit leads to a mint, a holder of three signer keys can mint or propose
a recovery, the guardian can pause. An age of 0 is always valid on any UTXO and credits no refill. So the tools sign
a rotation of the signers, a recovery proposal and a veto for age 0 unless told otherwise, and for the other actions
default to the UTXO's age less a margin, and refuse more than a full refill needs.
See [Operations](/developers/operations/#the-age-every-signer-signs).

**What is still not credited.** The time between the age the signers signed and the moment the action lands (the
margin, plus the time it takes to gather and send the signatures). The whole refill, when the signers choose age 0.
The time before a `pause`, and the whole wait before an `execute_recovery`, because those two entries claim no age.
Each of these delays mints until the allowance has refilled. None can mint, move or lose anything.

## The allowance, without overflow

```text
refilled(bucket, age_daa, capacity, refill):
    if refill > 0 and bucket < capacity:
        needed = ceil((capacity − bucket) / refill)
        filled = capacity                        if age_daa ≥ needed
               = bucket + age_daa × refill       otherwise
    return min(filled, capacity)
```

The product `age_daa × refill` is formed only when it stays below `capacity − bucket + refill`, so it never
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

Tests run BridgeMint in Kaspa's script engine (`bridge/kaspa/tests/bridge_mint.rs`). Every test transaction
is also checked for relay standardness (at most 15 signature operations per input). They cover:

| Area | What is shown |
|---|---|
| Genesis and minting | Genesis creates the minter and a seed in one family; one deposit with 3 signatures; a batch of 3; minted tokens spend through the standard KCC-20 transfer |
| Exactly once | Chains count nonces separately; a deposit cannot be minted twice; skipping ahead is refused |
| Quorum | 2 signatures, a repeated signer, signers out of order, an index past the set, a wrong key set, and 4 or 5 signatures where 3 are expected are all rejected |
| Binding | Signatures for another amount, owner, chain or covenant are rejected; unknown chains are refused |
| Output shape | Minted states must be plain kUSDT; every standard owner scheme is accepted |
| Limits | The allowance refills over DAA score and stops at the ceiling; a claimed age must be covered by the input's sequence, and a spend consumes it; the hard cap cannot be exceeded |
| Successor | The minter keeps its KAS deposit; a successor that forgets a mint, restores its cap or changes signers is rejected |
| Pause and governance | Only the guardian pauses; a minting quorum of 3 cannot unpause, 4 can; governance messages are single-use; limits and signer rotation need 4; rotation takes effect at once; a nonce can be skipped by 4; the KAS deposit changes only by quorum |
| Since rc.16 | A pause voids every admin signature made before it; only a paused minter is unpaused; limits above the lifetime cap are refused, and at the ceiling itself the minter still works |
