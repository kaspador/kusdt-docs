---
title: Finality
description: When a deposit or a burn counts, on each chain.
---

A signer acts on a deposit or a burn only once it is **final**: deep enough that the chain will not reverse it.

| Chain | A deposit or burn counts once |
|---|---|
| Ethereum | Its block is at or below the `finalized` block |
| BNB Chain | Its block is at or below the `finalized` block |
| Kaspa | Its accepting block is at least 1 000 DAA scores below the virtual DAA score (about 100 seconds); 300 on testnet. Larger burns wait deeper: see [Larger burns wait longer](#larger-burns-wait-longer) |

A node's `finalized` block is that node's word, so a signer believes it only up to 32 blocks below the same node's
head, on every node it asks. On Ethereum that is one epoch and changes nothing: the finalized block is two epochs or
more behind. On BNB Chain the finalized block is 2 blocks behind the head, so a deposit waits these 32 blocks, about 15
seconds. A node that answers `finalized` with its head can then not have a deposit signed at no depth.

## Larger burns wait longer

A release on Ethereum or BNB Chain cannot be undone, so the bigger the payout, the deeper a Kaspa reorganization would
have to reach before the bridge pays it. On mainnet a burn output waits:

| Burn output | Waits at least | About |
|---|---|---|
| Up to 10 000 kUSDT | 1 000 DAA scores | 100 seconds |
| Above 10 000 kUSDT | 6 000 DAA scores | 10 minutes |
| Above 100 000 kUSDT | 36 000 DAA scores | 1 hour |

The deployment records the tiers (`kaspa.finalityTiers`, each `{above, daa}` in base units), and the coordinator
serves them in [`GET /status`](/protocol/coordinator-api/). Every signer checks them on its own node before it signs a
release, and the coordinator marks a burn `final` by the same rule. The preflight (`kusdt check`) refuses a mainnet
deployment whose tiers are shallower than these. A skip waits the deepest tier before any signer signs its refund,
whatever the refund's size (36 000 DAA, about an hour, on mainnet): a mint signed before the skip never expires, and a
signer rolled back from a snapshot no longer knows it signed one. A refund a signer has already signed is signed again
at the tier of its own amount and what the signer released lately, as a release is.

A tier is chosen by total, not by the payout alone: a signer counts the payout's units together with everything it
released and refunded within the deepest tier's time (an hour on mainnet), so a large redemption split into small
burns waits as deep as the whole. Each signer counts only what it signed itself, by the time it first signed it, and a
payout it already signed it signs again at the tier of its own amount.

The monitor judges by total too (since round 15, R15-PAY-1), and since round 16 by when the signers could have signed
each payout, not by the vault's order or a payout's readyAt. It cannot see a signature's time, only its bounds: no
honest signer signs a payout before its burn (or skip) is as deep as the payout's own amount asks, and every signature
came before the monitor first judged the payout queued. Take payouts of one kind on one vault whose bounds all fit in
three quarters of the hour (45 minutes; the quarter covers a network as slow as 7.5 DAA a second). Each signer signed
its share of them within its hour, so the last one it signed counted all the others it signed; each payout has three
signatures among five signers, so one signer signed at least three fifths of their total. One of them must therefore
be as deep as the tier of three fifths of their total, or `release-before-finality` (`refund-before-finality`) is
raised. A payout that is already deep enough for a tier is left out of that tier's count, so one deep payout does not
hide a shallow split. Three keys that split a 250 000 redemption into 25 releases of 10 000 and sign each at the
shallow tier raise it from the second release on. A relay that fails and is tried again later, a payout signed again
after another one, and a payoutDelay the owner changes move none of these bounds, so none of them raises it for honest
payouts (round 16: R16-ST-2, R16-FIX-2, R16-FIX-3). What the monitor does not count (payouts on the other vault,
refunds against releases, payouts first signed long before it judged them) makes it ask for less than the signers do,
never more. While the operators have a signer rotation announced, the new keys count as more signers, so the share is
three of all of them.

This was added on 5 November 2026, after an external review asked why a 250 000 USDT payout waited the same 100
seconds as a small one. The tiers change no contract: finality is checked by the signers.

## Terms

| Term | Meaning |
|---|---|
| `finalized` block | The block tag that Ethereum and BNB Chain nodes report for the newest block their consensus has finalized |
| DAA score | Kaspa's measure of the DAG's progress. It rises about 10 times per second |
| Virtual DAA score | The DAA score of the node's *virtual* block, its current view that merges all DAG tips |
| Accepting block | The block that accepts a transaction into Kaspa's ledger |

## Why it matters

- A deposit minted before it is final could be reversed on the EVM chain after the kUSDT exists. The kUSDT would
  then be unbacked.
- A burn released before it is final could be reversed on Kaspa after the USDT is paid. The vault would then pay
  for tokens that were never burned.

Each signer measures finality on its own nodes. A request from the coordinator that claims finality is not
evidence.
