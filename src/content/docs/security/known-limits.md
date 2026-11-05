---
title: Known limits
description: Limits of the v1 design that users, partners and auditors should know about.
---

## The bridge is federated

Kaspa cannot verify Ethereum or BNB Chain, and they cannot verify Kaspa. In v1 a federation of 5 signers attests
to deposits and burns, and 3 of them suffice. The [threat model](/security/threat-model/) shows what a bad quorum
could do; rate limits on both sides cap it.

**Upgrade path: zero-knowledge light-client verification.** Kaspa's Toccata upgrade includes an opcode that
verifies zero-knowledge proofs (`OpZkPrecompile`, KIP-16), and KIP-17 lists trustless bridges built on it as a use
case. A future version could mint on Kaspa against a proof of the deposit, checked on-chain, instead of signer
signatures. This is the planned direction, not part of v1, and it has no date.

**It would cover one direction only.** A proof checked on Kaspa replaces the signers' word about deposits, so it
removes the risk of unbacked mints. Releases are the other direction: the vaults on Ethereum and BNB Chain would have
to verify Kaspa burns themselves, which needs a Kaspa light client on the EVM side, a separate and harder project.
Until then, a release rests on 3 of 5 signers, capped by each vault's release allowance (250 000 USDT at once, at
most 500 000 in any 24 hours), and the monitor pauses the vaults the moment it sees a release with no burn behind it.

## Blocked recipients

**A blocked recipient is never paid.** This was decided on 4 November 2026.

Ethereum USDT keeps a blacklist (`isBlackListed(address)`), edited by Tether. BSC-USD
(`0x55d398326f99059fF775485246999027B3197955`) keeps none, and cannot be paused either. USDT's blacklist stops only
senders: `transfer` checks `msg.sender`, and `transferFrom` checks `from`. So the vault would still pay a
blacklisted address, and the USDT would be frozen there for good. The bridge stops it before the vault:

- **Wallets ask first.** Before every burn, the wallet and the web app call
  [`GET /recipients/:chain/:address`](/protocol/coordinator-api/) and refuse an address the vault would not pay.
  If they cannot ask, they refuse too: a burn cannot be undone. The wallet asks again right before it sends, and
  neither offers the other chain for a blocked address.
- **Signers refuse.** A signer will not sign a release or a refund to an address the token reports blocked. It
  asks every one of its RPCs, and signs nothing if they disagree. The deployment names the view to read
  (`blocklist`, per chain).
- **A burn that lands anyway is held.** Its status is `blocked`. The coordinator checks it again every hour and
  pays it if the token unblocks the address. A refund to a blocked depositor waits the same way. A held record
  never holds up the others.

Nothing can send a held burn elsewhere. The burn commits to its address, and **no key can redirect it**: the vault
has no re-target power. Its USDT stays in the vault as backing for as long as the address is blocked.

All this was checked on mainnet forks (`npm run fork:rehearsal`): a release to a blacklisted address is paid and
frozen there, a blacklisted vault pays nothing, and BSC-USD keeps no blacklist. The held-then-paid flow for releases
and refunds, the signers' refusals and the `vault-blocked` pause were checked in `npm run local:load`.

## Tether can block payouts

