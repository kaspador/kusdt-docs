---
title: Fees
description: Bridge fees, pool fees and Kaspa network fees, with the exact formulas and worked examples.
---

## Bridge fees

Both directions pay the same proportional rate, with a minimum per transaction:

```text
fee = max(minimum, ceil(units × feeBps / 10 000))
```

The proportional part rounds **up** to the next base unit (10⁻⁶ USDT).

| Parameter | Default (mainnet) | Hard bound in the vault |
|---|---|---|
| `feeBps` (both directions) | 20, which is 0.20 % | at most 100 (1 %) |
| `minDepositFee` | 0.50 USDT (500 000 units) | at most 50 USDT |
| `minReleaseFee` on Ethereum | 5 USDT (5 000 000 units) | at most 50 USDT |
| `minReleaseFee` on BNB Chain | 0.50 USDT (500 000 units) | at most 50 USDT |

| Direction | You receive | Minimum applies below |
|---|---|---|
| Deposit | `units − fee` in kUSDT | 250 USDT |
| Release on Ethereum | `units − fee` in USDT | 2 500 USDT |
| Release on BNB Chain | `units − fee` in BSC-USD | 250 USDT |
| Refund | Exactly the deposit's `minted` amount | No release fee; the deposit fee is kept |

Worked examples are on [Bridge USDT in](/getting-started/bridge-in/#what-you-receive) and
[Redeem kUSDT](/getting-started/redeem/#what-you-receive).

### Where bridge fees go

Fees stay in the vault and are counted in `feesAccrued`, separately from the backing. Only the vault owner can
withdraw them, and never more than `feesAccrued`:

```text
vault balance / scale = backing() + feesAccrued
```

## Pool fees

Every KasPool swap pays 0.30 % of its input:

| Share | Rate | Where it goes |
|---|---|---|
| Liquidity providers | 0.25 % | Stays in the reserves, raising the value of every share |
| Protocol | 0.05 % | Accrues in `protocol_kas` (buys) or `protocol_tokens` (sells); the pool admin collects it |

```text
protocol_cut = floor(input × 5 / 10 000)
effective    = floor(input × 9 970 / 10 000)    // what the price curve sees
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
| BridgeMint | 1 KAS (changeable with `set_value`, 3 of 5) |
| The Pool | its base deposit (1 KAS in the simnet run) plus the KAS reserve and the protocol's KAS |

The KAS in a newly minted state is paid by the coordinator's Kaspa funding, out of the deposit fee; from then on
it belongs to the holder. A burn state's KAS (1.5 KAS) is locked forever, with the burned tokens, so it is part
of a redemption's cost. See [Storage mass](/kaspa/storage-mass/).
