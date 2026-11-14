---
title: Governance
description: Who can change what in kUSDT, with which quorum, and within which bounds.
---

kUSDT has three governed parts. Each has its own rules, and none of them can move user funds outside the
protocol's paths.

## BridgeMint (Kaspa): the signers

BridgeMint is governed by the signers themselves, through one `govern` entry. Each action is signed over the govern
digest, which includes the current `admin_nonce`, so every message is single-use.

| Action | Quorum | Effect |
|---|---|---|
| `set_value` | 4 of 5 | Change the minter's own KAS deposit |
| `unpause` | 4 of 5 | Resume minting, on a paused minter only. It takes 4 so that a bad minting quorum of 3 cannot undo the guardian's pause |
| `set_limits` | 4 of 5 | New allowance ceiling and refill rate, each at most 10¹⁵ units (the lifetime cap). The allowance is settled at the old rate first, then lowered to the new ceiling if above it |
| `set_signers` | 4 of 5 | New signer set and guardian, effective immediately |
| `propose_recovery` | 3 of 5 | Propose a new signer set and guardian, for when two keys are lost for good. See [Recovery](#recovery-when-two-keys-are-lost) |
| `veto_recovery` | any 1 of 5 | Cancel a proposed recovery |
| `skip_nonce` | 4 of 5 | Move one chain past its current nonce. The vault then refunds that deposit to its depositor, exactly what it minted, once 3 signers see the skip final on their own nodes (see [Refunds](/protocol/refunds/)) |

Nothing can raise the hard cap. `pause` needs only the guardian.

**A pause voids what was signed before it.** A pause moves `admin_nonce` forward by one, so every 4-of-5 signature
made before it stops counting. A governance signature has no expiry of its own: without this rule, an `unpause`
that four signers signed once and never sent could be used after a later pause by anyone holding it and three keys.
After a pause the signers sign again, with the new nonce, and the monitors are told the new line.

**A governance action signs its age.** Each one claims an age of the minter's UTXO, and the mint allowance refills
by that age. The signers sign the age (since rc.16), so a copy of the action sent with another age is not valid.
The other side of that: the action can be sent only once the UTXO is that old, and a mint that lands first makes a
new UTXO at age zero. So the signers agree the age before they sign, and sign an urgent action for age 0, which is
always valid and credits no refill. What is then not credited is a delay only, and a
[known limit](/security/known-limits/#a-governance-action-credits-the-mint-allowance-only-up-to-the-age-its-signers-signed).

### Recovery when two keys are lost

Every action above but the recovery needs 4 of 5. Two signers losing their keys for good would mean a minter pause could never
be lifted and the lost signers never replaced, and the covenant can't be upgraded. So three signers can propose a new signer set
and guardian. Anyone can carry it out once the minter has stood untouched for 72 hours, which consensus enforces, and any single
signer can veto it until then. A mint restarts the wait.

This is a trade-off: three stolen keys can attempt to replace the signers, and an honest signer has 72 hours to stop them. Every
monitor raises an alarm on a proposal the operators didn't announce.

A proposal and a veto spend the minter coin, and an unpause is signed for one coin (the paused one). So while a proposal
stands, any one signer's veto voids an unpause the four have signed, and they sign it again: a delay of one round of
signing, nothing minted or lost. With a proposal standing, veto it or let it be carried out first, then sign the unpause.

## KusdtVault (EVM): the owner

Each vault has an **owner**. On mainnet the owner is `KusdtAccessManager`, OpenZeppelin's `AccessManager` (5.1.0) with
`renounceRole` closed, so nobody can give up a role at once, and `revokeCanceller` added (below). Its only
admin is the project Safe; the vault itself is unchanged. Every owner call goes through the manager: the Safe
schedules it, waits its delay, then executes it within a week. Calling the vault directly reverts.

| Role | Held by | Delay | What it may call |
|---|---|---|---|
| ADMIN | The Safe only | 48 hours | The manager itself: roles, delays, guardians, which role may call what |
| GOVERNOR | The Safe | 48 hours | `setFees`, `setDepositSurge`, `setDepositLimits`, `setReleaseLimits`, `reinstateRelease`, `reinstateRefund`, `setPayoutDelay`, `setSigners`, `withdrawFees`, `transferOwnership` |
| EMERGENCY | The Safe | 6 hours by default (1 to 48) | `setGuardian`, `unpause`, `cancelRelease`, `cancelRefund`: a stolen guardian key costs hours, not days |
| PAUSER | The Safe | None | `pause`. The guardian still pauses on its own |
| CANCELLER | Independent cancellers | | Cancel any scheduled GOVERNOR or EMERGENCY call, and the Safe's scheduled power-adding calls and revocations on the manager itself |
| GUARDED | Nobody | | Nothing. The manager's own power-adding functions and `revokeRole` are mapped to it, so that the cancellers can cancel them |

**One honest canceller stops a bad proposal.** The cancellers are parties other than the Safe's holders, and the
monitor can hold a canceller key too, cancelling every queued call nobody announced. A canceller can only cancel:
a rogue one can hold up vault calls, an emergency unpause included, until the Safe removes it, which takes 48 hours
and which no canceller can cancel. A canceller who acts by hand needs the queued call's caller, target and whole
calldata for `cancel`: `kusdt cancel-op` reads them from the transaction that queued it (through every RPC given)
or takes them as a block explorer shows the event, and prints the cancel for the canceller's own wallet, with the
operation's ID to compare with the alarm's (since run 20).

**The cancellers can also cancel the Safe's power-adding calls on the manager** (since rc.16). A compromised Safe
could schedule a change to the manager itself, for example a new GOVERNOR with no delay, and use it 48 hours later.
Before, such a call could be seen but not cancelled. Now the manager's functions that add power (`grantRole`,
`setRoleAdmin`, `setRoleGuardian`, `setGrantDelay`, `setTargetAdminDelay`, `setTargetFunctionRole`,
`setTargetClosed`, `updateAuthority`) are mapped to GUARDED, a role nobody holds, whose guardian is CANCELLER. That
changes who may cancel them, not who may call them: only the Safe calls them, with its 48 hours, and any one
canceller can cancel one while it waits.

**Removing a canceller is deliberately not cancellable, and it is the only revocation that isn't.** If it were, one
rogue canceller could cancel its own removal for ever. So a canceller is removed through a function of its own,
`revokeCanceller`, which removes cancellers only and stays outside GUARDED: the Safe's 48 hours, and only the Safe
can cancel it. Every other revocation goes through `revokeRole`, which is mapped to GUARDED like the power-adding
calls (since round 11). Before, `revokeRole` was left outside, and that covered the Safe's own roles: stolen Safe
keys could pause a vault and schedule the removal of every role the Safe holds, and 48 hours later nobody could
ever unpause it, with no canceller able to stop that.

The result: whoever holds the Safe can add power or strip the Safe's roles only once no canceller cancels it. It
must remove every canceller, which takes 48 hours in plain sight and which no canceller can stop, or outlast them.
Every monitor alarms the moment such a call is queued (`owner-op-unannounced`) and pauses everything. The removals
of the cancellers are the signal for the people behind the Safe to act.

What that buys, in figures (corrected in round 12; `bridge/evm/test/safe-compromise-times.test.ts`):

- **A freeze takes one transaction, not 96 hours.** The Safe holds PAUSER with no delay, and whoever scheduled an
  operation may cancel it, so a holder of the Safe's keys pauses a vault at once and cancels every unpause the
  owners schedule through the same Safe. The vault stays paused for as long as they hold the keys. If they replace
  the Safe's owners (one Safe transaction, with no delay, that the AccessManager never sees) the honest owners are
  out and it stays paused for good. No guardian and no canceller can unpause. What the cancellers stop is only the
  last step, taking the Safe's own roles away so that the freeze outlasts the keys.
- **A theft takes 48 hours from the cancellers' last cancel.** The removals of the cancellers and the power-adding
  call can be scheduled in the same minute, and a cancelled call can be scheduled again in the next block. It is
  96 hours only when a canceller cancels every re-schedule right up to its own removal at hour 48. With one cancel
  at hour 1 the signers are replaced at hour 49.
- **So the cancellers' job does not end with one cancel.** Each cancels every re-schedule, and cancels everything
  still pending just before its own removal can run. The Safe can queue many operations in one transaction and each
  cancel is a transaction of the canceller's, so a canceller needs gas for many cancels, or a monitor holds a
  canceller key (`cancellerEvmSecretPath`) and cancels by itself.

It is a delay, not a stop. If nobody acts in that time, stolen Safe keys still win, and the pause they can set at
any moment gives users no way out in the meantime. No service watches the Safe's own owner list yet (the Safe's
`AddedOwner`, `RemovedOwner` and `ChangedThreshold` events): `mainnet:verify` compares the owners and the
threshold with the plan's when it is run, and fails a mainnet Safe whose threshold is below 2, which the plan
refuses too (since run 20), and the Safe's holders watch their Safe. A freeze by the Safe could only
be made slower by giving PAUSER or EMERGENCY to other keys than ADMIN's, which v1 does not do.

