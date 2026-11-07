---
title: Storage mass
description: Why covenant UTXOs count double for storage mass, and why each kUSDT state carries about 1.5 KAS.
---

:::note[Confirmed on a node]
Observed on kaspad v2.1.0 (simnet): covenant UTXOs count **double** for storage mass (plurality 2). That is why
each minted kUSDT state carries about 1.5 KAS. The KAS stays the user's, inside their token UTXO.
:::

## Storage mass in brief

Kaspa charges for the UTXOs a transaction creates through **storage mass** (KIP-9). Small outputs cost a lot of
mass; large outputs cost little. For an output of value `v` (in sompi), the output's term is:

```text
C × p² / v        with C = 10¹²  (SOMPI_PER_KASPA × 10 000)
```

`p` is the output's **plurality**: how many 100-byte storage units its UTXO occupies. The transaction's storage
mass is the sum of its outputs' terms, less a term for its inputs. Before Toccata, a transaction above 100 000 grams of mass is not relayed (see [After Toccata](#after-toccata)).

## Why covenant UTXOs count double

Plurality is computed from the UTXO's size:

```text
p = ceil((63 + script_length) / 100)
```

A P2SH script is 35 bytes, so a plain P2SH UTXO has `p = 1`. KIP-20 treats a covenant UTXO as carrying 32 more
bytes, for its covenant ID. That makes `63 + 35 + 32 = 130` bytes, so `p = 2`. Because the term grows with `p²`, a
covenant output costs four times the storage mass of a plain output of the same value.

## What this means for token states

The output term for different KAS values:

| KAS in the output | Plain output (`p = 1`) | Covenant output (`p = 2`) |
|---|---|---|
| 0.5 KAS | 20 000 | 80 000 |
| 1 KAS | 10 000 | 40 000 |
| 1.5 KAS | 6 667 | 26 667 |
| 2 KAS | 5 000 | 20 000 |
| 3 KAS | 3 333 | 13 333 |

A mint creates the BridgeMint successor and its token states, all covenant outputs. With too little KAS per state, a mint would cost far more storage mass, and so more fee. The test `bridge/kaspa/tests/standard.rs` runs the real builders
at their largest shapes, with 1.5 KAS per token state and a 5 KAS minter:

| Transaction | Storage mass |
|---|---|
| Mint to 3 recipients (the maximum) | 87 993 |
| KCC-20 transfer, 3 inputs to 3 outputs (the maximum) | 79 957 |
| Redemption: one 0.3 KAS burn and a 1.5 KAS change token | 159 994 |

A burn is never spent, so its KAS is gone for good. It carries 0.3 KAS, not 1.5: the KAS saved outweighs the
extra storage mass it pays for. Measured with the same builder:

| KAS in the burn | Storage mass | Fee | The redemption costs |
|---|---|---|---|
| 1.5 | 53 327 | 0.053 KAS | 1.553 KAS |
| 0.5 | 106 661 | 0.107 KAS | 0.607 KAS |
| 0.3 | 159 994 | 0.160 KAS | 0.460 KAS |
| 0.2 | 226 661 | 0.227 KAS | 0.427 KAS |
| 0.15 | 293 327 | 0.293 KAS | 0.443 KAS |

Below 0.3 KAS a burn saves almost nothing more and soon costs more in fee. Mints and transfers stay under the
old 100 000 limit; a redemption with a 0.3 KAS burn is over it, which is fine after Toccata (below). Run
`bash tools/rust.sh bridge/kaspa cargo test --test standard -- --nocapture` to print the masses.

### After Toccata

The 100 000 per-transaction standard cap applies only before Toccata. It is lifted for good 30 minutes before
Toccata activates. After that only the block limits apply: 500 000 compute and storage mass, and 1 000 000
transient mass. Covenant transactions only exist after Toccata, so the old cap never meets them.

The kUSDT builders cap a transaction's compute and storage mass at 300 000 (`MAX_STANDARD_MASS`, under the
500 000 block limit). Redemptions use that room: two 0.3 KAS burns in one transaction come to about 293 000.
Pool transactions carry more transient mass: a sell is about 108 000, an add about 114 000.
`tests/standard.rs` allows up to 250 000 transient mass, a quarter of the block limit.

So **each kUSDT state carries 1.5 KAS by default.** This is not a fee:

- the KAS sits inside the token UTXO and belongs to its owner;
- when the owner spends the token, that KAS funds the new outputs or returns as change;
- whoever creates a token output supplies its KAS. For a mint, that is the coordinator's Kaspa funding, paid
  out of the deposit fee.

The one exception is a burn: a burn state can never be spent, so its KAS is gone for good. Burn outputs therefore
carry the deployment's smaller burn value, 0.3 KAS, not the 1.5 KAS token value. A smaller output costs more
storage mass, so the redemption pays a higher network fee: about 0.3 KAS in the burn plus about 0.16 KAS of fee,
some 0.46 KAS per redemption, against about 1.55 KAS with a 1.5 KAS burn (SPEC §9).

## Other covenant UTXOs

| UTXO | KAS in the simnet run |
|---|---|
| BridgeMint | 5 KAS (changeable by `set_value`, 3 of 5) |
| TokenSeed | 1 KAS |
| kUSDT state | 1.5 KAS |
| KasPool Position | 2 KAS |
| Pool | A 1 KAS base deposit, plus its reserve and the protocol's KAS |

## Measuring it

The transaction builders compute the exact mass with Kaspa's own mass calculator and refuse a transaction above
the standard limit. The simnet run prints the compute, storage and transient mass of every transaction. Set
`PROBE_MASS=1` to make it also print the storage mass of a mint at token values from 0.1 to 3 KAS.
