---
title: The monitor
description: The monitor and guardian service. What it checks, which alarms it raises, how it pauses, and how to run it.
---

The **monitor** watches every chain kUSDT touches and holds the **guardian** keys. When something is wrong, it
pauses both vaults, the minter and the pool. It is written (`bridge/services/src/monitor/`), has run in the local
end-to-end test, and ran for the public testnet (4 to 14 November 2026). On mainnet two monitors run, each able to
pause, on separate closed machines (nothing open but SSH): their alarms go to their operators, and each publishes
only its read-only status, through a Cloudflare tunnel (the addresses are on the [Status](/overview/status/) page once
the launch is verified). The acknowledge route is never public.

## Principles

- **Its own nodes only.** The monitor reads Kaspa, Ethereum and BNB Chain from its own nodes and takes nothing
  from the coordinator.
- **Acceptance order.** It reads Kaspa transactions in the order the DAG accepts them, a few DAA scores deep, so a
  transaction that lost a double-spend race never counts. If the chain still moves off a block it read, it reads
  again from the fork point. See
  [Following covenant states](/architecture/following-states/).
- **It follows BridgeMint** and adopts each successor state only from the outputs the spending input authorizes
  in the kUSDT family; a plain output paying to the same script is a decoy and is ignored. So it knows exactly
  what was minted, paused and governed.
- **It indexes every kUSDT burn**: a kUSDT state, by covenant ID, sent to a P2SH owner, by a transfer or straight
  from a mint (a deposit can name a burn owner). It reads every body seen under a transaction ID, so a rewritten body
  that names fewer states cannot hide one. It cannot tell a burn owner from any other script hash, so every such
  output is recorded as a possible burn. A real burn can never be spent, so a record whose output is later spent
  is dropped. Without that, someone moving a few units through their own script left a record per move for good,
  for network fees alone, until the state could no longer be saved. Held unspent, an outsider's outputs are kept,
  and their KAS comes back to them: until run 21 (R21-ADV-1, Daybreak [26]) about 625,000 of them, some 35,000 KAS in
  fees, made a monitor's state one it saved and could not read back under its 512 MB heap. Since then a state of
  0 units, or of no more than the least release fee any vault takes (read from the vaults every five minutes), is no
  record: no vault ever pays it out. And the book is held to 20,000 records, as the signers' is: past 21,000 the
  paid burns go first, then the smallest that no payload names as a burn (the transaction's own payload naming that
  output with a chain and an address whose burn owner it is); burns a payload names, burns a mint made and burns a
  checkpoint's list brought (since run 21's review: no outsider can make these for fees alone), and the burn of a
  release on the list, go last. A burn made by hand with no payload is the one an outsider's larger states can still
  push out: its release is then judged at its address, and if that address is filled too, it fails closed below. A burn dropped so or by mistake, or one from before the checkpoint a
  rebuilt monitor started at that its checkpoint's list did not name, is looked for in the UTXO set when its release
  shows up. "No burn" is then only the node's own answer, given in that round by a node that is synced: a look that
  failed is made again next round, and none is made in a round that did not read Kaspa or whose view of Kaspa is
  behind (such a round judges no payout, and an answer given in it would only be thrown away). A look that keeps
  failing still fails closed: after two minutes for a queued payout (five for a paid one) it is `unverifiable`.
