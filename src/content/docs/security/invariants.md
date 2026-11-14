---
title: Invariants
description: The five properties kUSDT must keep, INV-1 to INV-5, and where each is enforced.
---

The specification names five invariants. This page states each one and shows what enforces it: the Kaspa
covenants, the vault, the signers, or the monitor.

## INV-1: backing covers circulation

> kUSDT in circulation = minted − burned ≤ Σ vault backing, where a vault's backing is `balance − feesAccrued`.

| Enforced by | How |
|---|---|
| Vault accounting | `balance / scale = backing() + feesAccrued` at all times; only `release` and `refund` reduce backing |
| Monitor and guardian | The [monitor](/security/monitor/) checks INV-1 with each vault read at one block, from its own nodes; on an `inv1` alarm the guardian pauses both vaults, the minter and the pool |
| Public check | The web app's Reserves page showed it live on the public testnet (4 to 14 November 2026), reading the vaults and the minter itself. The coordinator API's `GET /reserves` reports supply, backing and `healthy`, meaning total backing ≥ minted − released. That is INV-1 only while every payout has a burn behind it: a payout with none lowers both sides alike. The monitor's `release-without-burn` alarm is the check on that, so the page calls the reserves healthy only on the monitor's own healthy answer. On mainnet it is to be published live at launch |

No single contract can enforce INV-1, because it spans three chains. The randomized vault test checks the vault's
part after every step.

## INV-2: each deposit is minted once or refunded once

> Every vault deposit nonce is minted once or refunded once, never both.

| Enforced by | How |
|---|---|
| BridgeMint | Mints start exactly at each chain's next nonce and move it forward; a nonce cannot be minted twice (tested) |
| Vault | `depositMinted[nonce]` is cleared on refund; a second refund is rejected (tested) |
| Signers | "Never both": a refund is signed only for a nonce Kaspa skipped. The vault cannot see Kaspa |
| Signers | A mint is signed only while the vault's live `depositMinted(nonce)`, read on every RPC, is non-zero, and never for a nonce the signer's own minter follower shows skipped: no mint is signed after its refund (tested). A nonce its follower shows the minter has passed gets no first mint signature either, so old deposits cannot be charged to its daily limit (tested) |
| Finality depth | A mint signed before the skip stays valid: a mint signature does not expire. A Kaspa reorg deep enough to undo the skip frees the nonce, and that mint could then land after the refund was paid. So "never both" rests on the depth the skip has before any signer signs the refund: the deepest finality tier, whatever the refund's size and whatever the signer remembers signing (since round 14: a signer rolled back from a snapshot forgets its mint signatures; tested). It is the same assumption every release rests on |
| Monitor | A mint that names a deposit a vault refunded, or queued a refund for, is the alarm `mint-of-refunded-deposit`: from the refunds the monitor has seen that the owner has not cancelled, which a Kaspa reorg does not make it forget, and from `isRefunded(nonce)` read on every RPC (tested). It comes after the fact and pauses everything; it does not undo the mint |

## INV-3: each burn is released at most once

> Every burn output is released at most once (`redeemId`).

| Enforced by | How |
|---|---|
| Vault | `redeemed[redeemId]` is set on release; a second release is rejected (tested) |
| Burn states | Borrowing is disabled on burn states, so a burn cannot be recreated at a new outpoint with a new redeem ID |

## INV-4: no single key moves funds

> No single key, the coordinator included, can mint, release or refund.

| Enforced by | How |
|---|---|
| BridgeMint | 3 distinct signers for a mint, 3 or 4 for governance (tested) |
| Vault | At least 3 distinct current signers for release and refund (tested) |
| Roles | The guardian can only pause; the coordinator holds no signing key |

## INV-5: daily limits

> Within any 24 hours, less than three times each vault's release allowance can leave it (a full bucket, a day of
> refill and one queue drawn earlier), whatever signer, guardian or coordinator keys are stolen: only the vault owner
> sets that allowance. At most twice the Kaspa allowance can be
> minted unless 4 signer keys are stolen; with 4, the remaining hard cap is the bound and INV-1's monitor is the
> defence.

| Enforced by | How |
|---|---|
| Vault | The release allowance, drawn by releases and refunds; a full refill takes at least a day; only the owner changes it (tested) |
| BridgeMint | The mint allowance (changed only by 4 of 5 signers) and the hard cap, which nothing raises (tested) |
| Monitor | With 4 stolen signer keys on the Kaspa side, INV-1's monitor and the guardian's pause of the vaults are the defence |

The bound comes from the bucket: an allowance can be spent in full and keeps refilling, so a full bucket plus one
day of refill can be drawn in any 24-hour window. On a vault a queue drawn before the window can be paid inside it as well. See [Limits](/protocol/limits/#most-that-can-move-in-a-window).

| Stolen keys | Each vault, any 24 h | Kaspa minting, any 24 h |
|---|---|---|
| Up to 3 signer keys, the guardian, the coordinator | Under 3 × 50 000 USDT (at the launch) | At most 2 × 100 000 USDT (at the launch) |
| 4 or 5 signer keys | Under 3 × 50 000 USDT (at the launch) | Up to the remaining hard cap |
| The vault owner | Not bounded by INV-5 | The owner has no power on Kaspa |
