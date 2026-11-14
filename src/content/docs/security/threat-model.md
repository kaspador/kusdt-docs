---
title: Threat model
description: What a stolen key, a bad signer quorum, a compromised coordinator or a compromised owner can and cannot do, with numbers.
---

This page goes through each party that could be compromised and states what follows. Numbers use the mainnet
launch values from [Limits](/protocol/limits/): a Kaspa mint allowance of 100 000 USDT (twice the signers' daily
limit) and a release allowance of 50 000 USDT per vault, each refilling fully in 24 hours. Because an allowance is a bucket that can be emptied and
then refills, up to twice its ceiling can be drawn in any 24-hour window. A vault's queue, drawn earlier, can be paid
in that window as well, so just under three times its ceiling can leave a vault.

## Summary

| Compromised | Kaspa side | EVM side (each vault) |
|---|---|---|
| 1 or 2 signers | Nothing | Nothing |
| 3 signers (a bad quorum) | Mint unbacked kUSDT within the allowance, while not paused | Pay out without burns, within the release allowance, while not paused |
| 4 or 5 signers | Raise the mint allowance, so only the remaining hard cap bounds minting; unpause; replace the signers and the minter's guardian, so that the minter can no longer be paused | Same as 3: the vault's allowance and signer set belong to the owner, and the vaults' and the pool's guardians are not theirs to change |
| Guardian key | Pause the minter and the pool | Pause the vault |
| Coordinator | Stall | Stall |
| Monitor | Pause, or fail to pause | Pause, or fail to pause |
| Vault owner | Nothing | After its 48-hour delay, unless a canceller cancels it: replace the signers and raise limits within the hard bounds. To act without the cancellers it must remove them all or outlast them: 48 hours from their last cancel (96 only if they cancel every try until they are removed). It can pause at once, and keep a vault paused for as long as it holds the Safe |
| Pool admin | Take the accrued protocol fees, unpause the pool, hand the keys over | Nothing |

## Attack vectors

A review of every attack we know of, as of 7 November 2026. Status means:

- **tested**: an attack run or a test shows the defence works;
- **bounded**: the attack works, but a limit caps what it can take;
- **by design**: the protocol's shape rules it out;
- **open**: not solved yet;
- **fixed**: found and fixed, with the date.

### Bridge

