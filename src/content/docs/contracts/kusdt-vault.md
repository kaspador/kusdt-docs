---
title: KusdtVault
description: The EVM vault on Ethereum and BNB Chain that holds the USDT backing kUSDT.
---

`KusdtVault` (`bridge/evm/contracts/KusdtVault.sol`, Solidity 0.8.24) holds the USDT that backs kUSDT. There is
one vault per EVM chain. It builds on OpenZeppelin 5.1.0: `Ownable2Step`, `Pausable`, `ReentrancyGuard`,
`EIP712`, `ECDSA` and `SafeERC20`.

## Units and scale

All amounts are **units** of 10⁻⁶ USDT. The token moves `units × scale`, with `scale = 10^(decimals − 6)`:

| Chain | Token decimals | `scale` |
|---|---|---|
| Ethereum (USDT) | 6 | 1 |
| BNB Chain (BSC-USD) | 18 | 10¹² |

The constructor accepts 6 to 18 decimals and checks them against the token's own `decimals()` when it has one.

## Functions

| Function | Who | Does |
|---|---|---|
| `deposit(units, ownerScheme, owner)` | Anyone | Locks USDT for kUSDT. See [Deposits and mints](/protocol/deposits-and-mints/) |
| `depositAtLeast(units, ownerScheme, owner, minMinted)` | Anyone | The same deposit, which reverts and takes nothing unless at least `minMinted` is minted. The deposit fee can rise with the deposits made just before, and this bounds what the depositor accepts. The web app and the wallet use it |
| `release(Release, signatures)` | Anyone, with 3 signer signatures | Queues the payout of a Kaspa burn and draws its whole `units`, fee included, from the release allowance. See [Redemptions and releases](/protocol/redemptions-and-releases/) |
| `refund(Refund, signatures)` | Anyone, with 3 signer signatures | Queues the return of a skipped deposit. See [Refunds](/protocol/refunds/) |
| `executeRelease(redeemId)`, `executeRefund(nonce)` | Anyone | Pays a queued payout once its wait is over. Not while paused |
| `setPayoutDelay(seconds)` | Owner | 5 minutes to 24 hours. Payouts already queued keep their time |
| `cancelRelease(redeemId)`, `cancelRefund(nonce)` | Owner | Clears a queued payout, returns its allowance, and leaves it cancelled: `release` and `refund` refuse it, whatever signatures come with it, until the owner reinstates it. Cancel before unpausing |
| `reinstateRelease(redeemId)`, `reinstateRefund(nonce)` | Owner | Lets a cancelled payout be queued again, with signatures of the current signers. It queues nothing itself. On mainnet it waits 48 hours |
| `setFees`, `setDepositLimits`, `setReleaseLimits` | Owner | Within the hard bounds below |
| `setDepositSurge(surgeFeeBps, capacity)` | Owner | The rising deposit fee: the rate at a full deposit meter and the meter's size in units a day; 0 and 0 for a flat fee. The meter keeps what it holds, up to the new size |
| `setSigners(address[5])` | Owner | Replaces all 5 signers: distinct, none zero. Old signatures stop counting at once |
| `setGuardian` | Owner | Not the zero address |
| `withdrawFees(to, units)` | Owner | At most `feesAccrued`; never touches the backing |
| `pause` | Guardian or owner | Stops deposits, releases, refunds and the paying of queued payouts |
| `unpause` | Owner | Starts a full wait again for everything queued (`payoutsResumeAt`) |
| `transferOwnership`, `acceptOwnership` | Owner, then the new owner | Two-step transfer |
| `renounceOwnership` | Nobody | Disabled: without an owner the vault could never be unpaused |

While paused, admin functions keep working, so a fix can be made before unpausing.

## The deposit fee