- **A checkpoint carries the unpaid burns.** `GET /api/v1/checkpoint`, asked of the monitor's operator listener with
  the operator bearer, lists every burn the monitor knows that no vault has paid (`initialBurns`), read up to the
  block the checkpoint names, each with the chain block that accepted it. (The public checkpoint, which the status
  process serves, is the small one it always was: the list can be megabytes, and it is built by the process that
  judges and pauses.) A monitor started from that checkpoint takes the list in, so it need not find such a burn at its
  address, which anyone can fill with coins ([Known limits](/security/known-limits/#an-address-that-holds-too-many-coins-cannot-be-listed)).
  A listed burn is still asked for in the UTXO set while its release waits: found, its depth is the node's; "not
  there" ends it; a look that fails leaves it standing, and the release is judged by owner, amount and depth. A
  reorg that drops the block a listed burn names drops the burn. The list holds at most 20,000 burns, the largest
  first, and `burnsLeftOut` says how many it is short of. A burn paid in the last half hour is still listed: a
  payment near the head can leave its chain and come again later. That answer is built once in 30 seconds.
- **What it saves is of one moment.** The position it has read Kaspa up to and everything it took from the
  transactions up to there (the minter, the burns, the skips) go to the disk together. An alarm raised while a
  batch of transactions is being applied is saved once the whole batch is, a moment later.
- **After a gap longer than its node keeps** it goes on from a checkpoint in its config. A reorg just below its old
  position went by unread, so of the burns it had read it keeps only those that were already deeper than the
  deepest finality tier when it stopped, and asks the UTXO set about them while a release waits. The others come
  back with the checkpoint's list.
- **It follows the pool** from its genesis (`initialPool`), verifying each successor the same way.
- **It can only stop things.** On any alarm it pauses every vault, the minter and the pool. It never unpauses: that takes 4
  of 5 signers on Kaspa and the vault owner on each chain.

## What it checks

| Check | Invariant |
|---|---|
| minted − released ≤ Σ backing, with each vault read at one block | INV-1 |
| Every mint matches final deposits on the named chain, with the same recipients and amounts | INV-2 |
| Every release matches a kUSDT burn of the same amount whose owner commits to that chain and recipient | INV-3 |
| Every refund is of a nonce Kaspa skipped and never minted | INV-2 |
| No governance the operators did not announce | Governance |
| No vault owner action the operators did not announce, done or queued in the vault's AccessManager | Governance |
| The token does not block a vault | A blocked vault can pay nothing out |

Minted is computed from the chain: the genesis `remaining` minus the minter's current `remaining`. Released comes
from the vaults' `Released` events.

## Alarms

| Alarm | Means |
|---|---|
| `inv1` | minted − released > Σ backing, with each vault read at one block (INV-1) |
| `mint-without-deposit`, `mint-mismatch` | A mint has no final deposit behind each recipient, or not the same recipient and amount (INV-2). A deposit is called missing only when the vault had taken its nonce by the newest block every one of the monitor's RPCs serves (the vault's `depositNonce` there). A mint of a nonce past that waits unjudged on its own clock: an RPC whose head stopped, or that lags while still moving, no longer raises this alarm for an honest mint (since rc.20). Since round 16 every open mint has that clock, from when the monitor saw it, and one still unjudged `failClosedMs` later is `unverifiable`, naming the mint, its nonces and why (see [below](#each-mint-has-its-own-clock)). So a forged mint of a nonce no one deposited is stopped by that fail-closed pause `failClosedMs` after it is seen, however many other mints are open and whatever the other rounds read; `inv1` counts it from then on too. A mint made while a deposit history is still being read is judged by its deposit read by its nonce, so a mint of someone else's deposit is `mint-mismatch` then too |
| `release-without-burn`, `release-mismatch` | A vault queued or paid a `redeemId` that is no kUSDT burn, or not its amount, or not the recipient its burn owner commits to (INV-3). For a burn the monitor did not read from a block, "no burn" is only its synced node's own answer, given in that round |
| `release-before-finality` | A vault queued or paid a release whose burn is not yet final for its amount, counted by total as the signers count it (since round 15; since round 16 by when its signers could have signed it, not by the vault's order or readyAt: of the payouts on the same vault that must all have been first signed within 45 minutes, one must be as deep as the tier of three fifths of their total, [Finality](/protocol/finality/)): shallower than the depth the signers wait for (1 000, 6 000 or 36 000 DAA on mainnet) by more than 650 DAA, the most this monitor's own view may lag. No honest signer signs that early. A burn inside that margin raises nothing and does not count either: its release waits until the burn is fully deep. For this alarm and `refund-before-finality` the monitor reads its node's virtual again after the vaults, never further ahead of the round's start than the time since (10 DAA a second), so an honest payout signed during a long round is not called early |
| `release-burn-dropped` | A Kaspa reorg dropped the block that accepted a burn while a release for it was queued or just paid. A queued release stays under watch until it has left the queue, so this comes while a pause still stops the payout |
| `refund-of-minted-deposit`, `refund-without-skip` | A vault queued or paid the refund of a deposit that was minted, or one Kaspa never skipped (INV-2) |
| `refund-before-finality` | A vault queued or paid a refund whose skip is not yet final for the refund's amount, counted by total as for a release: shallower than the depth the signers wait for by more than the monitor's margin of 650 DAA. A queued refund stays judged every round until it leaves the queue, so a skip a reorg drops while it waits is `refund-without-skip` (since round 13) |
| `mint-of-refunded-deposit` | A mint names a deposit a vault refunded, or queued a refund for (INV-2). The monitor keeps every refund it has seen, and a Kaspa reorg does not make it forget one; it also reads the vault's `isRefunded(nonce)` on every RPC for each mint it checks. A refund the owner cancelled (`RefundCancelled`) is forgotten, since the vault holds that deposit as not refunded again and its mint is the honest way on; one the owner reinstates counts again, and a paid one is never forgotten |
| `signers-changed`, `limits-raised`, `value-changed` | Governance the operators did not announce in `expectedGovernance`: a new signer set, a higher mint allowance, or a change to the minter's own KAS deposit (`set_value`) |
| `governance-unannounced` | A `skipNonce`, or a `setLimits` that does not raise the mint allowance (a lower or the same one), that the operators did not announce in `expectedGovernance` (since run 20, D7-4: until rc.24 these raised nothing). Four of the five signer keys acted without telling the monitors: announce every governance action first, with the line `kusdt govern-sign` prints. An `unpause` with no alarm open, and a `vetoRecovery`, are noted and raise nothing, announced or not: the first is the way back from a pause, as on the vaults and the pool, and a veto only ever stops a recovery (it is the honest answer to `recovery-proposed`) |
| `recovery-proposed` | Three signer keys proposed a recovery (a new signer set and guardian, carried out by anyone once its wait of `recoveryDelay` DAA is over) that the operators did not announce in `expectedGovernance`. Any one honest signer stops it: `kusdt govern-sign` a `vetoRecovery`, then `kusdt govern-submit`, before the wait runs out (deploy/RUNBOOK.md has the steps). One the operators announced raises nothing; one carried out that nobody announced is `signers-changed` |
| `vault-owner-unannounced` | The vault owner changed the signers, the guardian, the limits, the fees, the rising deposit fee or the payout wait, cancelled or reinstated a payout, withdrew fees, or moved ownership, and the operators did not announce it in `expectedOwnerCalls` |
| `owner-op-unannounced` | Someone queued an operation in a vault's AccessManager that the operators did not announce. With a canceller key, the monitor also cancels it. Since run 20 (D7-7) the alarm carries what a canceller without one sends: the target's full address, the AccessManager's address and its chain ID, the calldata of `cancel(caller, target, data)` when it is under 4 KB of hex, and the `kusdt cancel-op` line that reads the same from the chain to check it against (deploy/RUNBOOK.md, "A canceller cancels a queued owner operation") |
| `unpaused-while-alarmed`, `vault-unpaused-while-alarmed` | An unpause of the minter, the pool or a vault while an alarm is open |
| `pool-keys-changed` | A pool `set_keys` changed the admin or guardian key and the operators did not announce it in `expectedPoolKeys`. A guardian key that is not the monitor's cannot pause the pool |
| `guardian-not-ours` | A rotation or a recovery left the minter with a guardian this monitor does not hold, announced or not. It can no longer pause the minter. Since run 20 (D3-2) also a vault whose `guardian()` is not this monitor's EVM key, read every 5 minutes with the funds check and at the end of a round that read a `GuardianSet`, and a pool whose guardian, as followed, is not its Kaspa key, checked as often and after every `set_keys`, announced or not, once the Kaspa reading is caught up. Until rc.24 only the preflight checked those, and a vault or the pool that this monitor could no longer pause raised nothing until an incident's pause failed. Raised once for each guardian found. To change a guardian on purpose, stop every monitor before the change lands and start them with the new key after it |
| `pause-failed` | A pause (a vault, the minter or the pool) has failed to go out for a minute, or the guardian key is not the one the minter or pool holds, which is at once. It is tried again every round; alarms already open keep everything paused. A vault every RPC refuses the pause for as already paused (`EnforcedPause`) counts as paused once every RPC also says `paused()` of its latest block, with 20 seconds to answer, so one slow or flaky RPC does not raise it for a paused vault (since round 20, MON20-3). The refusal alone never counts: a node may estimate on its pending block, which holds the guardian's own pause before any block does. A Kaspa pause counts as landed, and raises none, when the node's UTXO set holds the minter or the pool paused as the covenant's coin though the follower has not read it (since run 20, TN-1: [below](#pausing-kaspa-while-the-follower-cannot-read-it)). One raised during an `unverifiable` alarm for the Kaspa node may be out of date: the runbook says how to check |
| `pause-unlanded` | Pauses of the minter or the pool have gone out for three minutes and the Kaspa chain has accepted none: a node took them, no block did. A transaction that no block can take may be holding the coin in ordinary nodes' mempools (see [Known limits](/security/known-limits/#a-spend-of-the-pool-or-the-minter-that-no-block-can-take)). The pause is sent again every 30 seconds, also through the extra nodes in `kaspaSubmitRpcs`. The vaults' pauses do not depend on it. Since run 20's deep round (D3-7) also per vault (`pause-unlanded:the ethereum vault`): its pauses have gone out for three minutes and its RPCs do not all say it is paused, so an RPC took them and no block mined one. It names the last pause and its bid; the pause goes on being sent every 30 seconds through the next RPC. Until then a vault pause that an RPC took and never passed on, or one bid below what blocks charge, raised nothing |
| `vault-signers-differ` | A vault's signers are neither the deployment's nor a set announced in `expectedOwnerCalls` |
| `minter-unverifiable` | The minter moved in a way the monitor cannot verify, also after reading that chain block's transactions from its node a second time |
| `minter-lost` | The minter UTXO it follows is not in the node's UTXO set with kUSDT's covenant ID, on three caught-up checks, and no fetched transaction spends it. If the minter's own address holds more coins than can be listed, or so many that the node does not answer a read of it once it has read it crowded (since run 21, R21-MON2-3: a hundred thousand coins and more can take longer than a node call's 20 seconds), the check cannot be made: that is neither a miss nor an alarm, and `/health` says so with the address ([Known limits](/security/known-limits/#an-address-that-holds-too-many-coins-cannot-be-listed)). A read that runs out of time at an address it has not yet read crowded (its first read after a restart, or a next state filled in advance) still counts as failed, and fails closed after `failClosedMs`, as for a node that is down. The same holds for `pool-lost` |
| `vault-blocked` | The token's blocklist names a vault. That vault can pay nothing out, while deposits still go in |
| `pool-unverifiable` | The pool was spent in a way the monitor cannot verify, also after reading that chain block's transactions from its node a second time |
| `pool-lost` | The pool UTXO it follows is not in the node's UTXO set with the pool's covenant ID, on three caught-up checks, and no fetched transaction spends it. A pool it has lost is one it could not pause |
| `kaspa-tx-unreadable` | Following the minter or the pool through one accepted transaction failed unexpectedly. The rest of the batch is still read |
| `mint-of-skipped-nonce`, `skip-of-minted-nonce` | A mint of a nonce that was skipped for a refund, or a skip of one already minted (INV-2) |
| `mint-unknown-chain` | A mint names a chain the deployment does not have |
| `refund-mismatch` | A vault queued or paid a refund to anyone but the deposit's sender, or for anything but what it minted. Only signers bind a refund to its depositor, so the monitor checks them |
| `flagged-payout-still-queued` | A vault runs again with a queued payout that raised an alarm and was not cancelled. Since round 15 a queued payout the monitor failed closed on (`unverifiable`) is flagged too; since round 16 (R16-PAY-6) so is every payout still queued that was seen since a mint a mint alarm names (`after-unbacked-mint`; `after-inv1-short` while INV-1 is short, and `after-unchecked-mint` while a mint fails closed unjudged (`mint-unjudged`) or the mints step fails closed, each taken off once the backing covers what is owed, or the mints are checked and backed). Each flagged entry says what it pays, to whom and which alarm named it: `kusdt cancel-plan` reads the whole list from the monitor's state file (the RUNBOOK, "The monitor paused everything") |
| `unverifiable` | A chain, the Kaspa node, or a step of the check could not be read for `failClosedMs` (5 minutes by default, shorter than a payout's wait), including the deposits behind a mint; a mint still unjudged `failClosedMs` after the monitor saw it, whatever kept it so (key `mint-unjudged:<txid>`, since round 16); more than 1,024 mints dropped by reorgs of the Kaspa chain within a day and not accepted again (key `mints-dropped-full`, since round 17); a chain one of whose RPCs reported a deposit under another transaction than before twice within a day (key `unverifiable:deposits:<chain>:…`); an EVM head or a Kaspa virtual DAA that has stopped moving; or a Kaspa view that stays far behind without catching up (see [below](#when-it-cannot-read-a-chain)). Also a queued payout that is still unjudged two thirds of the way through its wait, whatever kept it unjudged; and a payout whose burn could not be looked for in the UTXO set for two minutes (five for a paid one). Since run 20 (D5-9) also a `judgeFromBlock` more than ten minutes of blocks above the highest head a chain's RPCs report, found by the first read of that chain when no RPC answered at the start (key `judge-from-ahead:<chain>:<value>`): the start refuses such a value when it can read the heads. The monitor fails closed: everything stays paused until it can check again. Not while its own machine is offline or catching up after being away (since round 30, [below](#when-its-own-machine-is-away-or-offline)) |
| `crash-loop` | This monitor has started three times or more, over `failClosedMs` or longer, without finishing one round in between. Nothing was judged in that time, so it pauses everything first and then raises the alarm (see [below](#a-monitor-that-keeps-dying)) |

The `vault-blocked` check reads the view the deployment names for each chain (`blocklist`: `isBlackListed` for
Ethereum USDT). BSC-USD keeps no blacklist, so it never fires there. The pause stops new deposits into a vault
that could not pay them back. See [Blocked recipients](/security/known-limits/#blocked-recipients).

The monitor checks a payout when it is **queued**, not only when it is paid: that is what the vault's
[wait](/protocol/redemptions-and-releases/#the-wait) is for, since a pause within it stops the payout. A payout with no
burn behind it is an alarm **at once**, as soon as the monitor's Kaspa view has caught up (within about 50 DAA scores
of the virtual), or its Kaspa node is at the network's tip while its view catches up (since run 21,
[below](#when-its-own-machine-is-away-or-offline)): signers sign a release only once its burn is final, 1 000 DAA deep
or more, so an honest release's burn is always indexed by then, and always in the node's UTXO set, as nothing spends
a burn. A mint may wait for its deposit, and a paid refund for its skip, for a grace period
(`graceMs`, 5 minutes by default), the time a deposit takes to become final on the monitor's own nodes.

A queued refund with no skip behind it is judged like a release with no burn: in the second round that read Kaspa
up to date (the second, so that one round's view is never all there is). No honest quorum signs a refund before its
skip is final, which is far deeper than the monitor reads, so with Kaspa read up to date the skip is there or there
is none. A queued refund's grace is 2 minutes at most, and a round that did not read Kaspa up to date stops that
clock for as long as it took. It never starts it over. Before rc.16 such a round started the grace again, so one
failed Kaspa round every two minutes could keep a forged refund unjudged until it was paid.

Any queued payout that is still unjudged two thirds of the way through its wait is the `unverifiable` alarm,
whatever the reason: the Kaspa view behind in this round or in every other one, or a deposit that cannot be read.
It fails closed. The wait ends at the vault's `readyAt`, a block time, so since round 18 the two thirds are judged in
the chains' time: a host clock behind the newest blocks' times makes the deadline sooner by as much (R18-PAY-3). A
start holds this rule in its first round only, whose time away may have run a wait out before anything could be read.
A catch-up after an outage of its own holds it no more since run 21's decision 12 (the owner's, 14 November 2026),
offline only does ([below](#when-its-own-machine-is-away-or-offline)). No other grace outlasts two thirds of the wait.
Up to rc.24 every start gave `failClosedMs` first: one quick restart late in a payout's wait moved the alarm to the
payout's `readyAt`, and starts less than `failClosedMs` apart kept it off for good (R18-PAY-2). A payout already
unjudged a minute before the monitor went away is not held even in the first round: what kept it unjudged was there
before.

The queued payouts of the last 15 minutes of each vault's blocks are read again every round, every RPC agreeing. Since
run 20 (D4-6) one that a reorg of the vault's chain took away, so that no RPC shows it any more, leaves the list in the
round that reads the reorg, once every RPC also says the vault no longer holds it (one it still holds, or that cannot
be asked about, stays), with a note (`... is no longer in the chain every RPC serves: a reorg of <chain> took it
away`), and is judged as a new one if the chain takes it again; the same transaction in another block keeps its
record and its clocks, with a note that it moved. Until rc.24 it stayed on the list until its `readyAt`, judged as if
it were still queued, and then went as a payout that had left the queue.

### Each mint has its own clock

Since round 16 every open mint carries a fail-closed clock of its own, kept in the state file, from when the monitor
saw it. A mint still without a verdict `failClosedMs` later is `unverifiable` (key `mint-unjudged:<txid>`), and the
alarm says which mint, which nonces and why its last check could not judge it: a deposit history still being read
and the read by nonce not there yet, a nonce past the vault's count at the head the RPCs serve, a read that failed,
or no round having had the time to reach it. No other mint's check and no step's success moves that clock. Before,
the first two had no clock and the others shared the step's, which any round that ran out of time, or that read
everything else, started over: one lying RPC, or more open mints than one round checks, kept a forged mint unjudged
for good (R16-MINT-1, R16-ONCE-1, R16-PAY-1, R16-FIX-1). Steady honest mints a round ahead of a lagging RPC kept the
shared clock failing and paused everything (R16-ST-1); each mint's own clock does not.

A verdict for now stops the clock: a deposit every RPC shows near the head but that is not final yet (it is
`mint-without-deposit` an hour after the mint if it never becomes final), or none where the vault's count says one is
(`mint-without-deposit` after `graceMs`). A mint whose nonce is past the vault's count stays out of INV-1 until its
clock runs out: with every RPC lagging alike an honest one was called short after 150 s (R16-FIX-4). A forged mint
of a nonce no one deposited is counted from then on. Out of the alarm only, not out of what the public is shown (since
round 20, MON20-2): while a mint names a deposit past the vault's count, or one none of the RPCs has shown for over a
minute, the signal is not ok (`kUSDT minted for deposits not seen yet`) and `/health` answers 503; the backing is
never published healthy while what is owed exceeds the backing read; and what INV-1 left out is published on its own
(`unverifiedMinted`). Nothing is paused for it before its clock runs out. Until rc.23 the signal said ok, `/health`
200 and the backing healthy for those five minutes after a forged mint, with owed 4,000 times the backing. Time this monitor was not running does not count: after more
than 90 seconds away, each open mint's clock moves on by the time away, so the time it ran still adds up. Until rc.22
the clock started again at each such start, and a monitor that kept restarting never counted a forged mint past the
vault's count (R17-DIFF-1). Since round 18 a catch-up holds only the mints first seen during it: one seen before was
this monitor's to judge, and its deposit is read on its vault's chain, not through the Kaspa node the catch-up waits
for. A start during a catch-up that had not moved since the last time away gives its time back to no clock, a mint's
included ([below](#when-its-own-machine-is-away-or-offline)). Since run 21's decision 12 (b) a mint read more than a
minute after the chain accepted it has every grace and its clock from that acceptance, and nothing holds or moves
them: a catch-up does not, nor a time away. A reorg of the Kaspa chain that drops a mint and accepts it again does not start it over
either: the mint comes back with its first sighting, its clock and its verdict (R17-MINT-1). Until rc.22 a miner who
could reorg it every few minutes kept a forged mint from any alarm. The records of dropped mints are kept for a day,
1,024 at most, and more than that at once is the `unverifiable` alarm (key `mints-dropped-full`).

Whether each deposit was refunded is read for the mints next in line eight at a time (R17-ST-2), so a monitor back
from an outage judges the mints made meanwhile within a round or a few: about 2,000 mints of three deposits within
`failClosedMs` at 300 ms an RPC answer (282 s in the tests, with their deposits 4 or 130 blocks apart), where it was
about 300 with one read after another. Since run 21 (R21-SIG2-1)
each deposit is also asked of every RPC again at its own blocks, all of them at once, and judged on what they say then,
not on the records its deposit history holds (those only say where to look): one such read, as many blocks as one
getLogs takes, takes in the deposits after it there for the rest of the round, so a backlog costs a read per window,
not one per deposit. A payout of a forged mint's
kUSDT can be queued a minute or so after the mint, so `failClosedMs` must stay at most half the vaults' payout wait
(R17-PAY-2): see `failClosedMs` [below](#configuration).

While a chain's deposit history is not read to its end (a new state, a long time away, an RPC that read it again),
each mint's deposit is read by its own nonce on every RPC, which must agree: near the head first, then back from
the finalized block a window at a time, or up from the deposit of a lower nonce when an earlier mint gives its block.
That uses the round's 30 seconds for mints, and the history is read on beside it for 15 seconds, so the long read
does not use up the reads that judge. A mint of someone else's deposit is `mint-mismatch` in the first round.

An RPC that reports a deposit under another transaction than it reported before is that chain's deposits failing to
be read, not progress: a note, and one round on the failure clock. Its deposit cache is dropped and it reads the
history again, once a day at most. A second time within a day its cache goes too and it is distrusted for a day:
nothing of its history is read meanwhile, and the chain stays on the failure clock, so it is `unverifiable` after
`failClosedMs`; after the day its history is read again from the first block. Until run 21 the second time kept its
records and its reading again under way, so a made-up record that reading had met failed every later scan, and the
day of distrust lasted until a restart (R21-SIG2-3). Take that RPC out of `evmRpcs`. (The distrust is kept in memory: a
restart gives that RPC its one reading again at once.)

The clock that the Kaspa node's newest block is compared with is, per chain, the earliest of the newest block times
its RPCs report, so one RPC naming a time ahead of the others cannot make the node look behind.

A payout that raised an alarm stays on a list until it has left the queue. A vault that runs again with one still
queued raises `flagged-payout-still-queued`, and the unpause's fresh wait gives the pause time to land.
A monitor that starts late raises no `release-without-burn` or `refund-without-skip` before its Kaspa scan has
caught up.

## When it cannot read a chain

Each step of a check, and each EVM chain, runs on its own. A chain whose RPCs fail or disagree does not stop the
others from being checked, and open alarms still pause everything. INV-1 is judged only when every vault's backing
was read: with a chain missing it would look short, so the check reports the chain as `unreadable` and calls itself
not healthy (`/health` answers 503, and the integrators' signal says stop). So INV-1 is off while a chain cannot be
read, in every mode: what bounds that is the chain's own clock, which fails closed after `failClosedMs` (and a chain
that cannot be read makes no progress in a catch-up either, since round 18). If a chain, or the Kaspa node, stays
unreadable for `failClosedMs`, that is the `unverifiable` alarm, and the guardian pauses everything: an outage
never quietly switches the guardian off. A chain is read all or nothing, so a read that fails halfway counts
nothing twice. The one exception is an outage of the monitor's own machine, which since round 30 pauses nothing by
itself ([below](#when-its-own-machine-is-away-or-offline)).

Fixed on 5 November 2026 after an outside review: before, one failing read stopped the whole
check, the pause included.

Reads can also succeed and still say nothing new. These count as unreadable too:

- **A head that stops moving.** Logs are read up to the lowest head the RPCs report, so one frozen or lying RPC
  would stop all log reading while every read succeeds. The lowest head now must be above the highest head any RPC
  reported 4 minutes ago (`failClosedMs` less a minute). If it is not, and that holds over consecutive rounds for that minute, the chain has
  been unreadable since then, and the `unverifiable` alarm comes at once, `failClosedMs` after the head stopped. A real halt of the chain counts the same. `evmHeadLag: 0` means a local chain that mines on demand
  and turns this check off: the preflight check refuses it on mainnet. The samples are kept in the state file, so a
  restart does not start the clock over.
- **A Kaspa node that stops.** A node that has lost its peers or stopped syncing still answers, and the lag against
  its own virtual stays small. So its virtual DAA must keep the network's pace: at least one DAA score a second over
  30 seconds (the network makes 10), or nothing read from that node counts and the failure clock goes back to when it
  fell behind. A pace, not only a rise: a node fed a slow fork still rises. `minDaaPerSecond` sets it. The newest block it
  holds must also be under a minute old by the newest EVM block's clock (not this machine's, which may be wrong), so a slow
  node can't look caught up against itself. A Kaspa node
  that is down at start does not stop the EVM watch, the pauses or the API: each round tries to connect.
- **A long history.** A new or rebuilt monitor reads a vault's outflows and its deposits a piece at a time, each piece
  kept. That is progress, not a failure: it stays off the fail-closed clock, nothing is judged short meanwhile, and
  `/health` answers 503 and `/api/v1/signal` says so until it has caught up. A read that fails still counts. It
  keeps no mint from its verdict (since round 16): the mints are judged by their deposits read by nonce meanwhile, on
  their own clocks ([above](#each-mint-has-its-own-clock)).
- **A Kaspa reorg.** The monitor keeps what each minter and pool move replaced, and undoes the moves in chain blocks
  the node drops, so it reads what the new chain did. A burn only a dropped block accepted stops counting.
- **A Kaspa view that stays behind.** A view that reads fine but lags sees no mints and no governance, while the
  minter and the pool stay open. If the lag stays above `kaspaLagFailDaa` (3 000 DAA scores, 5 minutes on mainnet, by
  default) for `failClosedMs` without falling, that is `unverifiable`. A lag that keeps falling, by at least a tenth
  each time the clock would run out, is a catch-up and starts the clock over, so a restart does not trip it.

### When its own machine is away or offline

Since round 30 (the owner's decision of 13 November 2026), an outage of the monitor's own machine never pauses
anything by itself. A pause stops everything, and unpausing the vaults takes a 6-hour Safe delay. Before, a machine
that came back after hours down started its monitor and its Kaspa node together; the node needed more than 5 minutes
to catch up, so the monitor failed closed and paused everything. A machine that lost its network for more than 5
minutes paused everything as soon as the network came back. Now the monitor is **offline** or **catching up** then,
and behaves like a monitor that is not there, not like one that is blind. The second monitor and each payout's
10-minute wait in its vault cover that time. Only the rules for what it cannot verify wait: `unverifiable` after
`failClosedMs`, the clock of a mint not judged yet, and a burn that could not be looked for (and offline, a queued
payout still unjudged at two thirds of its wait). Evidence pauses at once all the same, offline and while catching up,
as soon as the monitor can see it:

- **A release**, queued or paid while it was away, is judged in any round in which its Kaspa node is at the network's
  tip (its newest block within a minute of the newest EVM block's time, and since run 21's review within two of this
  machine's clock), wherever its own reading of Kaspa stands: no burn in the node's UTXO set at the burn owner and
  amount the release names is `release-without-burn` (a release of another amount, or to another recipient than a
  real burn commits to, finds none there either: with no record of the burn, that is not `release-mismatch`), a burn
  not deep enough `release-before-finality`. A burn an honest quorum released is final and is never spent, so that node
  holds it. Up to rc.24 (run 21, R21-MON2-1) a monitor catching up judged no release until its reading had caught up,
  75 minutes after 11 h 14 min away on TN10, and a forged release queued as it came back was paid at minute 10 with
  nothing raised.
- **The rest of Kaspa once its reading has reached it:** a forged or unbacked mint, a refund that matches no skip or
  whose deposit was minted, governance nobody announced, INV-1 short (it counts the mints read), a lost minter or
  pool. Mints, skips and governance are the minter's history, which only the reading shows. Meanwhile a release of a
  real burn of kUSDT minted for no deposit is judged good by the UTXO set, and is paid if its wait ends before the
  reading reaches the mint.
- **Nothing on Kaspa while its node itself is behind:** started again with the machine, or syncing after an upgrade
  or a resync. What the vaults show (owner calls nobody announced, their signers) is judged as soon as they are read.

Two exceptions to the own-outage rule since run 21's decision 12 (the owner's, 14 November 2026, R21-MON2-1 (b) and
(c)), both while catching up and not while offline:

- **A queued payout still unjudged two thirds of the way through its wait fails closed** (`unverifiable`, key
  `queued-unchecked:<tx>`), as when guarding. Until then the catch-up held the rule, and what no round could judge was
  paid once its wait ended: a refund (its skip or its mint not read yet), a release while the node itself is behind, a
  forged release whose burn's address someone filled so that no look at it answers. In the tests each of those was paid
  at its `readyAt`; now each is paused at two thirds of its wait, about 200 s before it. The cost, which the owner accepts: an
  honest payout still unjudged then (an honest refund queued during a long catch-up, a release while the node restarts)
  pauses everything too. A release of a real burn costs nothing: the UTXO set judges it good first. A start's first
  round still holds the rule (above).
- **A mint read late has its graces from when the chain accepted it**: read more than a minute after it (by how far
  behind the node's virtual DAA it was read), its grace for a deposit (`graceMs`, and the hour of a deposit not final
  yet), its fail-closed clock (`failClosedMs`) and its time out of INV-1 run from that acceptance, and no catch-up or
  time away holds them. A mint forged as it caught up, with no deposit behind it, is raised in the round that reads it:
  in the tests `mint-unjudged` 6 s after the read, where it came 414 s later, after the catch-up had ended, and
  `mint-without-deposit` 6 s after it, where only INV-1 came, 150 s on. It does not stop the release of that mint's
  burnt kUSDT if the release's wait ends before the reading reaches the mint (above), but it shortens that window to
  the reading itself. An honest mint read late whose deposit is there is judged good in that round; one whose deposit
  cannot be read then pauses at once.

So a monitor's time away is its outage and its catch-up together for refunds, mints and governance (at the reading
pace measured on TN10 a catch-up takes about a ninth of the time away, and at most 6 hours), and for everything the
time its node takes to restart or sync, except that what it cannot judge within two thirds of a payout's wait pauses.
The other monitor covers that time only while it guards: the two must never be away or catching up at the same time.
Upgrade, resync or restart their Kaspa nodes one after the other, the second once the first monitor says `guarding
again`, never together (a hard fork's upgrade too), so that no honest catch-up is long enough to pause.

- **Catching up after being away.** A start more than 90 seconds after the last finished round is a catch-up, unless
  its first round finds everything caught up. It is caught up in a round in which its Kaspa node's newest block is
  within a minute of the newest EVM block's time (measured in that round), its reading of Kaspa is within the
  caught-up bound of its node (as payouts are judged), and every vault was read up to its head. Until then it must
  make progress: the node's newest block younger by a tenth of its age or by a minute (unless that round found it
  within a minute of the newest EVM block's time: a node at the tip gains nothing, however its newest block's age
  moves by this machine's clock, which NTP may be slewing or stepping), its headers or
  blocks coming in at over twice the network's 10 a second (a node syncing headers first), its reading closer to the
  node by a tenth or by `kaspaLagFailDaa`, or a vault read further in a round that read it whole: its head, its logs
  and every read all its RPCs must agree on. Up to rc.24 a vault's logs moving on was enough, so one RPC that answered
  the logs and failed or disagreed on every contract call kept a catch-up "progressing" to its cap, 30 minutes after a
  short reboot and 6 hours after a first start, with every fail-closed rule held and INV-1 off (R18-MON-1); now that
  chain makes no progress, and the catch-up ends `failClosedMs` on. Each part still behind has its own clock, as `kaspaLagFailDaa`'s
  rule has: a part with no progress for `failClosedMs` ends the catch-up (15 minutes for a node that has not answered
  since it began: a node at boot opens its database and its UTXO index before its RPC answers). So does the whole
  lasting longer than its cap: as long as the monitor was away, at least 30 minutes and at most 6 hours. An honest node
  syncs many times faster than the network makes blocks, so it is caught up well within that; one that catches up no
  faster than twice the network's pace, or one fed a chain that goes nowhere, is not.
- **A quick reboot.** A host can shut down, boot and start its containers in under 90 seconds, and its Kaspa node may
  then need longer than `failClosedMs` to open its database and catch up. So a start within 90 seconds of the last
  finished round is a catch-up too, with the same rules and bounds, when its node does not answer in its first round
  or holds a newest block more than a minute old, and the monitor had read that node fine up to the start. A node that
  was already failing before the start is the node's own trouble: restarting the monitor gives it no time. The cap is
  the time away or the node's own lag, whichever is longer, so at least 30 minutes. A start within 90 seconds during a
  catch-up goes on with it, its clocks as they ran (the time away counts on them); if its node had answered and made
  progress in that catch-up and does not answer in the start's first round, it started again with the machine, and
  has its 15 minutes once more, from its last progress. A monitor that keeps restarting gets nothing new from it: a
  node that never answers ends the catch-up 15 minutes after it began, one that answers and goes nowhere
  `failClosedMs` after its first answer, whatever the restarts in between.
- **Starts after a gap, and restart loops.** Since round 18 a start more than 90 seconds after the last round during a
  catch-up goes on with it too: its start, its cap, its marks and its node's allowance carry on. The time away is
  given back to the clocks and to those bounds only when every part still behind had made progress since the last
  time away, or fell behind only in the minute before it; otherwise nothing is, and the time away counts on them as a
  quick start's does. A start after a gap while guarding is an outage of its own and a catch-up of its own, as
  above, but every fail-closed clock moves on by the time away instead of starting over; only a Kaspa node's failure
  clock that began in the minute before the last round (a node stopped with its machine) is dropped. What had been
  failing for longer before the gap gets nothing from the catch-up: a node already failing has no 15 minutes and its
  no-progress clock runs from its failure, a chain whose RPCs were failing likewise, and a queued payout unjudged that
  long keeps its two-thirds rule. Up to rc.24 each such start emptied the failure clocks and began a catch-up of its
  own with fresh bounds, so a monitor started more than 90 seconds after its last round every few minutes, its node
  dead or one chain's RPCs dead, never failed closed and never judged a queued payout; one such start, as the RUNBOOK
  says to make it, gave a node that was already failing 15 minutes more (R18-MON-2, R18-PAY-1). Now no restart
  pattern keeps it from guarding past these bounds: a node that never answers ends the catch-up 15 minutes after it
  began, plus one time away at most, and a node, a reading or a chain already failing fails closed `failClosedMs`
  after it began, plus the time away of the first start.
- **A frozen machine.** A VM paused, or a machine resumed from a suspend its monotonic clock counts, runs no round
  while both its clocks go on. Since round 18 more than about 3 minutes between two looks at the clock (90 seconds
  past a step's deadline, a round's wait on its pauses and a poll), before a round or in the middle of one, is time
  away of its own: given back to the clocks, and caught up after under the same rules and bounds as a start after a
  gap. Up to rc.24 it paused everything: its node behind by that time, or a vault's read dated before the freeze
  (R18-MON-3).
- **Offline.** Every configured EVM RPC of every chain gets no answer at all in the same rounds (the connection is
  refused or reset, the name does not resolve, nothing comes back in 15 seconds), none of them has answered since, and
  the Kaspa node does not answer or has stopped keeping pace. An HTTP error with a body, a JSON-RPC error or a wrong
  answer is an answer. The failure clocks do not run while offline, and nothing is raised for what cannot be read:
  no pause could go out anyway. When anything answers again it catches up, with the same rules and bounds. The Kaspa
  node must be gone too: a machine with no network loses its node's peers (its own node stops) or its node (one
  elsewhere), while a node that still follows the network means the machine has one. Then what fails is narrower (its
  DNS, a filter on the RPCs, the providers themselves, someone cutting exactly those), and the minter and the pool can
  still be paused through the node, which is what stops a forged mint from being swapped or burnt. It fails closed as
  ever then.
- **Still failing closed.** One chain's RPCs all failing while another chain's answer is a provider's outage: it fails
  closed after `failClosedMs` as before. So does a Kaspa node that is stuck or unreachable while the RPCs answer. A
  catch-up that ends without catching up (no progress, or its cap) gives back no time: every rule applies again at
  once with its clock as it ran through the catch-up, so whatever is still behind fails closed straight away.
- **Its clocks.** While offline the clocks do not run: they move on by the time offline when it is back (a clock that
  was running before keeps what it had). A catch-up that ends caught up gives its time back the same way, less what
  starts during it gave back already, and to the mints first seen during it, except one read late (run 21's decision
  12 (b), above), whose clocks no time away moves. A start during a catch-up, within 90
  seconds or after a gap, goes on with it (a quick reboot, above, says when its node has its 15 minutes again, and the
  restart loops what a gap gives back). The Kaspa view's lag clock is kept in the state since round 18, as the others.
- **What it says.** `/health` answers 503 with `not guarding: catching up since <time>, after being away <time>;
  behind: ...; gives up at <time>` or `not guarding: offline since <time>`, the signal gives the same reason first,
  and the status has a `guarding` field. Each change is a note and a log line: `not guarding: offline since ...`,
  `back online after ...`, `not guarding: catching up since ...`, `guarding again: caught up after ...`, and the two
  ends without catching up (`has made no progress for ...`, `has lasted ..., the longest it may`). 503 because 200
  means this monitor guards now, and its operators and the other monitor's must be told when it does not: it pauses
  nothing, and nothing restarts the monitor on it.

What this costs: someone who can cut all of a monitor's network can silence it for as long as that lasts, as taking
its machine down would ([known limits](/security/known-limits/#a-monitor-whose-own-network-is-cut)). The other
monitor and the payout wait cover that, so the two monitors must not be away at the same time.

### How fast it pauses

The clock of anything that cannot be read starts when the round starts, not when a hung call finally gives up. Every
RPC request is bounded at 15 seconds, and a read is tried three times, so one hung RPC costs a read under a minute.
The chains are read side by side, so a hung RPC on one does not delay the other.

These clocks are the host's wall clock, so a clock set back (NTP putting right one that ran ahead, a VM restored from a
snapshot) would hold them for the step's length. Since run 20 (D9-1) each round first compares the wall clock with the
monotonic clock, as the coordinator has since rc.23: when the wall clock has gone back by more than a second, every
time the monitor keeps that is now in the future moves back by the step. That covers the fail-closed clocks (each
failure's, the vaults' read-through times, the frozen heads', the Kaspa lag's, each open mint's and queued payout's,
INV-1's), the minter's and the pool's pause resends and their tries (`pause-failed`, `pause-unlanded`, a pause seen
landed, the guardian's coins), and the catch-up's and the offline clocks; the catch-up moves whole, so the time it
gives back is the time it lasted. A time older than the step keeps what it had: it runs late by the step at most,
never early. A start on a state whose last round is dated after now (the clock set back while it was stopped) moves
every time in it back by as much. Before, a step back of an hour kept `unverifiable` off for 65 minutes, and the
minter's and the pool's pauses were not sent again for 60.7. A step forward moves the clocks forward by as much of it
as the chains' time confirms (since round 18): this machine's clock was measured behind the newest blocks' times
before it, which is NTP putting right a clock that was behind, as on a host that booted with its clock behind (whose
saved times the start pulled back by the error). Up to rc.24 every clock then read that error as time, and the
catch-up ended as stuck. Unconfirmed, a step forward moves nothing: nothing tells it from time that passed, and it
errs on the early side.

Since round 18 the status (and with it `/health`'s answer) warns while this machine's clock is more than 30 seconds
behind the newest blocks' times, by the earliest of a chain's RPCs, or more than a minute ahead of every chain's
newest block: `this machine's clock is ... behind the newest blocks of ...`. Keep the host's time synced (NTP); the
two-thirds rule for queued payouts is judged in the chains' time whatever the warning says, and evidence never
depends on the clock.

The pauses run side by side as well: one stuck on Ethereum holds up neither BNB Chain, nor the minter, nor the pool.
A round waits at most 30 seconds for them and the ones still running carry on. A chain that could not be read that
round gets its pause through every RPC at once, without waiting on `paused()` first. Otherwise each RPC gets 5 seconds
before the next is tried as well. The monitor does not wait for the pause to be mined: it reads `paused()` every
round, and a pause still unmined after 30 seconds is replaced at the same nonce with higher fees, through the next
RPC. The 30 seconds are counted on the monotonic clock since run 21 (R18-MON-5): on the wall clock, a clock set back
left an unmined pause unsent for as long as the step, and `pause-unlanded`, which a resend moved, did not come either.
Since round 18 every round with a vault pause out moves its `pause-unlanded` clock, not only a resend, so the alarm
comes at its 3 minutes and not at the first resend after them. A pause that could not be sent is tried again the next
round, on Kaspa as well as on the vaults.

A vault pause's fees follow the relayer's rule, under a cap of their own (since run 20's deep round, D3-6). Until
rc.24 it bid whatever the one RPC it went through named, raised by 30 % a try with no bound: one lying RPC got a tip of
about 0.5 ETH on the first try, and twenty unmined tries bid 6.7 times the estimate. Now the tip is at most the lowest
base fee the RPCs report (or 2 gwei where that is lower), each replacement at the same nonce outbids the pause its RPC
holds by at least 12 % for every try since that one, and nothing goes over 1,000 gwei on Ethereum or 100 gwei on BNB
Chain. Since run 21 the lowest base fee is every RPC's
(R18-MON-4): only those that had answered when the pause went out counted, so one RPC answering first set the bound
alone. A send waits at most a second for the others (never longer than the 5 seconds between RPCs, and not at all with
the chain unreadable), and one still silent is stood in for by the lowest base fee the RPCs showed in the last two
minutes. Since round 18 that bound needs the base fees of two RPCs (where the chain has two or more), the stand-in
counting as the RPC that showed it; with fewer the tip is 2 gwei. With the chain unreadable nothing waits, so a lying
RPC whose figures came first was still the only one heard and its own copy tipped up to the cap (950 gwei in the
test). And the pause a replacement must outbid is the one the RPC it goes through holds (R18-SURF-1), not the highest
any RPC took: one RPC that took a pause at its own high figures and kept it to itself set every other RPC's
replacement above it. An RPC that refuses a bid as underpriced holds another RPC's pause; that counts as sent, and its
next bid outbids the highest any RPC took. The raise of 30 % a try counts the tries since a pause at that nonce first
went out and since the RPC the send goes through last said the vault is paused (its `paused()`, or a gas estimate that
reverts with `EnforcedPause`), since round 18: counted from the most any RPC's pause at the nonce had, a lying RPC that
never says so of a paused vault, taking a pause every try, raised the honest pause after an unpause by all its tries
(545 gwei of max fee after 40 of them, where the honest figure was 41). The 12 % for every try since the RPC's own last
pause keeps pauses that alternate between two RPCs outbidding each other try by try; 12 % once fell behind from the
ninth unmined try. A pause is about 47,000 gas, so at the cap it
costs 0.047 ETH or 0.0047 BNB, within the 0.05 the guardian is funded with. The cap is twice the relayer's: payouts wait
above it, and a pause clears any base fee Ethereum has had but for minutes of NFT mints in 2021 and 2022, which a pause
resent every 30 seconds waits out. The figures raised stay those of the RPC the try goes through, as before: the max
fee is a ceiling, not a price, and a ceiling from the RPC that answers lowest could hold the pause below the base fee.
The bounds apply to each try; they do not limit how many tries an RPC disagreement can cause. At the cap a try that
cannot outbid the last is taken as sent when a node says it holds it. The guardian's gas is read from every RPC, and the
lowest is the one warned of (round 18, R18-SURF-1): read from the first alone, a lying first RPC could hide a guardian
that a pause had emptied.

A mined transaction consumes its nonce even when it reverts. A pause at a new nonce starts from the current fee
quotes, without the previous nonce's replacement increases. This prevents those increases compounding across
separate failed transactions. With the original two-RPC rule, disagreement can still cause repeated paid reverts:
believing one RPC that wrongly says "paused" could prevent a real emergency pause. The optional corroboration mode
below can stop one false "not paused" view from causing those sends. The per-transaction fee cap is not a limit on
the total cost of retries when corroboration is unavailable.

Since run 21's review (RV-SM SF-1) the tip is also at least 2 gwei, or the max fee where that is lower. With no floor,
one RPC naming a max fee over the cap and a tip of a wei had the guardian sign a pause at the cap with a 2-wei tip: no
replacement could ever outbid it (its max fee can rise no further), every one was refused and counted as sent, and no
builder had a reason to mine it within the payout wait.

A canceller key's `AccessManager.cancel` is priced the same way since run 21 (R21-OPS-1), from every RPC's figures,
with the same tip floor, and is given a gas limit set by the monitor from the size of its calldata (100,000 and 40 a
byte), never an RPC's estimate. Until then it signed whatever fees and gas the one RPC it went through named, again at
every retry: one lying RPC had it tip 50,000 gwei. Since run 21's review every RPC is asked for its estimate before
anything is signed: when more of them say the cancel would revert (an operation already run or cancelled, a key
without the role) than say it goes through, nothing is signed. One RPC alone saying it reverts stops nothing, and a tie
signs: an unannounced owner operation runs at its time. The cancel goes through an RPC whose own estimate fits the gas
it is given.

#### Three-provider pause corroboration

Set `pauseQuorumRpcs` to a full list of exactly three independent providers for each chain to opt in. The two
ordinary `evmRpcs` may be reused, plus a third provider for short read-only queries. The third is not added to
historical log reads or broadcast routes. This is a different trust assumption: at most one of the three may be
faulty; distinct domain names do not prove independent operation.

Before suppressing a redundant send, two providers must corroborate the newest matching canonical block and
answer `paused()` at that block hash. Calls use EIP-1898's `requireCanonical: true`; providers that do not support it
cannot supply a vote. Answers from different blocks are not combined. The selected block must be no more than 30
seconds old and no more than 5 seconds ahead of the host clock. A fresh block can still lag the tip inside that
bound: this mode trusts a recent majority view, not instantaneous finality. Each check has a 1.5-second deadline.

Two fresh honest "paused" answers stop a false "not paused" answer from causing paid retries. Two fresh honest
"not paused" answers allow an emergency pause despite one false "paused" answer. The state is checked again on
later attempts, including after an owner unpause; a prior pause does not permanently lock the guardian's nonce.

Missing configuration keeps the original emergency retry rule and adds a warning. With configuration, a missing
fresh quorum also falls back to emergency retries and warns: two faulty or unavailable providers, unsupported
block-hash calls, stale or forked views, or a host clock outside the bounds can still lead to repeated gas spending.
The monitor does not switch a provider off merely because it disagrees. Inspect the transactions and replace an
incorrect provider as the RUNBOOK describes. `kusdt check` probes this mode without signing or sending a transaction;
the monitor checks it in the background every five minutes and before a pause decision. Warnings never assert that
a pause landed or disable an emergency send by themselves.

#### Kaspa pause retries

On Kaspa the minter's and the pool's pauses are built at the tip: the moves the node's mempool and the blocks not yet
read show ahead of the state the monitor has read, newest first, so a steady stream of spends cannot keep them out. A
pause that goes out and is not followed within 30 seconds is sent again at a higher feerate, multiplied by 4 each try
up to 6 400 sompi per gram, replacing its earlier copy. Each pause is paid from one guardian coin of its own, the
smallest that pays it even at 6 400 sompi per gram (about 1.2 KAS for the minter's, 3.6 for the pool's), and only when
no single coin does from up to four; its retries keep to that coin, and the minter's never takes the coin of the
pool's pause in flight. Until rc.24 every pause took up to the four largest coins, so with the guardian funded in one
coin, or four, the pool's pause waited for the minter's change to come back in a block (run 20's deep round, D3-5).
Fund the guardian in two coins or more, each of 5 KAS or more. Since round 12 the next pause does not wait for those 30
seconds when the coin the last one was built on is seen spent by another transaction (a mint that was already on its
way, a swap): such a pause can never be accepted, and the next goes out in the same round. The monitor sees that in
the blocks not yet read, in the state it has read, and in its node's mempool, which it asks once a round for that one
coin, with a deadline. None of this is ever taken as the followed state: a spend ahead of it that later drops costs
one rejected submit, and the tries go on until a pause is followed. Since run 21 (R21-CHAIN2-1) the same holds when
nothing is left on the coin, the pause included: on kaspad 2.1.0 anyone can push the pool's pause out of a node's
mempool for about 0.1 KAS (a buy a gram-rate above it replaces it, and a spend of the buy's own funding coin a gram-rate
above the buy replaces the buy), and the minter's with a copy of a mint in flight. A pause in no block fetched that the
node, asked by its id, says is not in its mempool brings the next one out in the same round; each pause does so once.
Every pause also goes to the extra nodes of `kaspaSubmitRpcs` from its first try, whether the node took it or not.

### Pausing Kaspa while the follower cannot read it

A pause of the minter or the pool spends the coin the state is in, and the monitor builds it on the coin its follower
last read. A follower that cannot read Kaspa may have last read a coin that has been spent since, and the guardian
coins it keeps may be stale too: the node refuses such a pause for an input it does not have. A node too slow for one
`getBlocks` batch (about 250 blocks with their transactions, 20 seconds to answer) no longer stops it: since run 20
(D2-1) the follower reads that batch one block at a time, for 10 minutes before it tries a whole batch again, each pass
reading for 10 seconds at most and handing out what it read. While it does and is not caught up, the monitor starts
its next round a second after the last instead of after `pollMs`, so the follower is not left idle between passes;
before, a node served at 1.4 times the network's pace left the follower some 1,000 DAA behind for good, every queued
payout unjudged, and a pause at two thirds of a payout's wait. While the follower's reads fail, its lag grows, and the
monitor reads at `pollMs`, not every second. What still fails closed into `unverifiable` after `failClosedMs` is a
follower that reads nothing (a node too slow for `getVirtualChainFromBlock`, or for single blocks), and one whose lag
stays above `kaspaLagFailDaa` without falling (a node served no faster than the network makes blocks). Until rc.24
the monitor then raised `pause-failed` and sent the same refused pauses every round, also after one of them had
landed, for as long as its follower could not read. An outside review of rc.22 on TN10 saw the minter's and the pool's
pauses land 19 minutes after the alarm, and 86 "could not pause" for each after that.

Since run 20 (TN-1) the monitor asks its node's UTXO set, which answers by address even when the blocks cannot be read:

- **Did a pause land?** The monitor keeps the paused coin each of its Kaspa pauses makes (its transaction, output and
  state, in the state file, so a restart has them too). While its follower is behind or failing, each retry first
  looks for those coins in the UTXO set. One that is there, paused, with the covenant's ID, is a pause that landed:
  nothing more is sent, its failure clock is cleared (no `pause-failed` for it), and a note says so once
  (`the pause of the minter has landed: <txid>:<index> ...`), naming an open `pause-failed` of it as out of date. It
  looks again every 30 seconds, and drops the coins once the follower itself shows the state paused.
- **Which coin is current?** When the node refuses every pause of a try for an input it does not have, the monitor
  asks which of the states it can name is there: the one it follows, the ones ahead of it in the blocks it fetched and
  in the mempool (and the paused states a pause found there leads to), and the coins of its own pauses. A paused one is
  a pause that landed (another monitor's with the same key counts too). One not paused is the coin to pause, so the
  pause on it was refused for a guardian coin that is gone: those coins are set aside, the guardian's address is read
  again, and the pause is built on that coin at once, in the same try. None of them there: it looks for the paused
  successor of each state whose pause was refused, at any outpoint (since run 21, R21-REG-1): a state's pause makes
  one paused state (the minter's also moves `admin_nonce` on), and only the covenant's own spends make a coin with its
  ID, so a coin there with the covenant's ID and exactly that paused state's script is that state paused, by another
  monitor with the same key whose pause this one's follower has not read. Until rc.24 that raised `pause-failed` every
  minute for a minter that was paused. Not that either: `pause-failed` says that the coin it follows is gone and no
  later one it can name is there, and the guardian's coins are not put in doubt for it. Until rc.24 a refusal while
  the follower was stuck behind a move it had fetched was always taken for the state coin's, which could keep stale
  guardian coins paying every try until the follower moved on.
- **What it cannot do.** A state coin's address is the hash of its script, which holds the state, and kaspad 2.1.0
  has no call that lists a covenant's coins: the UTXO set confirms a state the monitor can name and finds none it
  cannot. A minter or a pool that moved in blocks the follower has not fetched is paused once the follower, the blocks
  it fetches or the mempool show the move. A node of your own beside each monitor makes that rarer.
- **Bounds and what stays.** Each look is one read of the coins' addresses (at most 40 coins), with 4 seconds to
  answer, and the guardian's address is read with the same deadline (a longer read goes on, and its answer is kept
  when it comes; the pause is paid from the coins kept meanwhile). A look that fails or runs out of time is no look:
  the pause goes out as it did without it, through `kaspaSubmitRpcs` as well, and `pause-failed` comes only when it
  truly failed for a minute. The first pause of an alarm waits for no look: one is made only once a pause has gone
  out. A coin is taken for the covenant's only when the UTXO set holds that outpoint at its own state's address, with
  that script and the covenant's ID (for the paused successor of a state it tried, any outpoint there with that script
  and the covenant's ID; a coin anyone sends to that address carries no covenant ID); a state that does not decode is
  not looked for. The guardian coins a pause spends are in a block or made with the state coin, as rc.22's input rule
  asks (the core refuses anything else).

### A monitor that keeps dying

The failure clocks above live in the monitor's memory and its state. A monitor that dies in every round (an RPC
answer that exhausts its memory, a state it can no longer save) starts each time with fresh clocks, so none of
them ever runs out: it would sit there judging nothing and raising nothing. Two things close this, since rc.16:

- **The starts file.** Before it reads anything, its state included, the monitor writes the time of each start to a
  small file next to its state, `<statePath>.starts`. A round that finishes empties it. Three starts or more with no finished round
  between them, the first of them `failClosedMs` ago or longer, is a crash loop: the monitor pauses everything
  first, then raises `crash-loop` (saving the alarm may be the very thing it dies of). Starts further apart than
  `failClosedMs` are a host that was off, not a loop. A monitor with no `statePath` keeps no such file. A host that
  reboots is one start: the monitor waits for no node at its start and does not exit while its node is still booting
  (each round tries to connect), and its rounds finish without the node, so the first of them empties the file.
  Since run 20 (D5-6) the file is written whole, through a temporary file, and kept at one size (16 KB, its JSON
  followed by spaces): on a disk that has filled up, which has no room for the temporary file, it is written again in
  its own place, which needs no new space. Until rc.24 it was a plain write, and on a full disk every write of it
  failed, the file never grew, and a monitor dying in every round was never counted as a crash loop. When it cannot
  be written at all (the disk filled before the file was first written, a volume that cannot be written), `/health`
  warns `the starts file ... could not be written` until it can.
  Until run 21 (Daybreak [26], R21-ADV-1) the state was read before the start was counted. A state the process could
  not read (one an outsider's records grew past what it can parse under its 512 MB heap, which ends the process; one
  cut short) ended every start before its count: no crash loop, no pause, nothing raised, while the monitor judged
  nothing and only its status went stale. Now the start is counted first, a state that cannot be read (`... could not
  be read`, or `... is not a monitor's state file`) leaves it counted, and at a crash loop's start the vaults are
  paused before the state is read: a vault's pause needs only the deployment and the guardian's key. The minter's
  and the pool's pauses need their coins, which are in the state: they follow once it is read, as above. Another
  deployment's state is still refused at once, and counts no start (it must pause nothing).
- **The state's size.** `/health` warns, and pauses nothing, when a save takes more than a second or the state holds
  more than 100,000 records (mints, deposit nonces, skips, burns, payouts, alarms): such a state is on its way to one
  the monitor saves and cannot read back (deploy/RUNBOOK.md, "The monitor's state keeps growing").
  Its Kaspa pauses at that start are built on the minter and the pool its state last saved, and until rc.24 the node
  refused them once either had moved since (a mint, a swap): the vaults were paused and the minter and the pool stayed
  open for as long as the loop lasted (run 20's deep round, D3-4). Since then, when one of them did not go out, the
  monitor reads Kaspa on from its saved cursor with a scanner of its own, for at most 30 seconds, follows only the
  minter and the pool through what the chain accepted, and builds the pause where they are now, with the looks of
  [Pausing Kaspa while the follower cannot read it](#pausing-kaspa-while-the-follower-cannot-read-it) as ever; one
  paused there by another start or another monitor counts as landed. This comes after the vaults' pauses and after
  the alarm is on disk, and its own state and cursor are not touched. A note says how each went, and when it could
  not reach the current coin, why (`the crash loop's pause of the minter could not reach its current coin: ...`);
  `pause-failed` follows after its minute.
- **RPC answers are capped.** Every EVM RPC answer is asked for uncompressed. A compressed answer is refused
  unread, and reading stops at 16 MB. A lying RPC could otherwise send a small compressed answer that unpacked to
  tens of megabytes in one call and ended the process, again and again.

An alarm is also written to disk as soon as it is raised, not only at the end of the round, since the round may not
live to its own save: once the monitor's thread is let go, in one save for every alarm raised until then (since round
20). Until rc.23 each alarm saved the whole state at once, on the thread that pauses, so three stolen signer keys that
queued thousands of small forged payouts held the pause back by one save per alarm: 2,000 of them took 89 seconds on
a 10 MB state, and about 10,000 would have outlasted the 10-minute payout wait (MON20-1). Now 30,000 of them, on a
40 MB state, have the pause out half a second after the first alarm. Nor does the rest of the work of judging such a
burst hold the pause back (since run 20's deep round, D3-1). Until rc.24, with the list of recent payouts full (50,000)
every payout read pruned all of it again, and the depth rule by total walked its whole window for every payout it
judged: 10,000 forged payouts read with that list full took 187 seconds to the pause, and 40,000 judged by the rule 22
seconds from the first alarm and 28 more in the next round. Now the list is pruned by age once a minute and by its
oldest hundredth at the cap, each window of the rule is summed once and kept up to date as payouts are judged, and
burn owners, burn scripts, flagged payouts and paid payouts are looked up by index: the same bursts take 0.4 and 0.6
seconds.

Nor is such a monitor shown as healthy meanwhile. The check its state holds from before a start is no fresh check,
whatever its age: until a round of this start has made its own, `/health` answers 503 ("no check since this start")
and the signal says stop. Until rc.22 a monitor that died in every round published that saved check at each start,
and was shown healthy for up to five minutes while it judged nothing (R17-PUB-3). So every start, a deploy or an
operator's restart included, shows 503 until its first round has read the vaults, usually seconds.

Before acknowledging `crash-loop`, find what ends the process: its log, its memory limit, its state file, the RPC
it was reading. Restarts by hand count the same: three or more with no round finished between them, each within
`failClosedMs` of the one before and the last `failClosedMs` or more after the first. So let a monitor finish a
round before you restart it again.

### What an outsider can and cannot do

Nothing an outsider can send raises an alarm by itself. A Kaspa transaction with crafted scripts decodes to nothing,
and an input the monitor cannot decode is skipped without an alarm: a burn that was not indexed backs no release, so a
release naming it is still `release-without-burn`. Each accepted transaction is read on its own, so one bad
transaction never costs the rest of its batch. Deposits, however small, raise nothing unless a mint disagrees with
them, and one that names a burn owner is indexed as the burn it is. The public endpoints only read, and are answered by another process from the monitor's files; acknowledging takes the operator bearer token.

A burn that a reorg deeper than the scan depth drops is taken out of the index. It counts again only if the new chain
accepts it.

## The vault owner

The vault owner can replace a vault's signers after its delay (see [Governance](/security/governance/)), so the
monitor watches it as closely as the signers:

- every owner action a vault records (`SignersSet`, `GuardianSet`, `ReleaseLimitsSet`, `DepositLimitsSet`,
  `FeesSet`, `FeesWithdrawn`, `PayoutDelaySet`, `ReleaseCancelled`, `RefundCancelled`, `ReleaseReinstated`,
  `RefundReinstated`, `DepositSurgeSet`, `OwnershipTransferStarted`, `OwnershipTransferred`) must match an
  announced call (`cancelRelease`, `reinstateRelease`, `setDepositSurge` and so on, with its arguments);
  the events of the vault's own deployment are not owner actions;
- every operation queued in a vault's AccessManager (`OperationScheduled`) must match an announced call on the
  vault or on the manager itself. It is caught when it is queued, a full delay before it can run;
- with `cancellerEvmSecretPath`, a key holding the AccessManager's canceller role, the monitor cancels what nobody
  announced. Since rc.16 that includes the Safe's power-adding calls on the manager itself (a role granted, a
  function remapped, a guardian replaced), and since round 11 its `revokeRole` calls. The removal of a canceller (`revokeCanceller`) it cannot cancel: no canceller can, by design (see
  [Governance](/security/governance/#kusdtvault-evm-the-owner)). Without the key, it alarms and pauses, and a person cancels. A cancel that fails is tried again every round
  until it goes through, someone else cancels or runs the operation, or the operation has expired. Cancels never hold
  up the checks or the pause.

Owner events and queued operations are read again for the last 64 blocks on every pass, as queued payouts are: an RPC
can miss a log near the head. Each counts once, so an alarm already acknowledged does not come back.

Announce owner actions in `expectedOwnerCalls`, as `{"chain": 1, "call": "setSigners", "args": [[…five addresses…]]}`
for a vault call, or `{"chain": 1, "target": "manager", "data": "0x…"}` for raw calldata. `kusdt rotate-plan` writes
the lines a signer rotation needs (see [Operations](/developers/operations/#rotating-a-signer)).

## The integrators' signal

`GET /api/v1/signal` is a small answer with a fixed shape, for a pool, an exchange or a wallet that takes kUSDT.
kUSDT transfers cannot be paused, and forged kUSDT looks like the real token, so an integrator should stop
accepting new kUSDT while `ok` is false:

```json
{
  "version": 1, "at": "2026-11-05T12:00:00.000Z", "ok": true, "reasons": [],
  "checkedAt": "2026-11-05T11:59:58.000Z",
  "backing": { "healthy": true, "owed": "249000000", "total": "249000000", "unverifiedMinted": "0" },
  "paused": { "minter": false, "pool": false, "vaults": { "sepolia": false, "bsc-testnet": false } },
  "alarms": { "open": 0, "codes": [] }
}
```

`ok` is false while an alarm is open, the backing does not cover what is owed (INV-1, or only the backing read, by
kUSDT minted for deposits not in that read yet), kUSDT was minted for a deposit the monitor has not seen yet (past
the vault's count, or none found for over a minute; since round 20), the minter, the pool or a vault is paused, the
last check is over 5 minutes old, or the monitor's Kaspa view lags. `reasons` says which. `backing.healthy` is never
true while `owed` exceeds `total`, and `unverifiedMinted` (since round 20) is the part of `owed` that INV-1 has not
judged yet: mints whose deposits are not in the backing read yet, or not checked yet.
Read it from more than one monitor, and treat no answer as `ok: false`. The same facts are on-chain: the minter's
`paused` flag, each vault's `paused()`, and the pool's `paused`.

## What happens on an alarm

1. The guardian pauses every vault (`pause()` from the guardian address), the minter and the pool (`pause`
   transactions signed by the guardian's Kaspa key; its own coins pay the fees). A paused pool stops swaps and new
   liquidity; withdrawals stay open. The pauses start as the alarm opens (since round 20, MON20-1), not when the
   round that raised it ends, which can take its steps' full minute; an alarm raised while a batch of Kaspa
   transactions is applied starts them once the batch is.
2. While any alarm is open, the monitor keeps them paused.
3. An operator investigates and acknowledges the alarm. Acknowledging clears the alarm; **nothing unpauses**.
4. Resuming is a separate decision: `unpause` with 4 of 5 signers on Kaspa, `unpause()` by the owner of each
   vault, and `unpause` by the pool admin. An unpause while an alarm is still open is itself an alarm.

## Proof: the attack in the local end-to-end run

`npm run local:e2e` ends with an attack. It has passed with every step below since 4 November 2026, most recently on 7 November 2026:

| Step | Result |
|---|---|
| Normal flow first, then the monitor's view | Agrees with the coordinator: minted 299, released 50, owed 249 ≤ backing 249 (USDT), no alarms |
| Three stolen signer keys try to mint 1 000 000 kUSDT | Refused by the mint allowance |
| The same keys mint 400 000 kUSDT with no deposit | Accepted by the covenant: the signatures are valid and it is within the allowance |
| At once, they sell all 400 000 into the pool | The circuit breaker refuses the whole sell; the most it lets out is under 10 % of the pool's KAS |
| The monitor | Pauses both vaults, the minter and the pool. Until rc.19 it raised `mint-without-deposit` and `inv1` within seconds; since round 16 the mint, whose nonce no one deposited, is `unverifiable` on its own clock `failClosedMs` (5 minutes) after the monitor saw it, inside a payout's 10-minute wait, and `inv1` follows (that step of round 16 not run yet) |
| The coordinator | Follows the forged mint and the pause |
| A new deposit | Refused by the paused vault |

The covenants cannot see the EVM chains, so they cannot refuse a well-signed mint within the allowance. The
monitor is what turns that into a pause before any USDT can leave. A sell can land in the same block as the mint,
before the monitor sees it; the pool's circuit breaker bounds that.

## Operating it

```sh
npm run monitor -- <config.json>        # in bridge/services
npm run status -- <status.json>         # its public status, a process of its own
```

The monitor answers nobody from outside. It writes its public answers to two files on a volume of its own
(`statusPath`, and the checkpoint beside it), at the end of every round, at once when an alarm opens or is
acknowledged, and every five seconds in between; each file is written whole and swapped in, so it is never read
half written. A separate process, `kusdt status`, serves them under the same paths, with that volume mounted
read-only and no key, no bearer and no connection to any node. A flood of status requests costs the monitor nothing:
the rounds and the pauses never wait for one.

The status process applies the monitor's own rules again when it answers, so a monitor that is not running is never
shown as healthy: a status file more than a minute old makes `/health` answer 503 with its age, the signal
`ok: false` with that reason first, and the status `healthy: false` with a warning. The file's age is measured by the
status process's own clock since the monitor last wrote a newer one, so a host clock set back cannot make an old file
look fresh, and a file or a check dated ahead of the host's clock is never fresh (since round 14). Point outside uptime checks at
the status process's `/health`, as before, and also alert when it does not answer at all (the status process or
the machine is down while the monitor may still be judging).

| HTTP (the status process) | Answer |
|---|---|
| `GET /health` | 200 when healthy, the last check is fresh (under 5 minutes old, and made since the monitor's last start: R17-PUB-3) and the status file is (under a minute), otherwise 503. Since round 30 it answers 503 with `not guarding: offline since ...` or `not guarding: catching up since ...` while the monitor's own machine is offline or catching up ([above](#when-its-own-machine-is-away-or-offline)). It also answers 503 while its Kaspa view lags (600 DAA scores by default), so an operator learns about a stalled node before alarms would come late. Its `warnings` list a guardian short of gas (under 0.01 ETH or BNB) or of spendable KAS (under 1 KAS in its four largest coins), a chain whose releases exceed what its deposits minted by more than its `releaseCapacity` (or `releaseImbalanceWarnUnits`), on mainnet a vault whose payout wait no longer leaves `failClosedMs` its margin (R17-PAY-2), and since run 21 a token that charges a fee on transfers (Ethereum USDT's `basisPointsRate` above 0, with its `maximumFee`: payouts and refunds are short-paid by it, Daybreak [54]; a token without those views, such as BSC-USD, is asked once), by name, all read every 5 minutes: a warning is never an alarm and pauses nothing. Moving value across chains is a normal use, and the warning shows when it has gone far. Since round 11 the warnings also name a transaction in the monitor's node's mempool that spends the minter or the pool coin and that no block will take (looked for every 10 seconds): anyone can place one on the pool for a fee, so it is never an alarm and pauses nothing. Since run 20 they also name the pool's kUSDT reserve address when it holds more coins than one read takes (D6-2, read once a minute: wallets and web apps of rc.24 and older then cannot check the pool, and swaps and liquidity stop for them; newer ones prove the reserve from the transaction that made it, and are stopped only while the coordinator serves no `reserve.made`, R21-POOL-1), and a starts file that cannot be written (D5-6, below). With an EVM guardian, warnings also show absent or degraded pause corroboration, updated from the latest read-only probe; those warnings do not stop emergency retries. Wire it to uptime alerts |
| `GET /api/v1/signal` | The integrators' signal: `ok`, the reasons, the backing, every pause and the open alarms (see [above](#the-integrators-signal)) |
| `GET /api/v1/monitor` | The last check, the alarms, the warnings, `parked` (the mempool spends of the minter or pool coin that no block will take: `{txid, what, spends, why, since, lastSeen, feerate}`), the pauses, the cancels, the minter state, and `pool`: `{utxo, paused, kasReserve, windowOut}` (`null` when no pool is configured). The lists hold the newest entries (up to 200 open alarms, 50 acknowledged ones, 100 flagged payouts and 100 cancels); `counts` says how many there are in all, with the mint, burn and skip records as counted at the end of the last round (since run 20's deep round the mints and burns let go of are counted too, and `counts.retired` says how many mints, paid burns and acknowledged alarms left the state) |
| `GET /api/v1/checkpoint` | Where another follower can start: `scanFrom`, `initialMinter`, `initialPool`, `judgeFromBlock` and `initialSkipped` (when the list is whole), with `initialSkippedFrom`, the `scanFrom` the list belongs to (since round 16, for a coordinator's config: R16-FIX-5), and `skips`: for each skip this monitor followed itself, by deposit (`"1:7"`), its transaction (`txid`), the DAA score of the block that accepted it (`acceptingDaa`) and, since run 21, that block's hash (`acceptingBlock`): `kusdt record-skip` takes the transaction and the block, and prints the DAA score it reads from the signer's own node to compare with `acceptingDaa` (since run 20, D1-1; none for a skip it took from a checkpoint's list). All of one moment: copy them into a monitor's config together, from one answer |

| HTTP (the monitor's operator listener) | Answer |
|---|---|
| `GET /api/v1/checkpoint` | With the operator bearer token (`Authorization: Bearer ...`): the checkpoint above with `initialBurns` and `burnsLeftOut` (the unpaid burns, at most 20,000): that is the answer a monitor starts from |
| `POST /api/v1/alarms/:id/acknowledge` | With the operator bearer token: clears one alarm. Nothing unpauses |

The operator listener refuses every request without the operator bearer before anything is read, and serves
nothing else. Keep it on a private address. In the packages it listens on 127.0.0.1 inside the monitor's container, and
the operator reaches it on the monitor's machine with the package's operator tool, a container of its own on the
monitor's loopback (`docker compose run --rm --no-deps operator`, `deploy/mainnet-monitor/README.md`). Until
run 21 the mainnet package's Caddy, which faces the internet, carried the operators' requests to it from their own
addresses (`OPERATOR_IPS`): a Caddy someone took over could read the bearer and use it (Daybreak [56]).

The four public answers are made by the status process at most once a second from the files it last read (it looks at
them every quarter second, and reads one only when it changed), so an answer can be a few seconds old, and an
acknowledgement shows within a second. The checkpoint alone can be older: it lists every skipped deposit, so the
monitor builds it for its file at most every ten seconds, and no sooner than twenty times the time building it took,
up to a minute. The checkpoint
with the burns, which only the operator bearer gets, is built once in 30 seconds. The one `POST` is refused without
the operator bearer before its body is read, and its body is 4 kB at the most. With `apiClientIp` set in the status
process's config, one client address gets 240 requests a minute (HTTP 429 with `retryAt` past that).

### What the state keeps

The monitor holds its state in memory and writes it whole at the end of every round. Until rc.24 it kept every mint,
minted deposit, paid burn and alarm for good: about 640 bytes a mint, so 200,000 mints made a 122 MB state that took
0.7 to 1.3 seconds a save, and the process ran out of memory near 800,000 (run 20's deep round, D2-5). Since then,
once a minute at a round's end, it lets go of what no rule needs whole any more, as the signers do:

- **A mint** that is judged, was first seen a day ago or more, is out of the minter's journal (the 256 moves a reorg
  can undo) and is named by no open alarm. Its deposits stay as nonce ranges per chain, so a refund of any of them is
  still `refund-of-minted-deposit`, and what it minted stays in a sum per chain for the warning on the chains' flows.
  INV-1 counts the minter's own `remaining`, not the records. Skips are kept, every one.
- **A paid burn**, once its payment is no longer among its vault's recent outflows (the reach of an EVM reorg) and it
  is a day of DAA deep (or the deepest tier's, if deeper). A vault pays a redeemId once.
- **Acknowledged alarms** past the newest 200: they are appended to `<statePath>.alarms`, one JSON object per line,
  and only then taken out of the state. Open alarms, and `vault-blocked` (raised once for good), always stay.

200,000 mints a day deep now leave a state of under half a megabyte, saved in under 30 ms. A state file written by
rc.23 or rc.24 is taken in as it is and let go of in its first minute. One written since cannot be taken back to rc.24:
that monitor would not know the deposits of the mints let go of.

### Configuration

| Field | Meaning |
|---|---|
| `deploymentPath` | The deployment file (covenant IDs, vaults, signers) |
| `kaspaRpc`, `evmRpcs` | The monitor's own Kaspa node and EVM RPCs (by chain code) |
| `pauseQuorumRpcs` | Optional: full lists of exactly three independently operated RPCs per chain. Enables fresh 2-of-3 canonical-block pause corroboration ([above](#three-provider-pause-corroboration)); may reuse the two ordinary RPCs plus a third read-only provider. Requires EIP-1898 `eth_call` by block hash with `requireCanonical: true`. Missing or unavailable corroboration warns and leaves emergency retries active |
| `kaspaSubmitRpcs` | Optional: extra Kaspa nodes (wRPC URLs) every Kaspa pause is also submitted to, from its first try, whether `kaspaRpc` took it or not (since run 21, R21-CHAIN2-1; until then only when `kaspaRpc` refused it or did not answer, and at every retry). Nodes that build block templates and are connected to mining nodes. Nothing is read from them |
| `guardianKaspaSecretPath`, `guardianEvmSecretPath` | The guardian keys. Without them the monitor can alarm but not pause. Since run 21 (Daybreak [20]) a mainnet monitor refuses to start without both unless `dryRun` is `true` (one that only watches) |
| `statusPath` | Optional: where it writes its public status for the status process (`<statePath>.status` unless set), and the public checkpoint beside it (`<statusPath>.checkpoint`). Put it on a volume of its own, mounted read-only in the status process. `kusdt check` fails a folder it cannot write |
| `statePath` | Where it keeps its state between restarts. It writes `<statePath>.starts` beside it (see [A monitor that keeps dying](#a-monitor-that-keeps-dying)), and `<statePath>.alarms`, the acknowledged alarms moved out of the state ([below](#what-the-state-keeps)): keep them on the same volume, and back the volume up, not the one file. Since run 20 (D5-2) it holds `<statePath>.lock` while it runs, as a signer does: a second monitor on the same state does not start beside it but waits inside its process, reading nothing and counting no start, until the lock is free (a holder on another machine whose lock is no longer written is taken over after 45 seconds). Ended and started again it would count a start each time, and three within `failClosedMs` pause everything. A monitor whose lock another process took over stops |
| `initialMinter` | The minter UTXO and state to follow from (the genesis output). Optional when the deployment file has its `launch` record |
| `initialPool` | Optional: the pool UTXO and state to follow from (the pool's genesis output); defaults to the deployment's `launch` record. With it, the guardian pauses the pool too |
| `genesisRemaining` | Optional: `remaining` at genesis. Defaults to the initial minter's |
| `scanFrom` | A block hash at or before the genesis transaction. Optional when the deployment file has its `launch` record |
| `pollMs` | Optional: time between checks; 6 000 ms by default (1 000 ms while it catches up) |
| `minDepthDaa` | Optional: how far below the virtual a chain block must be before it is read; 10 DAA scores by default |
| `graceMs` | Optional: how long a mint may wait for its deposit, or a refund for its skip; 300 000 ms by default |
| `failClosedMs` | Optional: how long a chain or the Kaspa node may stay unreadable before the `unverifiable` alarm pauses everything, and how long a mint may stay unjudged; 300 000 ms by default. While the monitor's own machine is offline or catching up these wait, and a part of a catch-up with no progress for this long ends it ([above](#when-its-own-machine-is-away-or-offline)). It must be at most half the vaults' payout wait, with 2.5 minutes for a round, the pauses and a mined block inside the wait too: the preflight check refuses anything else on mainnet. Since round 17 (R17-PAY-2) a mainnet monitor refuses to start on an `expectedOwnerCalls` entry announcing a `setPayoutDelay` it does not fit (lower `failClosedMs` first), and `/health` warns when a vault's wait no longer fits |
| `expectedGovernance` | Governance the operators announce in advance, as `{adminNonce, action, params}` (params in hex). Any `setSigners`, `setLimits`, `skipNonce`, `setValue` or `proposeRecovery` not announced alarms (`signers-changed`, `limits-raised`, `governance-unannounced`, `value-changed`, `recovery-proposed`); an `unpause` alarms while an alarm is open, and with none open, like a `vetoRecovery`, is noted, announced or not. `kusdt govern-sign` prints the line |
| `expectedOwnerCalls` | Vault owner actions the operators announce in advance (see [The vault owner](#the-vault-owner)). Anything else alarms |
| `cancellerEvmSecretPath` | Optional: a key with the canceller role in each vault's AccessManager. The monitor cancels every queued operation nobody announced |
| `dryRun` | Optional: alarm without pausing anything. `true` or `false`, without quotes: since run 21 (Daybreak [20]) the monitor refuses to start on anything else (`"false"` in quotes was read as true, and paused nothing) |
| `minDaaPerSecond` | Optional: the least the Kaspa node's virtual DAA must rise per second; 1 by default, a tenth of the network's pace |
| `judgeFromBlock` | Optional, per chain: for a monitor rebuilt with no state, the block events are judged from. Take it from a healthy monitor's `/api/v1/checkpoint`. A payout queued below it is still judged while it waits in its vault (since round 15, R15-PAY-4): each one is looked for in the queue, and judged if it is there; since round 16 (R16-PAY-5) whatever its age, as a paused vault pays any of them once it runs again, and none whose payment or cancel the monitor reads after it. Since run 20 (D5-9) the monitor refuses to start on a value more than ten minutes of blocks above the highest head the chain's RPCs answer, before its start is counted, as `kusdt check` fails it; one it could not check then (no RPC answered) is `unverifiable` at its first read of the chain |
| `initialBurns` | The unpaid burns from the same checkpoint answer (asked with that monitor's operator bearer), copied as they are. With them, a monitor that starts from the checkpoint does not have to find a burn from before it at its address when its release is queued. Taken in only with its own checkpoint: on an empty state, or when the monitor goes on from that checkpoint after a gap; a monitor with a state of its own logs that it left the list alone. It is the operators' word: take it from a monitor you run. `kusdt check` fails a list with an entry that is not a burn record, and warns when a monitor that starts after deposits were made has none |
| `initialSkipped` | The skipped nonces from the same checkpoint. With it, a rebuilt monitor judges a refund of a deposit from before the checkpoint. Without it, it cannot tell a skipped deposit from a minted one, so every such refund is an alarm and a pause. `kusdt check` fails a monitor that starts after deposits were made and has no list |
| `evmHeadLag` | Optional: how many blocks below the EVM head its reads stay; 2 by default, 0 on local Hardhat chains, which also turns off the frozen-head check. See [Operations](/developers/operations/#service-settings) |
| `maxLagDaa` | Optional: how far its Kaspa view may lag before `/health` answers 503 and the integrators' signal says stop; 600 DAA scores by default |
| `kaspaLagFailDaa` | Optional: how far its Kaspa view may stay behind, without catching up, for `failClosedMs` before the `unverifiable` alarm pauses everything; 3 000 DAA scores by default |
| `expectedPoolKeys` | Optional: pool key changes the operators announce in advance, as `{admin, guardian}`. A `set_keys` that changes a key and matches none is `pool-keys-changed` |
| `releaseImbalanceWarnUnits` | Optional: the threshold of the `/health` warning about one chain's releases over its deposits, in kUSDT units. Defaults to that vault's `releaseCapacity` |
| `bearerPath` | The operator bearer token for acknowledging alarms |
| `apiClientIp`, `apiRequestsPerMinute` | Optional: a count per client address on the operator listener, read as the status process reads them (below) |
| `listen` | `{host, port}` for the operator listener: `127.0.0.1` and 9311 in the shipped packages (since run 21), so that nothing but a command run inside the monitor's own container reaches it. In a container the host must be one of the container's own addresses (the machine's address is not). A listener that cannot listen is said in the log and tried again every minute; the monitor goes on judging and pausing (since round 17), and `kusdt check` fails a host it cannot listen on |

The status process's config (`status.json`):

| Field | Meaning |
|---|---|
| `monitorStatusPath` | The monitor's `statusPath`, as this process sees it (a read-only mount) |
| `listen` | `{host, port}` for the public status (9310 in the shipped packages) |
| `apiClientIp` | Turns on the limit of status requests per client address, and says where that address is: `x-forwarded-for` behind the Caddy the mainnet package ships, `cf-connecting-ip` only where nothing but Cloudflare reaches the proxy, `socket` with nothing in front. The preflight check fails a mainnet config without it |
| `apiRequestsPerMinute` | Optional: how many requests one client address may make a minute; 240 by default |

:::caution[Announce governance first]
Before the signers rotate keys, change limits or change the minter's KAS deposit on Kaspa, add the action to
`expectedGovernance`. Otherwise the monitor raises `signers-changed`, `limits-raised` or `value-changed` and pauses
everything. Likewise add a pool key change to `expectedPoolKeys`, or it raises `pool-keys-changed`.
:::
