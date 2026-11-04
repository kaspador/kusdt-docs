---
title: Relay fees and mass
description: The Kaspa relay fee of 100 sompi per gram, which mass it is taken on, and how the kUSDT builders price transactions.
---

:::note[Confirmed on a node]
Observed on kaspad v2.1.0 (simnet): the relay fee is **100 sompi per gram**, taken on the **larger of compute
mass and normalized transient mass**.
:::

## The three masses

Kaspa measures a transaction's cost in grams of *mass*, along three dimensions:

| Mass | Measures | Formula (consensus constants) |
|---|---|---|
| Compute | Validation work | size in bytes × 1 + output script bytes × 10 + signature operations × 1 000 |
| Transient | Bandwidth and short-term storage | size in bytes × 4 |
| Storage | Long-term UTXO storage | see [Storage mass](/kaspa/storage-mass/) |

Transient mass is **normalized** to compute units before it is compared: blocks allow 1 000 000 of transient mass
against 500 000 of compute mass, so the normalized transient mass is half the raw value.

Before Toccata, mempools relay transactions up to a mass of 100 000. That cap is lifted for good 30 minutes before
Toccata activates; after it, only the block limits apply (500 000 compute and storage, 1 000 000 transient). The
kUSDT builders keep compute and storage mass at or below 100 000. Pool transactions go above it in transient mass
(a sell about 108 000, an add about 114 000), which is fine, since covenant transactions only exist after Toccata.
See [Storage mass](/kaspa/storage-mass/#after-toccata).

## The relay fee

The node's relay minimum is:

```text
minimum fee = 100 sompi × max(compute mass, normalized transient mass)
```

1 KAS is 10⁸ sompi, so 100 sompi per gram is 0.000001 KAS per gram.

## How the kUSDT builders price

The `kusdt-tx` builders (and their WebAssembly build) price a transaction on the **largest** of all three
dimensions, storage included, as Kaspa's own wallet SDK does. That is always at least the relay minimum:

```text
fee = feerate × max(compute, storage, normalized transient)      feerate ≥ 100 sompi per gram
```

They build, measure with Kaspa's mass calculator, and rebuild until the fee covers the mass. For a mint to two
recipients at 1.5 KAS each, with a storage mass of about 92 000, that is about 9 200 000 sompi, or 0.092 KAS.

Every request may set `feerate` (sompi per gram). Lower values are raised to 100.

## Practical notes

- Covenant transactions are large: they carry the covenant program in each input. Expect fees well above a plain
  KAS payment.
- Change below 0.2 KAS is left to the fee by the builders, because a tiny output costs more storage mass than it
  is worth.
- The node computes the masses itself; the builders send transactions with the mass fields set to 0.
