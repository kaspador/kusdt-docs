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
| `release(Release, signatures)` | Anyone, with 3 signer signatures | Queues the payout of a Kaspa burn. See [Redemptions and releases](/protocol/redemptions-and-releases/) |
| `refund(Refund, signatures)` | Anyone, with 3 signer signatures | Queues the return of a skipped deposit. See [Refunds](/protocol/refunds/) |
| `executeRelease(redeemId)`, `executeRefund(nonce)` | Anyone | Pays a queued payout once its wait is over. Not while paused |
| `setPayoutDelay(seconds)` | Owner | 5 minutes to 24 hours. Payouts already queued keep their time |
| `cancelRelease(redeemId)`, `cancelRefund(nonce)` | Owner | Clears a queued payout and returns its allowance. Replace the signers first, then cancel, then unpause |
| `setFees`, `setDepositLimits`, `setReleaseLimits` | Owner | Within the hard bounds below |
| `setSigners(address[5])` | Owner | Replaces all 5 signers: distinct, none zero. Old signatures stop counting at once |
| `setGuardian` | Owner | Not the zero address |
| `withdrawFees(to, units)` | Owner | At most `feesAccrued`; never touches the backing |
| `pause` | Guardian or owner | Stops deposits, releases, refunds and the paying of queued payouts |
| `unpause` | Owner | Starts a full wait again for everything queued (`payoutsResumeAt`) |
| `transferOwnership`, `acceptOwnership` | Owner, then the new owner | Two-step transfer |
| `renounceOwnership` | Nobody | Disabled: without an owner the vault could never be unpaused |

While paused, admin functions keep working, so a fix can be made before unpausing.

## Hard bounds

These are constants in the contract. No owner action can go beyond them.

| Constant | Value | Meaning |
|---|---|---|
| `SIGNER_COUNT` | 5 | Exactly five signers |
| `THRESHOLD` | 3 | Signatures needed by release and refund |
| `MAX_OWNER_SCHEME` | 4 | Highest KCC-2 owner scheme a deposit may name |
| `MAX_FEE_BPS` | 100 | The proportional fee never exceeds 1 % |
| `MAX_MIN_FEE` | 50 000 000 | Neither minimum fee exceeds 50 USDT |
| `MAX_AMOUNT` | 10¹⁵ | No deposit limit or release capacity above 1 billion USDT, the Kaspa hard cap |
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
| Refund replay or wrong amount | `depositMinted[nonce]` must equal `units`, and is cleared on refund |
| Paying out of fees | `units ≤ backing()` |
| Paying to nowhere | The recipient may not be the zero address or the vault |
| Sudden limit increase | `setReleaseLimits` keeps the allowance earned so far, capped at the new capacity |

## Views for services

`signers()`, `isSigner`, `guardian`, `owner`, `params()`, `feeBps`, `minDepositFee`, `minReleaseFee`,
`minDeposit`, `maxDeposit`, `releaseCapacity`, `releaseRefillPerSecond`, `releaseAvailable()`, `depositNonce`,
`depositMinted(nonce)`, `isRefunded(nonce)`, `redeemed(redeemId)`, `feesAccrued`, `backing()`, `unreservedBacking()`,
`reservedUnits`, `payoutDelay`, `payoutsResumeAt`, `pendingReleases(redeemId)`, `pendingRefunds(nonce)`, `depositFeeOf`,
`releaseFeeOf`, `domainSeparator()`, `releaseDigest`, `refundDigest`, `redeemIdOf`, `scale`, `tokenDecimals`.

## Default parameters

| Parameter | Ethereum | BNB Chain |
|---|---|---|
| `feeBps` | 20 (0.20 %) | 20 |
| `minDepositFee` | 500 000 (0.50 USDT) | 500 000 |
| `minReleaseFee` | 5 000 000 (5 USDT) | 500 000 (0.50 USDT) |
| `minDeposit` / `maxDeposit` | 10 000 000 / 100 000 000 000 (10 / 100 000 USDT) | same |
| `releaseCapacity` | 250 000 000 000 (250 000 USDT) | same |
| `releaseRefillPerSecond` | 2 893 518 (capacity / 86 400, rounded down) | same |

## Gas

Measured in Hardhat with mock tokens. Ethereum USDT's own transfer costs a little more.

| Call | Gas |
|---|---|
| `deposit` | about 90 000 (124 000 for a vault's very first) |
| `release`, 3 signatures | about 119 000 (137 000 when the recipient had no balance) |
| `release`, 5 signatures | about 135 000 |
| `refund` | about 109 000 |

## Tests

102 Hardhat tests (`bridge/evm/test/`):

| File | Covers |
|---|---|
| `deposit.test.ts` | Fee math against a reference model; rounding; 6- and 18-decimal scaling; limits; owner schemes 0 to 4; nonces and the exact event; Tether-style and fee-on-transfer tokens; reentry |
| `release.test.ts` | The exact EIP-712 domain, types and redeem ID; any 3, 4 or 5 of 5 signers; too few, duplicate, out-of-order, non-signer, guardian, owner and recipient signatures rejected; binding to chain ID, vault, name, version, recipient, amount and redeem ID; no Refund-as-Release type confusion; malleable signatures; replay; fees; backing; reentry; the allowance and its refill; anyone may submit |
| `refund.test.ts` | Exact minted amount, once; nonce bounds; quorum; shared allowance; pause; recipients; cannot pay out of fees |
| `admin.test.ts` | Constructor checks; every setter's bounds, events and owner-only access; signer rotation; pause roles; the guardian can do nothing else; fee withdrawal never touches backing; no function takes backing; two-step ownership; renounce disabled |
| `invariant.test.ts` | Seeded random sequences of deposits, releases, refunds, fee withdrawals and time jumps, at 6 and 18 decimals. After every step: balance = backing + fees, no dust, the fee and backing models match, the modelled circulation stays at or below the backing (INV-1), and the allowance stays within its capacity |
| `gas.test.ts` | Gas for deposit, release and refund |
| `access-manager.test.ts` | The vault owned by an AccessManager: the setup, GOVERNOR's 48 h, EMERGENCY and PAUSER, what cancellers can and cannot cancel, everyone else refused, and changes to the rules taking ADMIN's 48 h |

## Deploying

`scripts/deploy.ts` reads a JSON config (`DEPLOY_CONFIG`) with environment overrides, and writes
`deployments/<network>.json`. On chain IDs 1 and 56 it refuses the mock token, requires the specification's USDT
address and decimals, requires the owner to be a contract (the AccessManager whose admin is the Safe), and asks for
`KUSDT_CONFIRM_MAINNET=deploy-to-<chainId>`. See `bridge/evm/README.md`.
