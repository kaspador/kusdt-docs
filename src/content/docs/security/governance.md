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
| `set_value` | 3 of 5 | Change the minter's own KAS deposit |
| `unpause` | 4 of 5 | Resume minting. It takes 4 so that a bad minting quorum of 3 cannot undo the guardian's pause |
| `set_limits` | 4 of 5 | New allowance ceiling and refill rate. The allowance is settled at the old rate first, then lowered to the new ceiling if above it |
| `set_signers` | 4 of 5 | New signer set and guardian, effective immediately |
| `skip_nonce` | 4 of 5 | Move one chain past its current nonce. The vault then refunds that deposit to its depositor, exactly what it minted, once 3 signers see the skip final on their own nodes (see [Refunds](/protocol/refunds/)) |

Nothing can raise the hard cap. `pause` needs only the guardian.

## KusdtVault (EVM): the owner

Each vault has an **owner**. On mainnet the owner is an OpenZeppelin `AccessManager` (5.1.0, unmodified) whose only
admin is the project Safe; the vault itself is unchanged. Every owner call goes through the manager: the Safe
schedules it, waits its delay, then executes it within a week. Calling the vault directly reverts.

| Role | Held by | Delay | What it may call |
|---|---|---|---|
| ADMIN | The Safe only | 48 hours | The manager itself: roles, delays, guardians, which role may call what |
| GOVERNOR | The Safe | 48 hours | `setFees`, `setDepositLimits`, `setReleaseLimits`, `setSigners`, `withdrawFees`, `transferOwnership` |
| EMERGENCY | The Safe | 6 hours by default (1 to 48) | `setGuardian`, `unpause`: a stolen guardian key costs hours, not days |
| PAUSER | The Safe | None | `pause`. The guardian still pauses on its own |
| CANCELLER | Independent cancellers | | Cancel any scheduled GOVERNOR or EMERGENCY call |

**One honest canceller stops a bad proposal.** The cancellers are parties other than the Safe's holders, and the
monitor can hold a canceller key too, cancelling every queued call nobody announced. A canceller can only cancel:
a rogue one can hold up vault calls, an emergency unpause included, until the Safe revokes it, which takes 48 hours
and which no canceller can cancel.

**The Safe's admin calls can be seen, not cancelled.** A compromised Safe could schedule a change to the manager
itself, for example a new GOVERNOR with no delay, and use it 48 hours later. Every monitor alarms the moment such a
call is queued (`owner-op-unannounced`) and pauses everything; those 48 hours are for the people behind the Safe to
act. Lowering a delay costs the difference again on top of the 48-hour admin delay (OpenZeppelin's setback):
taking GOVERNOR from 48 hours to none takes 96 hours in all.

The deployer builds the manager, gives it its roles and renounces every role of its own in the launch
(`npm run mainnet:execute`), and `npm run mainnet:verify` checks all of it on-chain against the reviewed plan: the
manager's code is OpenZeppelin's byte for byte, every role's members and delays, every function's role, and that no
one else holds a role. Testnet vaults are owned by the deployer's plain key.

| Function | Bounds |
|---|---|
| `setFees(feeBps, minDepositFee, minReleaseFee)` | `feeBps ≤ 100`; each minimum ≤ 50 USDT |
| `setDepositLimits(min, max)` | `0 < min ≤ max ≤ 10¹⁵` units |
| `setReleaseLimits(capacity, refillPerSecond)` | `capacity ≤ 10¹⁵`; a full refill takes at least a day; the allowance earned so far is kept, capped at the new capacity |
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
(`unpause`), and hand the admin key, the guardian key or both to other keys (`set_keys`). It cannot touch the
reserves or any position. The circuit breaker's values are fixed at genesis, so no key can change them. Before
mainnet, the operator holds the admin key offline.

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
change its own code. A code change means a new deployment, with a new covenant ID or new vault addresses.
