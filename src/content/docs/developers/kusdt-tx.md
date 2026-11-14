---
title: The kusdt-tx CLI
description: The kUSDT transaction builder and protocol helper. One JSON request on stdin, one JSON answer on stdout.
---

`kusdt-tx` builds every kUSDT and KasPool transaction and computes every protocol value. The same code is compiled
to WebAssembly (`@kusdt/core`), so the CLI, the simnet run, the services, the web app and the wallet share one implementation.

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
| `mint` | A mint: `minter` (UTXO and state), `chain`, `firstNonce`, `ageDaa` (the minter UTXO's age it claims, which becomes the input's sequence; 0 is always valid), `recipients`, `signerKeys`, `signerIndices`, `signatures`, `tokenValue` |
| `transfer` | A KCC-20 transfer of 1 to 3 token inputs to 1 to 3 outputs. With `redeem` entries it is a redemption, and the payload is added. Only a redemption of the shape the signers pay is built (since run 21, Daybreak [27]): each entry names chain 1 or 2, an address other than zero, and an output to that burn owner; every output to a burn owner it names is a plain burn (borrow scheme 0, zero borrow guard and extension commitment) of an amount above zero. What the core cannot know it does not check: whether the deployment has that chain, whether the address is the chain's vault or token contract (lost for good), whether the token blocks it, and the release fee (a burn at or below it is never paid). An output to a burn owner that no `redeem` entry names is not checked at all |
| `pause` | The guardian's pause: `minter`, `guardianSecretKey` |
| `govern` | A governance action: `minter`, `action` (`kind`: `unpause`, `setLimits`, `setSigners`, `skipNonce`, `setValue`), `ageDaa` (optional, 0 if absent; it settles the allowance), and the quorum |
| `pool-genesis` | A new pool: `tokenCovid`, `baseValue`, `admin`, `guardian` (the bridge's guardian, x-only), and the circuit breaker: `maxOutBps` (1 to 10 000) and `windowLen` (DAA; 36 000 is an hour at 10 BPS) |
| `pool-init` | The first deposit: `pool`, `provider`, `kasIn`, `tokensIn`, `positionOwner`, `tokenValue`, `positionValue`, `adminSecretKey` (the pool admin's key: the first deposit takes its signature) |
| `pool-buy` | KAS in: `pool`, `reserve`, `kasIn`, `tokensOut`, `buyer`, `tokenValue`, `nowDaa` (optional while at most half of the cap is in use; it claims the `pool` UTXO's age as `pool-sell` does) |
| `pool-sell` | kUSDT in: `pool`, `reserve`, `payer`, `tokensIn`, `kasOut`, `tokenValue`, `nowDaa` (required: a DAA score the DAG has reached; the builder claims the age of the `pool` UTXO, `nowDaa` less its `blockDaaScore` capped at two windows, as the input's relative lock). A sell over the circuit breaker is refused. While more than half of the cap is in use (`windowOut` above half of `maxOutBps` of `windowRef`) every buy, sell, add and remove must claim at least `windowLen ÷ 720` (50 DAA), except a remove while the pool is paused: on a younger pool UTXO, or one with no `blockDaaScore` (only in the mempool), the builder refuses and says from which DAA score it can be built. Build at that DAA score: it claims exactly the minimum |
| `pool-add` | Add liquidity: `pool`, `reserve`, `provider`, `kasIn`, `tokensIn`, `shares`, `positionOwner`, `tokenValue`, `positionValue`, `nowDaa` (it claims the pool UTXO's age, as a swap does), and `adminSecretKey` for the first deposit into an emptied pool (only the 1000 unowned shares left), which starts the reference again at the new reserve |
| `pool-remove` | Burn a Position: `pool`, `reserve`, `position`, `positionSecretKey`, `kasOut`, `tokensOut`, `receiver`, `tokenValue`, `nowDaa` (as `pool-add`; while the pool is paused it claims 0 whatever `nowDaa` says) |
| `pool-tick` | Anyone settles the breaker and nothing else: `pool` (with its `blockDaaScore`), `nowDaa`; it claims the pool UTXO's age, at least `windowLen ÷ 720`; refused while the pool is paused, and before its first deposit (`totalShares` 0) |
| `split` | Plain coins into `count` (1 to 16) coins of `value` sompi each, all to `changeAddress`, the rest as change, or added to the last coin when under 0.2 KAS (the pool keeper's coins): `funding`, `count`, `value`; `feerate` at most 1 000 |
| `pool-collect` | Collect protocol fees: `pool`, `reserve`, `adminSecretKey`, `feesTo`, `tokenValue` |
| `pool-pause` | The guardian pauses the pool: `pool`, `secretKey` (the guardian's); refused when it is paused already |
| `pool-unpause` | The admin resumes it: `pool`, `secretKey` (the admin's) |
| `pool-set-keys` | The admin hands the keys over: `pool`, `secretKey` (the admin's), `newAdmin`, `newGuardian` (each defaults to the current one). It replaced `set_admin` |
| `position-transfer` | Give a Position to `newOwner`: `position`, `secretKey` |

Every transaction request also takes:

| Field | Meaning |
|---|---|
| `network` | `mainnet`, `testnet-10`, `simnet` or `devnet` |
| `funding` | Plain P2PK coins that pay for values and the fee: `[{utxo, secretKey}]` |
| `changeAddress` | Where change goes. Its key must be a point on secp256k1 (any script hash will do), and its payload its version's length: anything else is refused, as `prepare` refuses such a `genesisAddress` |
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

### Inputs of a pool or minter transaction

Since rc.22 the pool and the minter take a transaction only if a node's mempool judges every input as a block will
(`require_settled_inputs`). Anyone who builds one, with these builders or without, keeps to this:

- At most 8 inputs in all. A buy leaves room for 6 funding coins; a sale, a deposit or a withdrawal for 5; a tick
  for 7. Merge small coins first.
- Funding coins are plain Schnorr P2PK coins, with sequence 0. A builder refuses any other kind.
- Every coin is already in a block, or is an output of the transaction that made the pool or minter coin (a chain of
  pool spends at no claimed age). Give a coin known only from the mempool the DAA score 18446744073709551615
  (u64::MAX, as the node does), so the scripts the builder runs judge it as the node will.
- The pool or minter input's sequence is the age the transaction claims, and an age above 0 needs that coin in a
  block. The builders do this from `ageDaa` and `nowDaa`.
- kUSDT owned by a P2SH script or by another covenant can't pay into the pool directly: move it to a plain owner
  first.

## Protocol helpers

| Command | Request | Answer |
|---|---|---|
| `mint-digest` | `{covenantId, chain, firstNonce, ageDaa, recipients}` (`ageDaa`: the age the mint will claim, 0 if absent) | `{digest}` |
| `govern-digest` | `{covenantId, adminNonce, ageDaa, action, outpoint?}`; `ageDaa` is the age the governance transaction will claim (signed; 0 if absent, at most 2³² − 1); `outpoint` is `{transactionId, index}` of the minter UTXO the action spends, required for `unpause` (which signs it) and ignored otherwise | `{digest, quorum, params, ageDaa}` |
| `burn-owner` | `{chain, address}` (20-byte hex) | `{ownerScheme, owner, script}` |
| `signer-set` | `{signerKeys}` (five x-only keys) | `{signerSet}` |
| `quote` | `{kind: "buy", pool, kasIn}`, `{kind: "sell", pool, tokensIn, nowDaa?, poolDaa?}`, `{kind: "add", pool, kasIn, tokensIn}` or `{kind: "remove", pool, shares}` | `{tokensOut}`, `{kasOut, paused}`, `{shares}` or `{kasOut, tokensOut}`. With `nowDaa`, a sell also answers `breaker: {maxKasOut, windowEndsDaa, allowed}`. An error for an amount below zero, and for a pool with no liquidity (`totalShares`, `kasReserve` or `tokenReserve` 0, as before its first deposit) or a `windowLen` outside 1 to 1 000 000 000; `pool-buy`, `pool-sell`, `pool-add`, `pool-remove` and `pool-tick` refuse such a pool too |
| `script` | `{actor, state}`, actor `KCC20`, `BridgeMint`, `Pool` or `Position` | `{scriptPublicKey}`: the locking script that holds this state |
| `template` | none | `{templateHash, prefix, suffix}` of the `KCC20` template |
| `layout` | none (stdin is read and ignored) | Every actor's program layout (prefix, state, suffix) and dispatch tags |

Examples:

```sh
echo '{"chain":1,"address":"1111111111111111111111111111111111111111"}' | kusdt-tx burn-owner
kusdt-tx template
```
