---
title: The kusdt-tx CLI
description: The kUSDT transaction builder and protocol helper. One JSON request on stdin, one JSON answer on stdout.
---

`kusdt-tx` builds every kUSDT and KasPool transaction and computes every protocol value. The same code is compiled
to WebAssembly (`@kusdt/core`), so the CLI, the simnet run, and later the web app and the wallet share one
implementation.

```sh
bash tools/rust.sh bridge/kaspa cargo build --release --bin kusdt-tx
echo '<request JSON>' | kusdt-tx <command>
```

The CLI reads one JSON request on stdin and writes one JSON answer on stdout. On failure it writes
`{"error": "..."}` and exits with status 1. `template` reads no input. Field names are camelCase.

Every integer in a request may be a JSON number or a decimal string, so JavaScript callers can pass values above
2⁵³ exactly (for example `"amount": "1000000000000000"`). Floats and hex strings are refused.

## Transactions

Each builder assembles the transaction, fills the covenants' hidden witnesses, signs, runs every input through
Kaspa's script engine, checks relay standardness, and prices the fee from Kaspa's own mass calculator.

| Command | Builds |
|---|---|
| `prepare` | The KCC-23 preparation transaction: `metadata`, `genesisAddress`, `genesisValue` |
| `genesis` | The kUSDT genesis: one `BridgeMint` (`minter` state, `minterValue`) and one `TokenSeed` (`seedOwner`, `seedValue`) |
| `mint` | A mint: `minter` (UTXO and state), `chain`, `firstNonce`, `nowDaa`, `recipients`, `signerKeys`, `signerIndices`, `signatures`, `tokenValue` |
| `transfer` | A KCC-20 transfer of 1 to 3 token inputs to 1 to 3 outputs. With `redeem` entries it is a redemption, and the payload is added |
| `pause` | The guardian's pause: `minter`, `guardianSecretKey` |
| `govern` | A governance action: `minter`, `action` (`kind`: `unpause`, `setLimits`, `setSigners`, `skipNonce`, `setValue`), `nowDaa` for `setLimits`, and the quorum |
| `pool-genesis` | A new pool: `tokenCovid`, `baseValue`, `admin`, `guardian` (the bridge's guardian, x-only), and the circuit breaker: `maxOutBps` (1 to 10 000) and `windowLen` (DAA; 36 000 is an hour at 10 BPS) |
| `pool-init` | The first deposit: `pool`, `provider`, `kasIn`, `tokensIn`, `positionOwner`, `tokenValue`, `positionValue` |
| `pool-buy` | KAS in: `pool`, `reserve`, `kasIn`, `tokensOut`, `buyer`, `tokenValue` |
| `pool-sell` | kUSDT in: `pool`, `reserve`, `payer`, `tokensIn`, `kasOut`, `tokenValue`, `nowDaa` (required: a DAA score the DAG has reached; it becomes the lock time, and is raised to the open window's start if older). A sell over the circuit breaker is refused |
| `pool-add` | Add liquidity: `pool`, `reserve`, `provider`, `kasIn`, `tokensIn`, `shares`, `positionOwner`, `tokenValue`, `positionValue` |
| `pool-remove` | Burn a Position: `pool`, `reserve`, `position`, `positionSecretKey`, `kasOut`, `tokensOut`, `receiver`, `tokenValue` |
| `pool-collect` | Collect protocol fees: `pool`, `reserve`, `adminSecretKey`, `feesTo`, `tokenValue` |
| `pool-pause` | The guardian pauses the pool: `pool`, `secretKey` (the guardian's) |
| `pool-unpause` | The admin resumes it: `pool`, `secretKey` (the admin's) |
| `pool-set-keys` | The admin hands the keys over: `pool`, `secretKey` (the admin's), `newAdmin`, `newGuardian` (each defaults to the current one). It replaced `set_admin` |
| `position-transfer` | Give a Position to `newOwner`: `position`, `secretKey` |

Every transaction request also takes:

| Field | Meaning |
|---|---|
| `network` | `mainnet`, `testnet-10`, `simnet` or `devnet` |
| `funding` | Plain P2PK coins that pay for values and the fee: `[{utxo, secretKey}]` |
| `changeAddress` | Where change goes |
| `feerate` | Optional, sompi per gram; at least 100 |

A UTXO is `{transactionId, index, amount, scriptPublicKey, blockDaaScore, isCoinbase, covenantId}`, the script
public key being its 2-byte version followed by the script, in hex.

The answer:

```json
{
  "txid": "…",
  "transaction": { "…": "the node's wRPC JSON form, ready for submitTransaction" },
  "fee": 0,
  "mass": { "compute": 0, "storage": 0, "transient": 0, "feeMass": 0 },
  "covenantId": "… (genesis only)",
  "outputs": [{ "index": 0, "kind": "minter", "value": 0, "scriptPublicKey": "…", "minter": { } }]
}
```

Submit the raw answer's `transaction` untouched: integers can exceed 2⁵³.

:::caution[Secret keys]
Transaction requests carry secret keys in hex, so the builder can sign. Run the CLI only on a machine you trust,
and never log its input. The WebAssembly build lets a wallet do the same in the browser without sending keys
anywhere.
:::

## Protocol helpers

| Command | Request | Answer |
|---|---|---|
| `mint-digest` | `{covenantId, chain, firstNonce, recipients}` | `{digest}` |
| `govern-digest` | `{covenantId, adminNonce, action}` | `{digest, quorum, params}` |
| `burn-owner` | `{chain, address}` (20-byte hex) | `{ownerScheme, owner, script}` |
| `signer-set` | `{signerKeys}` (five x-only keys) | `{signerSet}` |
| `quote` | `{kind: "buy", pool, kasIn}`, `{kind: "sell", pool, tokensIn, nowDaa?}`, `{kind: "add", pool, kasIn, tokensIn}` or `{kind: "remove", pool, shares}` | `{tokensOut}`, `{kasOut, paused}`, `{shares}` or `{kasOut, tokensOut}`. With `nowDaa`, a sell also answers `breaker: {maxKasOut, windowEndsDaa, allowed}` |
| `script` | `{actor, state}`, actor `KCC20`, `BridgeMint`, `Pool` or `Position` | `{scriptPublicKey}`: the locking script that holds this state |
| `template` | none | `{templateHash, prefix, suffix}` of the `KCC20` template |

Examples:

```sh
echo '{"chain":1,"address":"1111111111111111111111111111111111111111"}' | kusdt-tx burn-owner
kusdt-tx template
```
