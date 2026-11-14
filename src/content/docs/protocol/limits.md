---
title: Limits
description: The mint allowance, the hard cap, the release allowance and the deposit limits, and how each refills.
---

kUSDT limits what can move on both sides of the bridge. The limits cap the damage a bad signer quorum could do,
and they are enforced by the contracts themselves.

## Defaults

| Limit | Default (mainnet) | Enforced by |
|---|---|---|
| Kaspa mint allowance | A ceiling of twice the signers' daily limit, refills fully in 24 h | BridgeMint |
| Kaspa hard cap | 1 000 000 000 USDT; it can only fall | BridgeMint |
| Vault release allowance | 250 000 USDT per vault, refills fully in 24 h | KusdtVault |
| Deposit size | 10 to 100 000 USDT | KusdtVault |
| KasPool sells | 10 % of the KAS reserve at once, refilling at that much per hour (net of buys) | KasPool |

The vaults' `maxDeposit` must stay at or below the Kaspa allowance ceiling, so that every deposit can be minted.
The vault cannot see the Kaspa ceiling, so this is checked by whoever changes either value.
Three deposits may add up to more than the ceiling: the coordinator then mints a shorter batch, down to one deposit. A single deposit above the ceiling (after either value was changed) waits, with every later deposit of its chain, until 4 of 5 signers raise the ceiling or skip it, which refunds it.

## At the mainnet launch

Mainnet starts lower than the defaults, to match what each signer agreed to sign in a day:

