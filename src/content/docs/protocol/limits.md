---
title: Limits
description: The mint allowance, the hard cap, the release allowance and the deposit limits, and how each refills.
---

kUSDT limits what can move on both sides of the bridge. The limits cap the damage a bad signer quorum could do,
and they are enforced by the contracts themselves.

## Defaults

| Limit | Default (mainnet) | Enforced by |
|---|---|---|
| Kaspa mint allowance | 500 000 USDT ceiling, refills fully in 24 h | BridgeMint |
| Kaspa hard cap | 1 000 000 000 USDT; it can only fall | BridgeMint |
| Vault release allowance | 250 000 USDT per vault, refills fully in 24 h | KusdtVault |
| Deposit size | 10 to 100 000 USDT | KusdtVault |

The vaults' `maxDeposit` must stay at or below the Kaspa allowance ceiling, so that every deposit can be minted.
The vault cannot see the Kaspa ceiling, so this is checked by whoever changes either value.

## The same values in base units

| Parameter | Where | Value |
|---|---|---|
| `remaining` (start) | BridgeMint | 1 000 000 000 000 000 |
| `capacity` | BridgeMint | 500 000 000 000 |
| `refill_per_daa` | BridgeMint | `capacity / 864 000` = 578 703 per DAA score |
| `minDeposit` / `maxDeposit` | KusdtVault | 10 000 000 / 100 000 000 000 |
| `releaseCapacity` | KusdtVault | 250 000 000 000 |
| `releaseRefillPerSecond` | KusdtVault | 2 893 518 (capacity / 86 400, rounded down) |

Kaspa's DAA score rises about 10 times per second, so 864 000 DAA scores is about 24 hours.

## How an allowance works

Both allowances are *buckets*. A bucket holds up to its capacity. Each mint or payout takes from it, and it
refills at a fixed rate:

```text
available(now) = min(capacity, bucket + elapsed × refill_rate)
```

| | Kaspa mint allowance | Vault release allowance |
|---|---|---|
| Clock | DAA score, proved by the transaction's lock time | `block.timestamp` |
| What draws from it | The total of a mint | A release's payout (`units − fee`) and a refund's `units` |
| When empty | The mint is refused until it refills | The call reverts until it refills |
| New deployment | Starts as set at genesis | Starts full |

### Most that can move in a window

An allowance holds at most its ceiling and refills at ceiling ÷ 24 h. A full bucket can be spent at once, and it
keeps refilling. So over any window of length *t*, at most `capacity + refill_rate × t` can move, and **the most
that can move in any 24-hour window is twice the ceiling**: a full bucket, then a day of refill.

| Window | Kaspa mint allowance | Each vault's release allowance |
|---|---|---|
| At once | 500 000 USDT | 250 000 USDT |
| Any 24 hours | at most 1 000 000 USDT (2 × the ceiling) | at most 500 000 USDT (2 × the ceiling) |
| Sustained, per further 24 hours | 500 000 USDT (the refill) | 250 000 USDT (the refill) |

## The hard cap

`remaining` starts at 10¹⁵ units (1 billion USDT) and goes down with every mint. No entry raises it, including
governance. It also keeps every Kaspa sum far below the 64-bit integer limit.

## Changing the limits

| Limit | Who changes it | Bounds |
|---|---|---|
| Kaspa allowance (`capacity`, `refill_per_daa`) | 4 of 5 signers (`set_limits`) | Non-negative. The allowance is settled at the old rate first, then lowered to the new ceiling if it is above it |
| Vault release allowance | Vault owner (`setReleaseLimits`) | `releaseCapacity ≤ 10¹⁵`; `releaseRefillPerSecond ≤ releaseCapacity / 86 400`, so a full refill takes at least a day. Raising the capacity never makes more available at once |
| Deposit limits | Vault owner (`setDepositLimits`) | `0 < minDeposit ≤ maxDeposit ≤ 10¹⁵` |
| Payout wait, 10 minutes on mainnet | Vault owner (`setPayoutDelay`) | 5 minutes to 24 hours. See [The wait](/protocol/redemptions-and-releases/#the-wait) |
| Hard cap | Nobody | Only goes down |