| Attack | What stops it | Status |
|---|---|---|
| 3 of 5 signer keys mint unbacked kUSDT | The mint allowance: 100 000 at once, at most 200 000 in any 24 hours. The monitor pauses within `failClosedMs` (5 minutes) of seeing the mint, inside a payout's 10-minute wait: a mint of a nonce no one deposited fails closed on its own clock, and one of someone else's deposit is `mint-mismatch` (since round 16, also while a deposit history is being read) | Tested: the 400 000 forged mint in `local:e2e` |
| 3 of 5 signer keys pay out without burns | Every payout waits in the vault, 10 minutes on mainnet. The monitor raises `release-without-burn` when one is queued, as soon as its Kaspa view has caught up, and pauses: nothing leaves, however small the theft is split, as long as every forged payout is cancelled before the unpause (one call each; `kusdt cancel-plan` builds them from the monitors' lists: [Known limits](/security/known-limits/#forged-payouts-are-cancelled-one-by-one)). If no pause comes within the wait (every monitor down, or the pause not mined in time), each vault's release allowance is the bound: 250 000 at once, so about 250 000 per vault | Tested: the small forged payout in `local:load` |
| A burn reorganized away after its payout | Finality on Kaspa, deeper for larger burns: 1 000 DAA, 6 000 above 10 000 kUSDT, 36 000 above 100 000 | Fixed 5 November 2026 (the tiers) |
| A compromised vault owner queues new signers or limits | Every owner change waits 48 hours in the AccessManager; the monitor alarms when it is queued, and a canceller (or the monitor itself) cancels it | Bounded (5 November 2026) |
| A compromised vault owner gives itself power through the manager (a new GOVERNOR with no delay, a function remapped) | Until rc.16 no canceller could cancel such a call: it could be seen for 48 hours and not stopped. Now the cancellers can cancel the manager's power-adding calls too. Removing a canceller can't be cancelled (or a rogue one could never be removed), so a stolen Safe must remove every canceller, 48 hours in plain sight, before a power-adding call can run uncancelled. Since round 11 the same holds for taking the Safe's own roles away under a paused vault (a freeze that outlasts the keys): the cancellers can cancel that too | Bounded, with tests (10 and 11 November 2026; the figures corrected in round 12): a theft takes 48 hours from the cancellers' last cancel, 96 only when they cancel every re-schedule until they are removed. Not prevented: if nobody acts in that time, the Safe's holder wins. Not bounded at all: a pause. The holder of the Safe's keys pauses at once and cancels every unpause for as long as it holds them |
| A cancelled payout queued again with the signatures it was first queued with | The vault keeps a cancelled payout cancelled: `release` and `refund` refuse it until the owner reinstates it, a 48-hour call the cancellers can cancel | Fixed 10 November 2026 (from an outside review), with tests |
| A governance signature from before a pause used after it (an unpause signed in a drill and never sent, plus three stolen keys) | A pause moves the admin nonce, so every 4-of-5 signature made before it is void; an unpause works on a paused minter only | Fixed 10 November 2026 in the minter covenant, with tests |
| Four signers setting limits so large that the minter's arithmetic overflows and it stops for good | `set_limits` refuses a ceiling or refill rate above the lifetime cap | Fixed 10 November 2026 in the minter covenant, with tests |
| A copy of a governance transaction sent with a smaller age | Refused: the signers sign the age the transaction claims (since rc.16), so the copy fails the signature check | Closed. What the signers themselves leave uncredited is a delay only ([known limits](/security/known-limits/#a-governance-action-credits-the-mint-allowance-only-up-to-the-age-its-signers-signed)) |
| A forged refund kept unjudged until it is paid, by making one of the monitor's Kaspa rounds fail every two minutes | A failed round stops a queued refund's grace, it never restarts it; a refund with no skip is judged in the second up-to-date round; any queued payout still unjudged at two thirds of its wait fails closed | Fixed 10 November 2026, with a test of the reported attack |
| A monitor made to die in every round (a huge or compressed RPC answer, a state grown too large to save), so that it never judges or pauses | RPC answers are capped and never unpacked; outputs that only looked like burns are dropped once spent; a monitor that keeps starting without finishing a round pauses everything and raises `crash-loop` | Fixed 10 November 2026, with tests |
| Unfinished request bodies filling the coordinator's memory | Bodies are limited in size, in number and per client, and must arrive within 10 seconds | Fixed 10 November 2026, with tests on real sockets |
| Records grown on purpose until the coordinator runs out of memory | Burns that could never be paid are no longer recorded, and dust burns no longer take real burns' places in the queue. Real burns still leave a record for good, and the coordinator holds its records and its kUSDT index in memory | Open: a stall, no funds at risk ([known limits](/security/known-limits/#the-coordinator-keeps-everything-in-memory)) |
| 3 of 5 signer keys try to replace the signers | A recovery needs the minter to stand untouched for 72 hours, every mint restarts the wait, any single signer can veto it, and the monitor alarms on one nobody announced | Open by design: one honest signer has to veto in time |
| 4 of 5 signer keys | They can raise the Kaspa limits and unpause the minter. The vaults' limits and signers belong to the owner (an AccessManager under a Safe on mainnet, 48-hour delays) | Bounded on the vaults; the monitor is the defence on Kaspa |
| A stolen guardian key | It can only pause: griefing | By design |
| A lying coordinator or API | It can stall or censor, nothing more. Wallets check token states against their own node and pin the deployment, and ask the vault itself whether it can pay a burn before they build one; signers re-check everything. A rotation keeps the guardian the deployment records, whatever the coordinator says | By design |
| Write access to 3 signers' hosts | Their state files say which deposits were skipped, so a forged skip record could get a refund of a minted deposit signed. Write access there is the same as holding those 3 keys. A refund still waits in the vault (10 minutes on mainnet) and the monitor raises `refund-of-minted-deposit` | Open by design: treated as 3 stolen keys |
| Fake deposits or burns fed to a signer through its RPC or node | It takes 3 operators' nodes. Every RPC a signer uses must agree on every field of a deposit (its sender, which a refund pays, included) and of every release and refund. For a deposit they agree at one moment: each mint and refund asks every RPC for the deposit's own blocks at once, and the records each reported earlier only say where to look, so a lie one RPC told once and another told days later never add up (run 21, R21-SIG2-1). On the public testnet (4 to 14 November 2026) all 5 signers ran on one machine | Open until there are 5 independent operators; the full agreement fixed 5 November 2026, agreement at one moment in run 21 |
| A wrong redemption report sent first, to strand someone's burn | Claims are checked against the coordinator's node, which decides; a client's transaction cannot edit the token index | Fixed 5 November 2026 |
| An RPC outage switching the monitor off | Each chain is checked on its own, INV-1 is never judged on partial backing, and a chain unreadable for 5 minutes pauses everything, within a payout's wait | Fixed 5 November 2026 |
| Reorgs | Finality on both sides; the follower goes back to the fork point if Kaspa's chain moves anyway. A signer also undoes the minter moves the dropped blocks accepted, and signs no refund unless the minter it follows is on its node, so a skip the new chain replaced with a mint can't be paid as a refund | Fixed 4 November 2026 (the follower rewind) and 6 November 2026 (undoing the moves, from an outside review) |
| Replay across chains, vaults or deployments | The EIP-712 domain, the covenant ID in the digests, each `redeemId` paid once | Tested |
| Decoy outputs fooling the followers | Successors come only from covenant-bound authorized outputs | Fixed in the security review, with tests |
| Tether blacklists a recipient or a vault | Nothing is paid to a blocked address; a blocked vault pauses everything | Fixed 4 November 2026 ([Blocked recipients](/security/known-limits/#blocked-recipients)) |
| Big legitimate flows that use up the allowances | Liveness only: the bridge waits for the refill. It costs the attacker 0.5 % each way | Bounded |
| One party using up the signers' daily limit | Liveness only. Deposits: the deposit fee rises with the day's deposits, to 2.50 % at a full meter, so filling the limit costs about twice the flat fee and more while it stays full. Bridging back: still the flat 0.50 %, because a release's fee is set after the burn | Deposits: bounded (10 November 2026). Bridging back: open ([known limits](/security/known-limits/#the-daily-limit-can-be-used-up-by-one-party)) |

### Swap

| Attack | What stops it | Status |
|---|---|---|
| Forged kUSDT dumped into the pool | The biggest one. A forged mint and a sell can land in the same block, so no monitor can stop it. The pool's **circuit breaker** stops it on-chain: sells take at most 10 % of the KAS reserve at once, refilling at that much per hour, net of buys (right after buys, a sell claiming no time can also take the KAS they brought in, up to one more cap: [Known limits](/security/known-limits/#the-pool-caps-sells)) ([KasPool](/contracts/kaspool/#the-circuit-breaker)). Idle time can't pile up past one cap and the clock can't be set back: it is the pool UTXO's own age, which consensus proves. The monitor then pauses the pool with everything else: swaps and new liquidity stop, withdrawals stay open, and only the pool admin resumes | Fixed 4 November 2026. Tested: in `local:e2e`, 400 000 forged kUSDT get under 10 % of the pool's KAS |
| Sandwiching | A swap spends the exact pool state it was quoted on, so a front-run makes it fail, never fill worse. But the wallet used to re-quote by itself within your slippage, so a bot could take up to that slippage. Now the wallet asks before a worse price: it goes ahead on its own only when a new quote is at least as good as the one you confirmed | By design on-chain; fixed in the wallet 4 November 2026, with tests |
| Inflating the first depositor's shares | 1 000 shares are locked at `init` and can never be withdrawn | By design |
| Rounding and overflow | Exact 128-bit products and bounds on every input | Tested; needs the audit |
| Swap spam | Griefing only: each swap pays the network fee and 0.50 % | Bounded |
| Round trips that use up the hour's sell room | The breaker counts the net flow, so a buy gives the room back | Fixed 5 November 2026 |
| A backdated breaker clock replaying idle windows (a day without sells gives 24 windows at once) | The clock is the pool UTXO's age, proved by a relative lock; one moment can claim one age, and idle time fills the allowance to one cap at most | Fixed 8 November 2026 (found in an adversarial review), with tests |
| Three signer keys burning `admin_nonce` to void a signed governance action | `set_value`, the one action below the 4-of-5 quorum, now takes 4 of 5 like the rest | Fixed 8 November 2026 (found in an adversarial review), with tests |
| Draining the pool by buy-then-sell or add-then-sell cycles at one moment | The cap's reference rises only with claimed time, and a positive count is forgiven only by claimed time and real buys, so one cap net (plus credit) is the most one moment can move | Fixed 8 November 2026 (found in an independent review), with a randomized test of every entry against the bound |
| Resetting the breaker with liquidity that is added, used for a buy, and withdrawn at one moment | A withdrawal hands back the credit of recent buys KAS for KAS, so bought-in KAS that leaves again leaves no room behind | Fixed 8 November 2026 |
| Opening the pool with dust | A first deposit of dust leaves a reference so small that sells stay shut for about a day, and under about 720 sompi a 50 DAA claim refills nothing | Fixed on 10 November 2026 in the pool covenant: the first deposit, and the first after every provider has left, take the pool admin's signature, and the latter starts the cap again at the new reserve. Left: a dust position kept by someone else when the last provider leaves ([known limits](/security/known-limits/)) |
| A long pause handing sells a fresh cap | Ticks and withdrawals during a pause counted its time, so the unpause opened a full cap | Fixed on 10 November 2026: while paused the breaker stands still (no tick; a withdrawal claims nothing), and the unpause starts its clock again |
| Holding a used-up breaker shut with empty pool spends | A pool spend that claims less than its UTXO's age wastes the refill earned so far. It costs a network fee per spend, moves no KAS, and leaves buys and withdrawals open | Fixed on 10 November 2026 in the pool covenant: while more than half of the cap is in use every pool spend claims at least 50 DAA (below half sells have at least half a cap, and dust can't bring the minimum back), and the [keeper](/contracts/kaspool/#the-keeper) ticks a moment after each slot opens once it has seen a late claim, so a late spend no longer lands. A bot first to every slot can still keep other pool transactions out while the count is above half: with dust for at most half a window after a full-cap sell (1.5 windows if half the pool was also withdrawn), longer only by selling about the whole refill |
| Price manipulation | Nothing reads the pool price as an oracle | By design |
| A stolen pool admin key | It can take the accrued fees, unpause and hand the keys over (the guardian key too: then no monitor can pause the pool, and every monitor raises `pool-keys-changed`). It cannot touch the reserves or a position. It can also hold up every pool transaction, the withdrawals from a paused pool included, for as long as its holder pays a fee a spend: each admin spend (`set_keys` to the same keys, `unpause` and a pause after it, `collect`) moves the pool's outpoint from under whatever was built on it (found in round 13, R13-COV-L1; the admin's entries are as they were for this). It cannot park the pool coin: since rc.22 the admin entries ask sequence 0 of the pool input and take only inputs in a block or siblings of the pool coin, so a spend no block can take is refused by the node's script check. Round 11's COV-2 closed a repeated pause for the guardian's key (a paused pool takes no second pause). The operators' answer is a race to hand the admin key over, or a new pool ([known limits](/security/known-limits/#a-stolen-pool-admin-key-can-hold-the-pool-up)) | Bounded for funds: nothing can be taken. Withdrawals can be delayed while the key is held |

### Users and apps

| Attack | What stops it | Status |
|---|---|---|
| Phishing: a fake app, extension or token | The wallet pins the covenant ID and the vaults. Check the covenant ID | By design |
| Malicious sites and clipboard swaps | The wallet's approval window shows the exact address. It is the last defence | By design; it relies on the user reading it |
| The extension's supply chain (npm dependencies) | A lockfile audit and reproducible builds. CI already reproduces the WebAssembly core the wallet embeds; the extension's own bundle is not yet checked | Open |
| Mistakes | A burn to a wrong address cannot be undone. The wallet refuses the burns it knows can't be paid | By design |

### Before mainnet, in order

1. The pool's circuit breaker. **Done.**
2. No silent worse re-quotes in the wallet. **Done.**
3. At least 2 independent monitors, with external alerts on `/health`.
4. Five independent signer operators. Five are lined up; nothing runs on mainnet yet.
5. External audits of the covenants, their compiler and the vault, and allowances sized to what can be lost.
   With 3 stolen keys and a pause within the wait, no forged payout leaves the vaults. Without one, today's limits
   risk about 100 000 USDT from them (both vaults' release allowances at the launch). Forged kUSDT can still take at most about 10 % of the pool's KAS (up to about twice that right after buys), and it stays
   a claim on the vaults: see below.

See also the [mainnet checklist](/security/mainnet-checklist/).

### The root cause

Every serious attack needs 3 signer keys stolen together, or a bug in a covenant or its compiler. The pool cannot
tell forged kUSDT from real: it is the same token, with the same covenant ID. The breaker bounds the damage. The
real defence is keeping 3 keys from ever being stolen together.

## Signers

### One or two signer keys

Every mint, release and refund needs 3 distinct signers. One or two keys can sign nothing that a contract
accepts (INV-4).

### A bad quorum: three signer keys

| Side | Can | Cannot |
|---|---|---|
| Kaspa | Mint kUSDT that no deposit backs, up to the mint allowance: 100 000 USDT at once, at most 200 000 USDT in any 24 hours | Exceed the allowance or the hard cap; unpause the minter; change the limits, the signers or the guardian (all of these need 4) |
| Each vault | Queue releases and refunds that no burn or skip justifies, up to the release allowance: 50 000 USDT at once, under 150 000 USDT in any 24 hours. Each is paid only if the vault is not paused when its wait ends | Exceed the allowance; shorten the wait; change any vault parameter; unpause a paused vault |

Unbacked mints or releases make kUSDT in circulation exceed the backing. The monitor checks this (INV-1) and the
guardian pauses the vaults and the minter. A bad quorum of 3 cannot undo that pause on either side: unpausing
BridgeMint takes 4 signers, and unpausing a vault takes the owner. The owner then replaces the vault signers with
`setSigners` and cancels every bad queued payout (`cancelRelease`, `cancelRefund`) **before unpausing**: a pause only
holds a queued payout, and it would be paid once the vault runs again. A cancelled payout stays cancelled: the vault
refuses to queue it again, even with the signatures it was first queued with, until the owner reinstates it. So the
cancel no longer depends on the signers having been replaced first.

**What the wait does not solve: forged kUSDT already minted.** Three stolen keys can mint up to the allowance, and
kUSDT burns can't be paused. A burn of forged kUSDT is a real burn, and it looks like any other: signers can't tell it
apart, the monitor raises nothing about it, and after the vault runs again the honest signers would pay it. So while
everything is paused the operators have to work out what the forged mint became, and restore INV-1, before any vault
runs again. There is no list of burns not to pay yet.

Unbacked kUSDT also harms holders and the pool. Sold into KasPool, it takes KAS from the pool's liquidity
providers. The pool's circuit breaker lets sells take at most 10 % of the KAS reserve at once, refilling at that much per hour, and the guardian
then pauses the pool (see [KasPool](/contracts/kaspool/#the-circuit-breaker)).

### Four or five signer keys

This is an accepted limit (the project owner's decision, 6 November 2026): Kaspa's governance takes effect at once, and 4 keys can replace the minter's guardian along with the signers. A delay would need a veto too, since 4 of the 5 signers are already the problem, and the covenant keeps its simpler form. What protects kUSDT here is that the five operators are truly independent.

With 4 keys the Kaspa side loses its limits, because 4 signers set them. `set_limits` can raise the ceiling and
the refill rate, so minting is bounded only by the remaining hard cap (`remaining`, 1 billion USDT at launch).
`unpause` can undo the guardian's pause of the minter, and `set_signers` can replace the signer set and the
guardian, which takes over BridgeMint for good. On the Kaspa side, the INV-1 monitor is then the defence.

The vaults are unaffected beyond the 3-key case. Their release allowance and signer sets are set only by the
vault owner, so USDT leaves each vault no faster than its release allowance, and the guardian pauses the vaults
the moment INV-1 fails. Only the owner can unpause them.

## Guardian

The guardian key can pause BridgeMint, both vaults and the pool, and do nothing else. A stolen guardian key can
stop the bridge and the pool:

| Side | Who resumes | Who replaces the guardian |
|---|---|---|
| Kaspa | 4 signers (`unpause`) | 4 signers (`set_signers`) |
| Vault | The owner (`unpause`); on mainnet through the AccessManager's emergency delay, about 6 hours | The owner (`setGuardian`), with the same delay |
| Pool | The pool admin (`unpause`) | The pool admin (`set_keys`) |

kUSDT transfers on Kaspa are not affected by any pause. A paused pool still lets liquidity providers withdraw.

## Coordinator

The coordinator holds no key that moves funds. It can:

- stall the bridge, by not collecting or not submitting signatures;
- report false status through its API.

Whoever takes the coordinator over also holds its five bearer tokens and its address, and can ask the signers for
signatures. What that can cost is bounded on the signers' side: each works on at most 16 sign requests at a time and
600 a minute (its RPC plans are what the requests use), a mint of a deposit the minter has already passed is refused
and not charged to the daily limit, and a release or refund is signed only for a burn or skip the signer finds
itself. After such a takeover, have every signer's operator replace the bearer token before the new coordinator
goes up.

It cannot redirect funds: every signature binds the exact recipient and amount, and the contracts check them.
Anyone holding valid signatures can submit them without the coordinator. Every important API answer can be
checked against a node.

## Monitor

The [monitor](/security/monitor/) reads every chain from its own nodes and holds the guardian keys. On any alarm it
pauses both vaults, the minter and the pool; it never unpauses. A compromised monitor can pause (as above) or fail to pause
when something breaks. Without a pause, the allowances still cap what 3 bad signers can move.

## Evidence: a bad quorum in the local run

The local end-to-end run (`npm run local:e2e`, with the pool step since 4 November 2026, most recently passing on 7 November 2026) plays the 3-key attack:

| Step | Result |
|---|---|
| Before the attack | The monitor agrees with the coordinator: minted 299, released 50, owed 249 ≤ backing 249 (USDT), no alarms |
| Three stolen signer keys mint 1 000 000 kUSDT | Refused by the mint allowance |
| They mint 400 000 kUSDT with no deposit | Accepted by the covenant, which cannot see the EVM chains |
| At once, they sell all 400 000 into the pool | The circuit breaker refuses the whole sell. The most it lets out is under 10 % of the pool's KAS, chained on the forged mint |
| The monitor | Pauses both vaults, the minter and the pool: within seconds until rc.19; since round 16 by the mint's own fail-closed clock, `failClosedMs` (5 minutes) after it saw the mint, then `inv1` (not run yet) |
| The coordinator | Follows the forged mint and the pause |
| A new deposit | Refused by the paused vault |

The forged kUSDT stays on Kaspa, where transfers are not paused. The pause keeps it from being released for USDT
or sold into the pool.

## Vault owner

On mainnet the owner is an OpenZeppelin AccessManager whose admin is a Safe (see [Governance](/security/governance/)).
A compromised Safe can, after the delay and unless a canceller cancels it:

- replace a vault's signers with its own keys (`setSigners`);
- raise the release allowance to the hard bounds: a capacity of up to 1 billion USDT, refilling fully in no less
  than a day;
- set fees up to 1 %, the deposit fee at a full meter up to 3 %, and minimum fees up to 50 USDT;
- reinstate a payout that was cancelled (it then still needs 3 signers' signatures and the wait);
- withdraw accrued fees.

It cannot withdraw backing directly or give up its roles at once (`renounceRole` is closed: a role ends through a
48-hour admin call), and every change becomes public 48 hours before it takes effect (`setGuardian`
and `unpause`: about 6 hours). The monitor alarms the moment a change it was not told about is queued, pauses the
vaults, and can cancel it with a canceller key; the cancellers are parties other than the Safe's holders. A rogue
canceller can only cancel, and the Safe can remove it (that too waits 48 hours, and cancellers cannot cancel it).

A compromised Safe can also try to change the manager itself, for example grant GOVERNOR to a key of its own with
no delay. Since rc.16 any one canceller can cancel that as well, and since round 11 also the removal of the Safe's
own roles, which would leave a paused vault with nobody to unpause it. To get past the cancellers the Safe must
remove each of them, which waits 48 hours and cannot be cancelled by them. The change itself can be scheduled in
the same minute and scheduled again whenever it is cancelled, so it runs 48 hours after the cancellers' last
cancel: at about hour 96 only if they cancel every re-schedule until they are removed, with every step public and
alarmed. If nobody acts in that time, nothing else stops it. A pause needs none of this: the Safe pauses a vault at
once and can cancel every unpause it scheduled, so a vault stays paused for as long as someone holds the Safe's
keys.

The owner is the one party whose compromise is not capped by the release allowance, which is why it sits behind a
multisig, a delay and independent cancellers.

## Chains and nodes

| Threat | Mitigation |
|---|---|
| A reorg on the source chain after a mint or release | Act only on final deposits and burns (see [Finality](/protocol/finality/)) |
| Kaspa's selected chain moves off a block a follower already read | The follower reads again from the fork point; a transaction it already followed spends a state it no longer holds, so it is ignored (see [Following covenant states](/architecture/following-states/#when-the-chain-moves-anyway)) |
| A load-balanced EVM RPC answers from a node behind the head it reported | Reads stay `evmHeadLag` blocks (2 by default) below the head |
| A signer's own node lies to it | Each signer runs its own nodes; a lie fools one signer, and a quorum needs 3 |
| Replay across chains, vaults or deployments | Digests name the covenant ID; EIP-712 names the chain ID and the vault |
| Tether blacklists a release or refund recipient | Signers refuse to sign it (USDT would pay it and freeze it there); the coordinator holds it as `blocked` and pays it once unblocked |
| Tether blacklists a vault | The vault can pay nothing out. The monitor raises `vault-blocked` and the guardian pauses everything |

## Users

| Mistake | Result |
|---|---|
| Burn to a wrong EVM address | Paid to that address; nobody can redirect it |
| Burn to an address the token blocks | Not paid while it is blocked: held, and paid if the token unblocks it. No key can redirect it. Wallets refuse to build it |
| Burn at or below the release fee | Never paid |
| Burn state with a non-zero borrow scheme, borrow guard or extension commitment | Never paid; the kUSDT is lost. The core's `transfer` builder refuses to build one, as it refuses a redemption naming a chain other than 1 or 2 or the zero address (since run 21, Daybreak [27]) |
| Deposit naming a wrong Kaspa owner | Minted to that owner |
| Accept a token that only claims to be kUSDT | Check the covenant ID |
