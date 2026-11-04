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

Each vault has an **owner**. On mainnet it must be a Safe behind a 48-hour timelock; the deploy script refuses a
mainnet owner that is not a contract.

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