One delay grew with the cancellers' say: when a rogue canceller and a role that has to be revoked come together,
the Safe needs 48 hours to remove the canceller and 48 more for the revocation.

What a canceller still cannot do: call anything, schedule anything, or stop its own removal. What a rogue
canceller can do is delay, as above.

The deployer builds the manager, gives it its roles and gives up every role of its own in the launch
(`npm run mainnet:execute`), and `npm run mainnet:verify` checks all of it on-chain against the reviewed plan: the
manager's code is the build's byte for byte, the Safe is a genuine one with no modules or guard, every role's members and delays, every function's role, that the
manager's eight power-adding functions and `revokeRole` are mapped to GUARDED and `revokeCanceller` is not, and that no
one else holds a role. Testnet vaults are owned by the deployer's plain key.

| Function | Bounds |
|---|---|
| `setFees(feeBps, minDepositFee, minReleaseFee)` | `feeBps ≤ 100`; each minimum ≤ 50 USDT |
| `setDepositSurge(surgeFeeBps, capacity)` | The [rising deposit fee](/protocol/fees/#the-rising-deposit-fee): `surgeFeeBps ≤ 300` (3 %); a meter of 0 (off) or 2 units to 10¹⁵ |
| `setDepositLimits(min, max)` | `0 < min ≤ max ≤ 10¹⁵` units |
| `setReleaseLimits(capacity, refillPerSecond)` | `capacity ≤ 10¹⁵`; a full refill takes at least a day; the allowance earned so far is kept, capped at the new capacity |
| `setPayoutDelay(seconds)` | 5 minutes to 24 hours; payouts already queued keep their time. Lower each monitor's `failClosedMs` to at most half the new wait first: a mainnet monitor refuses to start on an announced wait it does not fit (RUNBOOK, "Changing the payout wait") |
| `cancelRelease(redeemId)`, `cancelRefund(nonce)` | A payout still queued. Its allowance comes back, and it stays cancelled: the vault refuses to queue it again, whatever signatures come with it, until the owner reinstates it |
| `reinstateRelease(redeemId)`, `reinstateRefund(nonce)` | A cancelled payout. It can then be queued again with signatures of the current signers. A GOVERNOR call, so it waits 48 hours and the cancellers can cancel it |
| `setSigners(address[5])` | 5 distinct, non-zero addresses; effective immediately |
| `setGuardian(address)` | Non-zero |
| `unpause()` | |
| `withdrawFees(to, units)` | `units ≤ feesAccrued`; never touches the backing |
| `transferOwnership`, then `acceptOwnership` | Two steps; a pending transfer can be replaced or cancelled |
| `pause()` | The guardian or the owner |
| `renounceOwnership` | Always reverts |

The owner cannot move backing. Only `release` and `refund`, with 3 signer signatures, reduce it.

## KasPool: the admin key

The pool's `admin` key can collect the protocol's accrued fees (`collect`), resume a pool the guardian paused
(`unpause`), and hand the admin key, the guardian key or both to other keys (`set_keys`). Only its signature opens
the pool: the first deposit (`init`), and the first deposit into a pool that every provider has left, need it, so
nobody can open or reopen the pool with dust. It cannot touch the reserves or any position. The circuit breaker's values are fixed at genesis, so no key can change them. Before
mainnet, the operator holds the admin key offline. Stolen, it can still hold every pool transaction up, withdrawals
included, for a fee a spend ([known limits](/security/known-limits/#a-stolen-pool-admin-key-can-hold-the-pool-up)).

## Keeping the signer sets in step

The same five signers act on three contracts, and each contract has its own copy of the signer set:

| Contract | Holds | Changed by |
|---|---|---|
| BridgeMint | Hash of the five Schnorr keys | 4 of the 5 current signers |
| Vault on Ethereum | Five EVM addresses | That vault's owner |
| Vault on BNB Chain | Five EVM addresses | That vault's owner |

A signer rotation therefore takes three changes: one on Kaspa, signed by 4 signers, and one per vault, made by the
owner.

## No upgrades

Neither the vault nor the covenants have an upgrade path. The vault is not a proxy, and no covenant entry can
change its own code. A code change means a new deployment: **a new covenant ID and new vault addresses, always
both**. A vault is never replaced under a live kUSDT, and a kUSDT never over live vaults. Nothing in a burn names
the vault that pays it and nothing in a deposit names the covenant that mints it, so a new vault under the old
kUSDT would pay every earlier burn again, and a new kUSDT over the old vaults would mint every earlier deposit
again (this page said "or" until round 12). Holders move to a new deployment by redeeming out of the old one. The
pool is different: it is a covenant of its own that holds no bridge backing, and a new pool under the same kUSDT
is an ordinary step.