| Limit | At the launch |
|---|---|
| Each signer's daily limit (its fuse) | 50 000 kUSDT per 24 hours, for mints and for releases each |
| Deposit size | 10 to 8 000 USDT |
| Vault release allowance | A ceiling of 50 000 USDT per vault, which refills fully in 24 h |
| Deposit meter, for the [rising deposit fee](/protocol/fees/#the-rising-deposit-fee) | 12 500 USDT per vault, a quarter of the signers' limit; 2.50 % at a full meter |
| Kaspa mint allowance | A ceiling of 100 000 kUSDT, twice the signers' limit, which refills fully in 24 h |
| Kaspa hard cap | As the default |

**The vault's allowance is not a cap on a day.** It is a bucket that holds at most 50 000 USDT and refills at
50 000 a day. After a quiet time the bucket is full: 50 000 can be queued at once, and it keeps refilling, so about
twice 50 000 can be queued in the 24 hours that follow. Counting payouts already waiting in the queue from before,
just under three times 50 000 can leave a vault in 24 hours (see
[Most that can move in a window](#most-that-can-move-in-a-window)). That is all the vault itself enforces, and it
is the bound that counts if three signer keys are stolen.

**The signers' own limit does hold per 24 hours.** Each signer counts what it signed in the last 24 hours and signs
nothing that would take it past 50 000 kUSDT of releases and refunds, both chains together (and the same for
mints). A payout needs 3 signers, so with honest signers no more than 50 000 USDT of payouts is signed in any 24
hours, whatever the vaults' buckets hold.

**Why they go together.** A signer signs nothing that would take it past its daily limit, so:
- a mint carries up to 3 deposits, and must fit: the largest deposit is at most a third of the signers' limit. A
  deposit no signer would mint would also hold up every later deposit on its chain;
- the web app and the wallets refuse a burn above the vault's release allowance, so the allowance is at most the
  signers' limit: a larger one would let someone burn kUSDT that no signer would pay out;
- the two vaults' deposit meters together are at most the signers' limit, or the limit would be used up before the
  deposit fee reached its top rate. On mainnet each meter is at most a quarter of it (decided on 14 November 2026):
  with larger meters, deposits spread over the day kept the whole limit in use at the plain fee;
- on mainnet the mint allowance's ceiling is at most twice the signers' limit (decided on 14 November 2026). The
  ceiling is what three stolen signer keys could mint at once, and twice it in any 24 hours. Honest deposits never
  need more than the signers' limit in a day, and a ceiling of twice it was measured never to slow them. The first
  plan kept 500 000, ten times the launch's daily limit.

The deployer refuses a plan that breaks any of these rules. Deposits and burns over a day's limit are not lost: they wait
until the signers' 24 hours allow them, and a batch of deposits too large for the limit is split. Each signer's limit is
one budget for both chains, so the coordinator keeps what frees for the oldest deposit or payout that only the limit is
holding up: the chain whose next deposit has waited longest goes first, and younger deposits and payouts wait. That
wait ends once the oldest one has gone through, and after 25 hours at most.

**Raising them later.** The signers raise their `dailyLimit` in their own config (a payout needs 3 signers with room,
so the bridge's limit is the third highest). The vaults' limits change through the vault owner, with the usual
48-hour delay. Raise the signers' limit first, then the vaults'.

## The same values in base units

| Parameter | Where | Value |
|---|---|---|
| `remaining` (start) | BridgeMint | 1 000 000 000 000 000 |
| `capacity` | BridgeMint | twice the signers' daily limit: 100 000 000 000 at the launch |
| `refill_per_daa` | BridgeMint | `capacity / 864 000` = 115 740 per DAA score at the launch |
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
| What draws from it | The total of a mint | A release's whole `units` (the fee too: it leaves the backing as well) and a refund's `units` |
| When empty | The mint is refused until it refills | The call reverts until it refills |
| Also | | The queue of payouts waiting holds at most one allowance: a payout that would take it past the ceiling reverts until what is queued is paid or cancelled |
| New deployment | Starts as set at genesis | Starts full |

### Most that can move in a window

An allowance holds at most its ceiling and refills at ceiling ÷ 24 h. A full bucket can be spent at once, and it
keeps refilling. So over any window of length *t*, at most `capacity + refill_rate × t` can be drawn from it. On
Kaspa a draw is a mint, so **the most that can be minted in any 24-hour window is twice the ceiling**: a full bucket,
then a day of refill.

A vault's allowance is drawn when a payout is queued, and the payout leaves after its wait. Payouts queued before a
window can be paid inside it, so a queue adds to the bound: **at most `capacity + refill_rate × t + one queue` can
leave a vault in a window of length *t***. The queue is capped at one ceiling, so that is **just under three times
the ceiling in any 24 hours**: the queue held from before, a full bucket, and a day of refill less the last wait.

At the mainnet launch values:

| Window | Kaspa mint allowance | Each vault's release allowance |
|---|---|---|
| At once | 100 000 USDT | 50 000 USDT |
| Any 24 hours | at most 200 000 USDT (2 × the ceiling) | under 150 000 USDT (just under 3 × the ceiling) |
| Sustained, per further 24 hours | 100 000 USDT (the refill) | 50 000 USDT (the refill) |

## The hard cap

`remaining` starts at 10¹⁵ units (1 billion USDT) and goes down with every mint. No entry raises it, including
governance. It also keeps every Kaspa sum far below the 64-bit integer limit.

## Changing the limits

| Limit | Who changes it | Bounds |
|---|---|---|
| Kaspa allowance (`capacity`, `refill_per_daa`) | 4 of 5 signers (`set_limits`) | From 0 to 10¹⁵ each (the lifetime cap). The allowance is settled at the old rate first, then lowered to the new ceiling if it is above it |
| Rising deposit fee (`surgeFeeBps`, `surgeCapacity`) | Vault owner (`setDepositSurge`) | `surgeFeeBps ≤ 300` (3 %); a meter size of 0 (off) or 2 units to 10¹⁵. The meter keeps what it holds, up to the new size |
| Vault release allowance | Vault owner (`setReleaseLimits`) | `releaseCapacity ≤ 10¹⁵`; `releaseRefillPerSecond ≤ releaseCapacity / 86 400`, so a full refill takes at least a day. Raising the capacity never makes more available at once |
| Deposit limits | Vault owner (`setDepositLimits`) | `0 < minDeposit ≤ maxDeposit ≤ 10¹⁵` |
| Payout wait, 10 minutes on mainnet | Vault owner (`setPayoutDelay`) | 5 minutes to 24 hours. See [The wait](/protocol/redemptions-and-releases/#the-wait) |
| Hard cap | Nobody | Only goes down |

### The pool's circuit breaker

The KAS side of [KasPool](/contracts/kaspool/#the-circuit-breaker) has its own limit. At most 10 % of its KAS reserve
(the cap, `max_out_bps`) may leave through sells at once, net of buys, and that allowance refills at one cap per
`window_len` DAA (36 000, an hour at 10 BPS). Idle time fills it to one cap and no further. At one moment, whatever mix
of buys, sells and liquidity moves is used, one cap (plus any credit from earlier buys whose KAS is still in the pool) is the most that can leave
net; over any time *t* about `cap + credit + cap × t ÷ window_len`. Its clock is the pool UTXO's own age, which consensus
proves with a relative lock, so it can't run ahead of real time or replay idle hours, and the reserve the cap is measured
on rises only with that claimed time.
