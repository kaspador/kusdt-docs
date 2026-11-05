---
title: Coordinator API
description: The coordinator's public, read-mostly JSON API. Nothing in it moves funds.
---

:::note[Where it runs]
The coordinator (`bridge/services/src/coordinator/`) serves this API for the public testnet at
`https://kastools.com/api/v1`, and in the local stack at `http://127.0.0.1:9100/api/v1` (see
[Run the simnet flow](/developers/simnet/#a-stack-that-keeps-running)). The mainnet base URL is **to be published**.
:::

The API is public and read-mostly: JSON over HTTPS under `/api/v1`. Nothing in it moves funds. Every answer that
matters can be checked against a node: a token state against its UTXO, a pool state against its script.

**Amounts are JSON integers.** Some exceed 2⁵³, so clients must parse them exactly (not as JavaScript numbers).

## Where the answers come from

The coordinator learns the minter, the pool and the positions the way the monitor does: from accepted
transactions, checking every successor against the outputs (see
[Following covenant states](/architecture/following-states/)). It takes supply from the chain:

```text
minted   = genesis remaining − the minter's remaining
released = the sum of the vaults' Released events
```

## Calls

| Call | Answer |
|---|---|
| `GET /status` | `{network, kaspa: {covenantId, poolId, virtualDaa, minter: {utxo, state}, genesisRemaining, tokenValue, finalityDaa, finalityTiers}, chains: [{chain, name, chainId, vault, token, decimals, scannedBlock, depositNonce, backing, releaseAvailable, paused, fees: {feeBps, minDepositFee, minReleaseFee, minDeposit, maxDeposit, releaseCapacity, releaseRefillPerSecond}, blocklist}]}`. Each vault's parameters as it reports them. `blocklist` is the token view the bridge honours (`isBlackListed`), or `null` for a token that keeps none (BSC-USD). `scannedBlock` is the last final block the coordinator read (`finalizedBlock` is its old name) |
| `GET /tokens?owner=<kaspa address or x-only hex>` | `{states: [{utxo, state}]}`: the owner's unspent kUSDT states |
| `GET /pool` | `{pool, reserve, pending: [txid], confirmed: {pool, reserve}, prices: {kasInKusdt, kusdtInKas}, exact: {unitsPerKas, sompiPerKusdt}, breaker, paused, tvlKas}`. `pool` and `reserve` (each `{utxo, state}`) are the newest, mempool included, carried through the pool moves in `pending`; `confirmed` is the newest accepted. `exact: {unitsPerKas, sompiPerKusdt}` gives the spot prices as integer strings, rounded down (kUSDT units per KAS, sompi per kUSDT); `prices` are floats for display. `breaker: {maxOutBps, windowLen, maxKasOutNow, windowEndsDaa, virtualDaa}` is what sells may still take out of the KAS reserve now (see [the circuit breaker](/contracts/kaspool/#the-circuit-breaker)), and `paused` whether the guardian paused the pool. `priceKas` remains as an alias of `prices.kasInKusdt` |
| `GET /positions?owner=<kaspa address or x-only hex>` | `{positions: [{utxo, state: {tokenCovid, shares, owner}}]}`: the owner's live liquidity positions, each found in the node's UTXO set |
| `GET /deposits/:chain/:nonce` | `{chain, nonce, txHash, sender, ownerScheme, owner, units, fee, minted, status, kaspaTxid?, refund?}`. `refund` appears once Kaspa skipped the nonce: `{status, skipTxid, evmTxHash?, attempts?, nextTry?, lastError?}`, with status `skipped` → `refunded`, or `blocked` while the token blocks the depositor (see [Refunds](/protocol/refunds/)). `:chain` is the code (`1`, `2`), `ethereum` or `bsc`, or the deployment's chain name |
| `GET /recipients/:chain/:address` | `{chain, address, blocklist, blocked, payable, reason}`: whether the vault would pay `address`. `payable` is false for the zero address, the vault's own address, and an address the token blocks; `reason` says which, or is `null`. Answers 503 when the token can't be read, and 400 for an address that is not `0x` and 40 hex digits. Wallets refuse a burn unless `payable` is true |
| `GET /deposits?sender=0x…` or `?owner=…` | The matching deposits, newest first |
| `POST /redeems` | Body `{transaction, transactionId}` (a submitted burn in node JSON, with the ID the node answered) or `{txid, outputIndex, chain, address, state}` (the preimage of a burn without payload). Answers `{redeems: [{redeemId, status}]}`. A malformed preimage answers 400 |
| `GET /redeems/:txid/:outputIndex` | `{redeemId, chain, address, units, status, fee?, payout?, evmTxHash?, attempts?, nextTry?, lastError?}`. `fee` and `payout` come from the vault's `Released` event; `attempts`, `nextTry` and `lastError` show the relayer's retries, or why a payout is held |
| `GET /reserves` | `{supply: {minted, released, pendingBurns, circulating}, backing: {<chain name>: units, total}, at: {<chain name>: block}, healthy}`, where `healthy` means `total ≥ minted − released` (INV-1). Each vault's backing is read at the block its releases were counted to (`at`), so a release that just landed never looks like missing backing |

## Status values

| Object | Statuses, in order |
|---|---|
| Deposit | `pending` → `final` → `minting` → `minted`, or `refunded` |
| Refund (`refund.status`) | `skipped` → `refunded`, or `blocked` (held while the token blocks the depositor; back to `skipped` once it doesn't) |
| Redemption | `seen` → `final` → `signing` → `released`, or `invalid` (not in the UTXO set), or `unpayable` (the vault can never pay it: at or below the release fee, or a zero or vault recipient), or `blocked` (held while the token blocks the recipient; back to `final` once it doesn't) |

A `blocked` record is checked again every hour (`blockedRecheckMs`). It never holds up other records. See
[Blocked recipients](/security/known-limits/#blocked-recipients).

## Verifying answers

- A token state from `/tokens` names its UTXO. Recompute its locking script with
  [`kusdt-tx script`](/developers/kusdt-tx/#protocol-helpers) and compare it with the UTXO on your own node. The
  wallet does exactly this before it shows or spends a state.
- A pool state from `/pool`, and a position from `/positions`, can be checked the same way.
- `/reserves` can be checked against the vaults' `backing()`, read at the blocks in `at`, and the minter's
  `remaining`. `healthy` compares the
  backing with everything minted and not yet released, so a burn still waiting for its release still counts as
  owed.

The [monitor](/security/monitor/) computes the same supply figures from its own nodes and does not use this API.