The fee of a deposit rises with the deposits of the last day on that vault. The vault keeps a meter
(`depositMeter`, read with `depositMeterNow()`): each deposit adds its `units`, the meter drains at `surgeCapacity`
per day, and it is kept at `surgeCapacity` at most. A unit pays `feeBps` while the meter is under half of
`surgeCapacity`, a rate on a straight line from `feeBps` to `surgeFeeBps` between half and full, and `surgeFeeBps`
at a full meter. A deposit pays each of its units at the rate where the meter stands as that unit goes in, so
splitting a deposit changes nothing. The sum is rounded up, and `minDepositFee` is the least.
`depositFeeOf(units)` answers what a deposit would pay in the current block. With `surgeCapacity` 0, or a
`surgeFeeBps` not above `feeBps`, the fee is the flat one. Both values are constructor arguments, and the owner
changes them with `setDepositSurge`. Numbers and examples are on [Fees](/protocol/fees/#the-rising-deposit-fee).

A release's fee is always the flat one (`releaseFeeOf`).

## Cancelled payouts

`cancelRelease` and `cancelRefund` take a payout out of the queue: nothing is paid, its allowance comes back, and
the `redeemId` or the nonce is marked cancelled (`releaseCancelled`, `refundCancelled`). From then on `release` or
`refund` reverts with `PayoutCancelled` for it, with any signatures. Until rc.16 a cancelled payout could be
queued again at once by anyone, with the signatures it was first queued with, as long as the signers had not been
replaced.

Only the owner clears the mark, with `reinstateRelease` or `reinstateRefund`. That pays nothing and queues
nothing: someone must call `release` or `refund` again with signatures of the current signers, and the payout
waits again. Cancel for a payout that should never be paid, and for one that must wait (a recipient the token
blocked during the wait); reinstate when it should be paid after all. The mark is on the id, not the payout:
when a forged payout named a real burn's `redeemId` or a real skip's nonce, its cancel bars the honest payout of
that id too, and the id is reinstated once the signers have been replaced (round 16, R16-ONCE-2).

## Hard bounds

These are constants in the contract. No owner action can go beyond them.

| Constant | Value | Meaning |
|---|---|---|
| `SIGNER_COUNT` | 5 | Exactly five signers |
| `THRESHOLD` | 3 | Signatures needed by release and refund |
| `MAX_OWNER_SCHEME` | 4 | Highest KCC-2 owner scheme a deposit may name |
| `MAX_FEE_BPS` | 100 | The proportional fee (`feeBps`) never exceeds 1 % |
| `MAX_SURGE_FEE_BPS` | 300 | The deposit fee at a full deposit meter never exceeds 3 % |
| `SURGE_PERIOD` | 1 day | The deposit meter empties over this long |
| `MIN_PAYOUT_DELAY`, `MAX_PAYOUT_DELAY` | 5 minutes, 1 day | The bounds of `setPayoutDelay` |
| `MAX_MIN_FEE` | 50 000 000 | Neither minimum fee exceeds 50 USDT |
| `MAX_AMOUNT` | 10¹⁵ | No deposit limit, release capacity or deposit meter above 1 billion USDT, the Kaspa hard cap |
| `MIN_REFILL_PERIOD` | 1 day | `releaseRefillPerSecond ≤ releaseCapacity / 86 400` |

## Accounting

```text
token.balanceOf(vault) / scale = backing() + feesAccrued
```

- Deposit fees and release fees go to `feesAccrued`. Only the owner withdraws them.
- Only `release` and `refund` reduce the backing, and both need the signer quorum.
- Tokens sent straight to the vault count as backing, not fees.
- `backing()` is what invariant INV-1 compares with kUSDT in circulation. If the token itself ever took funds
  from the vault, `backing()` reports 0 rather than underflowing, and the monitor would flag INV-1.

## Defenses

| Risk | Defense |
|---|---|
| Ethereum USDT returns no value from `transfer` | `SafeERC20` |
| Fee-on-transfer tokens | `deposit` reverts unless the balance grew by exactly `units × scale` |
| Reentrancy from a token hook | `nonReentrant` on `deposit`, `release`, `refund`, `executeRelease`, `executeRefund` and `withdrawFees` |
| Duplicate or reordered signatures | Recovered addresses must be strictly increasing |
| Malleable signatures | OpenZeppelin `ECDSA.recover` rejects high-s and malformed signatures |
| Cross-chain or cross-vault replay | The EIP-712 domain includes `chainId` and the vault address |
| Release replay | `redeemed[redeemId]` |
| A cancelled payout queued again with its old signatures | `releaseCancelled`, `refundCancelled`: refused until the owner reinstates it |
| A fee that rose between the quote and the deposit | `depositAtLeast` reverts unless the stated minimum is minted |
| Refund replay or wrong amount | `depositMinted[nonce]` must equal `units`, and is cleared on refund |
| Paying out of fees | `units ≤ backing()` |
| Paying to nowhere | The recipient may not be the zero address, the vault or the token contract |
| Sudden limit increase | `setReleaseLimits` keeps the allowance earned so far, capped at the new capacity |

## Views for services

`signers()`, `isSigner`, `guardian`, `owner`, `params()`, `feeBps`, `minDepositFee`, `minReleaseFee`,
`minDeposit`, `maxDeposit`, `releaseCapacity`, `releaseRefillPerSecond`, `releaseAvailable()`, `depositNonce`,
`depositMinted(nonce)`, `isRefunded(nonce)`, `redeemed(redeemId)`, `feesAccrued`, `backing()`, `unreservedBacking()`,
`reservedUnits`, `payoutDelay`, `payoutsResumeAt`, `pendingReleases(redeemId)`, `pendingRefunds(nonce)`,
`releaseCancelled(redeemId)`, `refundCancelled(nonce)`, `surgeFeeBps`, `surgeCapacity`, `depositMeter`,
`depositMeterAt`, `depositMeterNow()`, `depositFeeOf`, `releaseFeeOf`, `domainSeparator()`, `releaseDigest`, `refundDigest`, `redeemIdOf`, `scale`, `tokenDecimals`.

## Default parameters

| Parameter | Ethereum | BNB Chain |
|---|---|---|
| `feeBps` | 50 (0.50 %) | 50 |
| `minDepositFee` | 500 000 (0.50 USDT) | 500 000 |
| `minReleaseFee` | 5 000 000 (5 USDT) | 500 000 (0.50 USDT) |
| `minDeposit` / `maxDeposit` | 10 000 000 / 100 000 000 000 (10 / 100 000 USDT) | same |
| `releaseCapacity` | 250 000 000 000 (250 000 USDT) | same |
| `releaseRefillPerSecond` | 2 893 518 (capacity / 86 400, rounded down) | same |
| `surgeFeeBps` | 250 (2.50 %) | same |
| `surgeCapacity` | A quarter of the signers' agreed daily limit: 12 500 000 000 (12 500 USDT) at the launch | same |

## Gas

Measured in Hardhat with mock tokens. Ethereum USDT's own transfer costs a little more.

| Call | Gas |
|---|---|
| `deposit` | about 90 000 (124 000 for a vault's very first) |
| `release`, 3 signatures | about 119 000 (137 000 when the recipient had no balance) |
| `release`, 5 signatures | about 135 000 |
| `refund` | about 109 000 |

## Tests

209 Hardhat tests (`bridge/evm/test/`), among them:

| File | Covers |
|---|---|
| `deposit.test.ts` | Fee math against a reference model; rounding; 6- and 18-decimal scaling; limits; owner schemes 0 to 4; nonces and the exact event; Tether-style and fee-on-transfer tokens; reentry |
| `release.test.ts` | The exact EIP-712 domain, types and redeem ID; any 3, 4 or 5 of 5 signers; too few, duplicate, out-of-order, non-signer, guardian, owner and recipient signatures rejected; binding to chain ID, vault, name, version, recipient, amount and redeem ID; no Refund-as-Release type confusion; malleable signatures; replay; fees; backing; reentry; the allowance and its refill; anyone may submit |
| `refund.test.ts` | Exact minted amount, once; nonce bounds; quorum; shared allowance; pause; recipients; cannot pay out of fees |
| `admin.test.ts` | Constructor checks; every setter's bounds, events and owner-only access; signer rotation; pause roles; the guardian can do nothing else; fee withdrawal never touches backing; no function takes backing; two-step ownership; renounce disabled |
| `invariant.test.ts` | Seeded random sequences of deposits, releases, refunds, fee withdrawals and time jumps, at 6 and 18 decimals. After every step: balance = backing + fees, no dust, the fee and backing models match, the modelled circulation stays at or below the backing (INV-1), and the allowance stays within its capacity |
| `gas.test.ts` | Gas for deposit, release and refund |
| `access-manager.test.ts` | The vault owned by an AccessManager: the setup, GOVERNOR's 48 h, EMERGENCY and PAUSER, what cancellers can and cannot cancel, everyone else refused, and changes to the rules taking ADMIN's 48 h. Since rc.16: every power-adding call on the manager cancelled by a canceller and by no outsider, calling rights unchanged, a stolen Safe needing 96 hours while the cancellers cancel every try, and a rogue canceller unable to stop its own removal |
| `revoke-guard.test.ts` | Round 11: the Safe's own roles scheduled for removal under a paused vault are cancelled by a canceller; `revokeRole` is mapped to GUARDED and `revokeCanceller` to nothing; a canceller can't cancel its own removal and can't lock the Safe out; only the Safe calls `revokeCanceller`, which removes cancellers only; a freeze that outlasts the Safe's keys takes 96 hours while the cancellers cancel |
| `safe-compromise-times.test.ts` | Round 12: the real figures for stolen Safe keys. A freeze is one transaction (the Safe pauses with no delay and cancels every unpause it scheduled); a theft takes 48 hours from the cancellers' last cancel, and 96 only when they cancel every re-schedule until they are removed; one Safe transaction queues many operations, each cancelled on its own |
| `surge.test.ts` | The rising deposit fee: the formula against a unit-by-unit sum, every deposit against the formula at its block, the meter's drain and its ceiling, `setDepositSurge` and its bounds, `depositAtLeast` |
| `payout-delay.test.ts` | The wait, the pause within it, and cancelling: a cancelled payout is refused with its old signatures until the owner reinstates it |

## Deploying

`scripts/deploy.ts` reads a JSON config (`DEPLOY_CONFIG`) with environment overrides, and writes
`deployments/<network>.json`. On chain IDs 1 and 56 it refuses the mock token, requires the specification's USDT
address and decimals, requires the owner to be a contract (the AccessManager whose admin is the Safe), and asks for
`KUSDT_CONFIRM_MAINNET=deploy-to-<chainId>`. See `bridge/evm/README.md`.
