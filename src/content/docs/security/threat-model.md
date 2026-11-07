---
title: Threat model
description: What a stolen key, a bad signer quorum, a compromised coordinator or a compromised owner can and cannot do, with numbers.
---

This page goes through each party that could be compromised and states what follows. Numbers use the mainnet
defaults from [Limits](/protocol/limits/): a Kaspa mint allowance of 500 000 USDT and a release allowance of
250 000 USDT per vault, each refilling fully in 24 hours. Because an allowance is a bucket that can be emptied and
then refills, up to twice its ceiling can move in any 24-hour window.

## Summary

| Compromised | Kaspa side | EVM side (each vault) |
|---|---|---|
| 1 or 2 signers | Nothing | Nothing |
| 3 signers (a bad quorum) | Mint unbacked kUSDT within the allowance, while not paused | Pay out without burns, within the release allowance, while not paused |
| 4 or 5 signers | Raise the mint allowance, so only the remaining hard cap bounds minting; unpause; replace the signers and the minter's guardian, so that the minter can no longer be paused | Same as 3: the vault's allowance and signer set belong to the owner, and the vaults' and the pool's guardians are not theirs to change |
| Guardian key | Pause the minter and the pool | Pause the vault |
| Coordinator | Stall | Stall |
| Monitor | Pause, or fail to pause | Pause, or fail to pause |
| Vault owner | Nothing | After its 48-hour delay, unless a canceller cancels it: replace the signers and raise limits within the hard bounds |
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
| 3 of 5 signer keys mint unbacked kUSDT | The mint allowance: 500 000 at once, at most 1 000 000 in any 24 hours. The monitor pauses within seconds | Tested: the 400 000 forged mint in `local:e2e` |
| 3 of 5 signer keys pay out without burns | Each vault's release allowance: 250 000 at once. The monitor raises `release-without-burn` as soon as its Kaspa view has caught up and pauses, so about 250 000 per vault can leave | Bounded |
| A burn reorganized away after its payout | Finality on Kaspa, deeper for larger burns: 1 000 DAA, 6 000 above 10 000 kUSDT, 36 000 above 100 000 | Fixed 5 November 2026 (the tiers) |
| A compromised vault owner queues new signers or limits | Every owner change waits 48 hours in the AccessManager; the monitor alarms when it is queued, and a canceller (or the monitor itself) cancels it | Bounded (5 November 2026) |
| 4 of 5 signer keys | They can raise the Kaspa limits and unpause the minter. The vaults' limits and signers belong to the owner (an AccessManager under a Safe on mainnet, 48-hour delays) | Bounded on the vaults; the monitor is the defence on Kaspa |
| A stolen guardian key | It can only pause: griefing | By design |
| A lying coordinator or API | It can stall or censor, nothing more. Wallets check token states against their own node and pin the deployment; signers re-check everything | By design |
| Fake deposits or burns fed to a signer through its RPC or node | It takes 3 operators' nodes. Every RPC a signer uses must agree on every field of a deposit (its sender, which a refund pays, included) and of every release and refund. Today all 5 testnet signers run on one machine | Open until there are 5 independent operators; the full agreement fixed 5 November 2026 |
| A wrong redemption report sent first, to strand someone's burn | Claims are checked against the coordinator's node, which decides; a client's transaction cannot edit the token index | Fixed 5 November 2026 |
| An RPC outage switching the monitor off | Each chain is checked on its own, INV-1 is never judged on partial backing, and a chain unreadable for 10 minutes pauses everything | Fixed 5 November 2026 |
| Reorgs | Finality on both sides; the follower goes back to the fork point if Kaspa's chain moves anyway. A signer also undoes the minter moves the dropped blocks accepted, and signs no refund unless the minter it follows is on its node, so a skip the new chain replaced with a mint can't be paid as a refund | Fixed 4 November 2026 (the follower rewind) and 6 November 2026 (undoing the moves, from an outside review) |
| Replay across chains, vaults or deployments | The EIP-712 domain, the covenant ID in the digests, each `redeemId` paid once | Tested |
| Decoy outputs fooling the followers | Successors come only from covenant-bound authorized outputs | Fixed in the security review, with tests |
| Tether blacklists a recipient or a vault | Nothing is paid to a blocked address; a blocked vault pauses everything | Fixed 4 November 2026 ([Blocked recipients](/security/known-limits/#blocked-recipients)) |
| Big legitimate flows that use up the allowances | Liveness only: the bridge waits for the refill. It costs the attacker 0.2 % each way | Bounded |

### Swap

| Attack | What stops it | Status |
|---|---|---|
| Forged kUSDT dumped into the pool | The biggest one. A forged mint and a sell can land in the same block, so no monitor can stop it. The pool's **circuit breaker** stops it on-chain: sells take at most 10 % of the KAS reserve per hour ([KasPool](/contracts/kaspool/#the-circuit-breaker)). The monitor then pauses the pool with everything else: swaps and new liquidity stop, withdrawals stay open, and only the pool admin resumes | Fixed 4 November 2026. Tested: in `local:e2e`, 400 000 forged kUSDT get under 10 % of the pool's KAS |
| Sandwiching | A swap spends the exact pool state it was quoted on, so a front-run makes it fail, never fill worse. But the wallet used to re-quote by itself within your slippage, so a bot could take up to that slippage. Now the wallet asks before a worse price: it goes ahead on its own only when a new quote is at least as good as the one you confirmed | By design on-chain; fixed in the wallet 4 November 2026, with tests |
| Inflating the first depositor's shares | 1 000 shares are locked at `init` and can never be withdrawn | By design |
| Rounding and overflow | Exact 128-bit products and bounds on every input | Tested; needs the audit |
| Swap spam | Griefing only: each swap pays the network fee and 0.30 % | Bounded |
| Round trips that use up the hour's sell room | The breaker counts the net flow, so a buy gives the room back | Fixed 5 November 2026 |
| Price manipulation | Nothing reads the pool price as an oracle | By design |
| A stolen pool admin key | It can take the accrued fees, unpause and hand the keys over. It cannot touch the reserves or a position | Bounded |

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
   With 3 stolen keys, today's limits risk about 500 000 USDT from the vaults, plus at most about 10 % of the
   pool's KAS.

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
| Kaspa | Mint kUSDT that no deposit backs, up to the mint allowance: 500 000 USDT at once, at most 1 000 000 USDT in any 24 hours | Exceed the allowance or the hard cap; unpause the minter; change the limits, the signers or the guardian (all of these need 4) |
| Each vault | Sign releases and refunds that no burn or skip justifies, up to the release allowance: 250 000 USDT at once, at most 500 000 USDT in any 24 hours | Exceed the allowance; change any vault parameter; unpause a paused vault |

Unbacked mints or releases make kUSDT in circulation exceed the backing. The monitor checks this (INV-1) and the
guardian pauses the vaults and the minter. A bad quorum of 3 cannot undo that pause on either side: unpausing
BridgeMint takes 4 signers, and unpausing a vault takes the owner. The owner then replaces the vault signers with
`setSigners`.

Unbacked kUSDT also harms holders and the pool. Sold into KasPool, it takes KAS from the pool's liquidity
providers. The pool's circuit breaker lets sells take at most 10 % of the KAS reserve per hour, and the guardian
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
| The monitor | Raises `inv1`; within seconds, both vaults, the minter and the pool are paused |
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
- set fees up to 1 % and minimum fees up to 50 USDT;
- withdraw accrued fees.

It cannot withdraw backing directly, and every change becomes public 48 hours before it takes effect (`setGuardian`
and `unpause`: about 6 hours). The monitor alarms the moment a change it was not told about is queued, pauses the
vaults, and can cancel it with a canceller key; the cancellers are parties other than the Safe's holders. A rogue
canceller can only cancel, and the Safe can revoke it (that too waits 48 hours, and cancellers cannot cancel it).
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
| Burn state with a non-zero borrow scheme, borrow guard or extension commitment | Never paid; the kUSDT is lost |
| Deposit naming a wrong Kaspa owner | Minted to that owner |
| Accept a token that only claims to be kUSDT | Check the covenant ID |
