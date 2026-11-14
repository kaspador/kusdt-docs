---
title: Fees
description: Bridge fees, pool fees and Kaspa network fees, with the exact formulas and worked examples.
---

## Bridge fees

Both directions start from the same proportional rate, with a minimum per transaction:

```text
fee = max(minimum, ceil(units × feeBps / 10 000))
```

The proportional part rounds **up** to the next base unit (10⁻⁶ USDT). A release always pays exactly this. A
deposit pays this while all of it fits under half of its vault's deposit meter (on mainnet at the launch: the meter and the deposit together at most 6 250 USDT), and more for the part above that, when many deposits were made on its chain in the last 24 hours: see
[the rising deposit fee](#the-rising-deposit-fee) below.

| Parameter | Default (mainnet) | Hard bound in the vault |
|---|---|---|
| `feeBps` (both directions) | 50, which is 0.50 % | at most 100 (1 %) |
| `surgeFeeBps` (deposits, at a full deposit meter) | 250, which is 2.50 % | at most 300 (3 %) |
| `surgeCapacity` (the deposit meter's size) | a quarter of the signers' daily limit, per vault: 12 500 USDT at the launch | 0 (off), or 2 units to 10¹⁵ |
| `minDepositFee` | 0.50 USDT (500 000 units) | at most 50 USDT |
| `minReleaseFee` on Ethereum | 5 USDT (5 000 000 units) | at most 50 USDT |
| `minReleaseFee` on BNB Chain | 0.50 USDT (500 000 units) | at most 50 USDT |

| Direction | You receive | Minimum applies below |
|---|---|---|
| Deposit | `units − fee` in kUSDT | 100 USDT, at the plain rate |
| Release on Ethereum | `units − fee` in USDT | 1 000 USDT |
| Release on BNB Chain | `units − fee` in BSC-USD | 100 USDT |
| Refund | Exactly the deposit's `minted` amount | No release fee; the deposit fee is kept |

Worked examples are on [Bridge USDT in](/getting-started/bridge-in/#what-you-receive) and
[Redeem kUSDT](/getting-started/redeem/#what-you-receive).

### The rising deposit fee

Each vault keeps a **deposit meter**. Every deposit adds its amount to it. The meter drains steadily, by its whole
size (`surgeCapacity`) per day, and never holds more than its size. The rate a deposit pays depends on where the
meter stands:

| Meter | Rate |
|---|---|
| Under half full | `feeBps`, 0.50 % |
| From half full to full | A straight line from 0.50 % up to `surgeFeeBps`, 2.50 % |
| Full | 2.50 % |

A deposit pays each of its units at the rate where the meter stands as that unit goes in, so splitting a deposit
into smaller ones changes nothing. The total is rounded up, and the minimum deposit fee still applies. With the
launch values, where each vault's meter is 12 500 USDT:

| Deposit | Meter before | Fee |
|---|---|---|
| 1 000 USDT | Empty | 5.00 USDT (0.50 %) |
| 8 000 USDT | Empty | 44.90 USDT (0.56 %): 6 250 under half the meter, 1 750 on the line |
| 8 000 USDT | 6 250 USDT (half) | 137.50 USDT (1.71 %): 6 250 on the line, 1 750 at the full rate |
| 1 000 USDT | 9 375 USDT (three quarters) | 16.60 USDT (1.66 %) |
| 1 000 USDT | Full | 25.00 USDT (2.50 %) |

A full meter is empty again 24 hours later, and half empty, back at the plain rate, after 12 hours.

**Why.** The signers sign for a limited amount a day, across both chains (see
[Limits](/protocol/limits/#at-the-mainnet-launch)). At the flat fee one party could use that up cheaply, and other
people's deposits then waited. With the rising fee, the more of the day's limit is in use, the more the next
deposit pays. Each meter is a quarter of the signers' daily limit, so the two meters are full by the time half the
day's limit is used. A meter of half the limit (the first choice) drained fast enough that deposits spread over the
day, one 8 000 USDT deposit into each vault every 7.6 hours, kept the whole limit in use at the plain 0.50 %. At a
quarter the same steady flow pays about 2.1 %.

**Deposits only.** A bridge back to Ethereum or BNB Chain always pays the flat fee. The vault sets a release's fee
after you have burnt your kUSDT on Kaspa, and a burn cannot be undone, so you could not refuse a higher fee at that
point. This also means that using up the day's limit in the bridge-back direction still costs only the flat fee
(see [Known limits](/security/known-limits/#the-daily-limit-can-be-used-up-by-one-party)).

**You get what you were shown, or nothing is sent.** Another deposit can land just before yours and raise your
fee. So the web app and the wallet send every deposit as `depositAtLeast`, which names the least kUSDT the deposit
may mint: what they showed you, less a quarter of a percent of the deposit. If the fee has risen by more than that,
the vault reverts the deposit and takes nothing. The web app also reads the vault again right before it asks you to
sign: if the fee has already moved past that margin, it sends nothing and shows the new figures.

The meter's size and top rate are set when the vault is created, and the owner can change them with
`setDepositSurge`, after its 48-hour delay and within the hard bounds above. A vault whose meter size is 0 charges
the flat fee. The mainnet vaults start with a meter of 12 500 USDT each and a top rate of 2.50 %. The testnet
deploy script sets none, so a vault it deploys charges the flat fee.

### Where bridge fees go

Fees stay in the vault and are counted in `feesAccrued`, separately from the backing. Only the vault owner can
withdraw them, and never more than `feesAccrued`:

```text
vault balance / scale = backing() + feesAccrued
```

## Pool fees

Every KasPool swap pays 0.50 % of its input:

| Share | Rate | Where it goes |
|---|---|---|
| Liquidity providers | 0.45 % | Stays in the reserves, raising the value of every share |
| Protocol | 0.05 % | Accrues in `protocol_kas` (buys) or `protocol_tokens` (sells); the pool admin collects it |

```text
protocol_cut = floor(input × 5 / 10 000)
effective    = floor(input × 9 950 / 10 000)    // what the price curve sees
```

Adding and removing liquidity pay no pool fee.

## Kaspa network fees

Every Kaspa transaction, including mints, transfers, swaps and burns, pays a network fee in KAS. The relay
minimum is 100 sompi per gram of mass (1 KAS = 10⁸ sompi). See [Relay fees](/kaspa/relay-fees/).

## KAS carried by token states

Each covenant UTXO must carry enough KAS to cover its storage mass. This is not a fee: the KAS stays in the UTXO
and moves with it.

| UTXO | KAS carried in the simnet run |
|---|---|
| A kUSDT state | 1.5 KAS (the default) |
| A KasPool Position | 2 KAS |
| BridgeMint | 5 KAS (changeable with `set_value`, 4 of 5) |
| The Pool | its base deposit (1 KAS in the simnet run) plus the KAS reserve and the protocol's KAS |

The KAS in a newly minted state is paid by the coordinator's Kaspa funding, out of the deposit fee; from then on
it belongs to the holder. A burn state carries the deployment's burn value instead, 0.3 KAS. Nothing can spend a
burn, so that KAS is gone for good, and it is part of a redemption's cost. See [Storage mass](/kaspa/storage-mass/).