| Case | Effect |
|---|---|
| The release recipient is blocked by the token | See [Blocked recipients](#blocked-recipients) |
| A vault's own address is blacklisted by the token's issuer | That vault can pay nothing out, while deposits still go in. The monitor raises `vault-blocked` and the guardian pauses everything ([The monitor](/security/monitor/)) |
| Ethereum USDT turns on its dormant transfer fee (`basisPointsRate`) | Deposits revert (the vault checks the exact amount received), and release recipients receive less than the payout |

## A burn's payload can be missing

A redemption transaction *should* carry the burn's preimage in its payload. If it does not, the burn is still
valid, but the bridge cannot know its chain and address from the chain alone. Anyone can give the coordinator the
preimage later (`POST /redeems`), and it is checked against the burn owner. Until then, the burn waits.

## Redemptions depend on one vault

kUSDT is one fungible token, whichever chain its USDT came from. A release, however, is paid by one vault:

- A release must not exceed that vault's backing. kUSDT minted from Ethereum deposits can be redeemed on BNB
  Chain only if the BNB Chain vault holds enough.
- A single burn output's payout must fit in that vault's release capacity, 250 000 USDT by default.

Wallets refuse a burn the named vault cannot pay now (above its release capacity or `releaseAvailable`, above its
backing, or while it is paused) and offer the other chain. If one lands anyway, it waits: the relayer retries it
with its own backoff until the allowance refills, deposits on that chain bring the backing, or the owner raises
the capacity within its hard bound. It never holds up other burns.

**Rebalancing uses the bridge's own paths.** No key can move backing from one vault to the other. When one chain runs
short, an operator holding kUSDT redeems it from the vault that has plenty, moves the USDT across (an exchange or
another bridge), and deposits it into the short vault, which mints the same kUSDT back. Backing moves for 0.2 % each
way plus the cost of the crossing, and no new trust is added. See [Operations](/developers/operations/#rebalancing-the-vaults).
In a run on one chain, holders are still paid in full, on the other chain.

## Small burns are lost

A burn whose amount is at or below the release fee (5 USDT on Ethereum, 0.50 USDT on BNB Chain, or 0.20 % if
higher) is never paid. It is marked `unpayable`, and the tokens are still burned. The same holds for a burn naming the
zero address or the vault itself.

The wallet and the web app refuse such a burn, and warn when the fee would take more than 20 % of a redemption. Only a
transaction built by hand can still lose a burn this way. Each burn output also locks 0.3 KAS for good (below).

## Only plain burns are paid

Signers refuse a burn state whose borrow scheme, borrow guard or extension commitment is not zero, because a
borrowable state could move to a new outpoint and be claimed twice. Such kUSDT is lost. Wallets never build one.

## Burns lock KAS too

An ordinary kUSDT state carries the deployment's token value, 1.5 KAS, for its storage mass, and that KAS comes
back when the state is spent. A burn state can never be spent, so it carries the smaller burn value, 0.3 KAS, which
is gone for good. Wallets show it as part of a redemption's cost.

## Rules the vault cannot check

The vault cannot see Kaspa, and USDT pays a blacklisted address. Four rules rest on the signers alone:

- a release pays the chain and address the burn owner commits to;
- a refund pays the depositor;
- nothing is paid to an address the token blocks;
- a nonce is never both minted and refunded (INV-2).

A bad quorum that broke them would still be capped by the release allowance.

## Pool contention

Each swap spends one exact pool state. When several users swap at once, all but one must re-quote and re-sign.
This is the price of being immune to sandwich attacks. The wallet goes ahead on its own only when the new quote
is at least as good as the one you confirmed; a worse one asks you again (being built).

## The pool caps sells

The net KAS sells take out of the pool, less what buys bring in, may be at most 10 % of its KAS reserve per hour
(the [circuit breaker](/contracts/kaspool/#the-circuit-breaker)). It bounds a dump of forged kUSDT, but it also slows
a large honest sell, which must wait for buys or the next window. Buys are not limited. Because it counts the net
flow, round trips (a buy, then a sell back) cannot use up the room; until 5 November 2026 they could.

## The pool can be paused

On any alarm the guardian pauses the pool with the rest of the bridge. Swaps and new liquidity stop until the pool
admin resumes it. Removing liquidity always works.

## The first deposit sets the pool's price

Whoever makes the first deposit into a new pool sets its starting price. Arbitrage then moves it toward the market.

## The testnet runs on one host

The contracts are deployed on testnet (TN10, Sepolia and BSC testnet), and the public testnet is open at
[kastools.com](https://kastools.com). Its five signers, the coordinator and the monitor run on one
test host, in isolated containers, so it is not the federation of five independent operators that mainnet needs
(see [Operations](/developers/operations/#the-testnet-deployment)). The wallet extension has a testnet build to
download and is not in any store. Several protections on this site (finality checks, signer-side rules, the monitor's alarms) live in those
services, so they are only as good as their deployment.
