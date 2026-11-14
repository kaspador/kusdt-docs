---
title: Refunds
description: How a deposit that Kaspa skipped is returned to its depositor, exactly once and never as well as a mint.
---

Mints follow each chain's deposit nonces strictly. A refund is the way out for a deposit that will never be
minted, so that one bad deposit does not block every later deposit of its chain.

## Two steps

1. **Skip on Kaspa.** Four of the five signers sign a `skip_nonce` governance action naming the chain and the
   nonce. BridgeMint accepts it only if the nonce is the chain's current one, and moves the chain past it.
2. **Refund on the EVM chain.** Three signers sign an EIP-712 `Refund`. The coordinator collects them
   (`/sign/refund` on each signer) and calls `vault.refund`; anyone could submit them.

```solidity
function refund(Refund calldata r, bytes[] calldata signatures)
struct Refund { uint64 nonce; address recipient; uint256 units; }
```

## What the vault checks

| Check | Rule |
|---|---|
| The deposit exists | `nonce < depositNonce` |
| Not refunded before | `depositMinted[nonce] ≠ 0`; the vault clears it to 0 when it queues the refund |
| Exact amount | `units` must equal `depositMinted[nonce]`: what the deposit would have minted, not the gross amount |
| Recipient | Not the zero address, not the vault |
| Signatures | At least 3 distinct current signers, in strictly increasing address order, same as a release |
| Backing | `units ≤ unreservedBacking()`, the backing no other queued payout has a claim on |
| Allowance | `units` is drawn from the same release allowance as releases |

The vault then queues the refund and emits `RefundQueued(nonce, recipient, units, readyAt)`. Like every payout it
[waits](/protocol/redemptions-and-releases/#the-wait), 10 minutes on mainnet. Then anyone may call
`executeRefund(nonce)`, the coordinator normally does, and the vault pays `units × scale` to the recipient and emits
`Refunded(nonce, recipient, units)`.

## What the depositor gets back

The depositor gets back exactly the `minted` amount of the original deposit. The deposit fee is kept. No
release fee is charged.

| Deposit | Deposit fee (kept) | Refund |
|---|---|---|
| 100 USDT | 0.50 | 99.50 |
| 10 000 USDT | 20.00 | 9 980.00 |

## What only the signers enforce

The vault cannot see Kaspa, so four rules rest on the signers:

- **Refund only what Kaspa skipped.** A nonce must never be both minted and refunded (INV-2). Each signer follows
  the minter itself, from its own Kaspa node (configured with `initialMinter` and `scanFrom`), and signs a refund only when it sees the `skip_nonce` as final and the nonce never minted. If the chain drops blocks it already read, the signer undoes the minter moves those blocks accepted, so a skip the new chain replaced with a mint no longer stands. It also signs no refund unless the minter it follows is unspent on its own node and its view is at most 100 DAA behind: that output exists only if every move leading to it was accepted, so it proves the whole history, the skip included. A minter that moved a moment ago is refused too, and the coordinator asks again. The other way round, it signs a mint only while the vault's `depositMinted(nonce)` is non-zero on every RPC, and never for a nonce its own follower shows skipped, so no mint is signed after its refund.
- **Wait for the skip to be final.** A mint signed before the skip does not expire. If a Kaspa reorg undid the skip, the nonce would be free again and that mint could land after the refund was paid. No check can take a signature back, so this rests on depth: a signer signs a refund only once the skip is as deep as the deepest finality tier, whatever the refund's size (36 000 DAA, about an hour, on mainnet). Until round 14 a small refund waited only its own tier when the signer had no record of signing a mint for that deposit, and a signer rolled back from a snapshot, or started on new volumes with its key, has no such record even when it signed one. A reorg deeper than that is the one case where a deposit could be both refunded and minted; every release rests on the same assumption.
- **Refund the depositor, exactly.** The recipient must be the `sender` of the original `Deposit` event, and the
  amount exactly its `minted`.
- **Never refund a blocked address.** A signer refuses a refund to an address the token blocks, on every one of
  its RPCs. The USDT would be frozen there for good, since USDT's blacklist stops only senders.

The monitor checks the same rules from its own nodes: `refund-of-minted-deposit` and `refund-without-skip` are
alarms, and so is `mint-of-refunded-deposit`, a mint that names a deposit a vault has refunded (see
[The monitor](/security/monitor/)).

## A blocked depositor

If the token blocks the depositor, the refund is held: its status in `GET /deposits/:chain/:nonce` is
`blocked`. The coordinator checks it again every hour and pays it if the token unblocks the address. Nobody can
send it elsewhere, and its USDT stays in the vault as backing. A held refund never holds up others. See
[Blocked recipients](/security/known-limits/#blocked-recipients).

## A bad quorum

A bad quorum that broke these rules would still be capped by the release allowance. See the
[threat model](/security/threat-model/).

## Proof: the load run

`npm run local:load` (passed on 4 November 2026) makes a deposit while the guardian has paused the minter, so it
cannot be minted. Four signers skip its nonce, and the vault refunds 14.5 USDT, exactly what the deposit minted on
paper. All five signers refused the refund at first, until their own nodes saw the skip. Supply, reserves and the
monitor agreed afterwards.
