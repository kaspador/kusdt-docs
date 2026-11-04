---
title: Run the simnet flow
description: Run the Kaspa side of kUSDT against a real kaspad simnet node, or the whole bridge on one machine.
---

`bridge/devnet` holds two end-to-end runs and a stack that keeps running, described in `bridge/devnet/README.md`:

| Run | Command (from `bridge/devnet`) | Covers | Time |
|---|---|---|---|
| `simnet-e2e.ts` | `npm run simnet:e2e` | Every Kaspa-side transaction, bridge and pool, against a real kaspad simnet node | about 10 s |
| `local-e2e.ts` | `npm run local:e2e` | The whole bridge on one machine: two EVM chains, the simnet, 5 signers, the coordinator and the monitor, ending with an attack | about 40 s |
| `local-stack.ts` | `npm run local:stack` | The same stack, kept running on the default ports for the wallet and the web app | until Ctrl+C |
| `local-load.ts` | `npm run local:load` | Load and edge cases: 10 deposits at once, an unpayable burn, 4 releases back to back, a refund, blocked recipients and a blocked vault | |

Nothing in these runs holds real funds: every key is derived from a public name, and the EVM side uses Hardhat's
well-known development accounts.

## Prerequisites

1. **The simnet node.** kaspad v2.1.0 with the UTXO index and wRPC JSON on `127.0.0.1:18610`:

   ```sh
   docker run -d --name kusdt-simnet \
     -p 127.0.0.1:18610:18610 -p 127.0.0.1:17610:17610 \
     kaspanet/rusty-kaspad:v2.1.0 kaspad --simnet --appdir=/app/data --utxoindex \
     --enable-unsynced-mining --nologfiles --disable-upnp \
     --rpclisten-json=0.0.0.0:18610 --rpclisten-borsh=0.0.0.0:17610 --rpcmaxclients=128
   ```

   Later runs need only `docker start kusdt-simnet`. A coinbase output matures after about 1 000 DAA, so each run
   first mines about 1 100 blocks to its own addresses (a few seconds).
2. **Dependencies**: `npm install --legacy-peer-deps` at the repository root.
3. **The builders**: `bash tools/wasm.sh` builds the WebAssembly core (`@kusdt/core`), which the runs use
   in-process by default. Set `KUSDT_CORE=cli` to use the native `kusdt-tx` instead: in the pinned Rust container
   against the release build, or the binary named by `KUSDT_TX`.
4. **For `local:e2e` and `local:stack`**: the EVM build, `npx hardhat compile` in `bridge/evm`.

## The Kaspa side: simnet:e2e

Each transaction is built by the kUSDT builders, submitted to the node, mined, and checked in the node's UTXO set.
The script mines its own coins first, then:

| # | Step | Command |
|---|---|---|
| 1 | KCC-23 metadata in a preparation transaction | `prepare` |
| 2 | Genesis: BridgeMint and a TokenSeed | `genesis` |
| 3 | Mint 2 Ethereum deposits (nonces 0 and 1), signed by signers 0, 2 and 4 | `mint-digest`, `mint` |
| 4 | Alice sends 40 kUSDT to Bob | `transfer` |
| 5 | Bob redeems 90 kUSDT to an Ethereum address, with the payload | `burn-owner`, `transfer` with `redeem` |
| 6 | Mint 2 BNB Chain deposits (nonces 0 and 1), signed by signers 1, 3 and 4 | `mint` |
| 7 | Pool genesis | `pool-genesis` |
| 8 | First deposit: 200 KAS and 20 kUSDT (0.1 kUSDT per KAS) | `pool-init` |
| 9 | Bob buys kUSDT with 10 KAS | `quote`, `pool-buy` |
| 10 | Carol sells 2 kUSDT | `quote`, `pool-sell` |
| 11 | Carol adds liquidity | `quote`, `pool-add` |
| 12 | Carol withdraws her Position | `quote`, `pool-remove` |
| 13 | The admin collects the protocol fees | `pool-collect` |

For every transaction it prints the transaction ID, the fee and the compute, storage and transient mass. It writes
the covenant IDs and transaction IDs to `bridge/devnet/simnet-deployment.json`.

| Variable | Default | Effect |
|---|---|---|
| `KASPA_RPC` | `ws://127.0.0.1:18610` | The node's wRPC URL |
| `TOKEN_VALUE` | `150000000` | KAS (in sompi) each token state carries |
| `PROBE_MASS` | unset | Also print a mint's storage mass at token values from 0.1 to 3 KAS |
| `KUSDT_CORE` | WebAssembly | `cli` for the native CLI |
| `KUSDT_TX` | unset | Path to a native `kusdt-tx` binary |
| `KUSDT_TX_DEBUG` | unset | Print every builder request |

## The whole bridge on one machine

`npm run local:e2e` starts two Hardhat chains (chain IDs 31337 and 31338, standing in for Ethereum and BNB Chain),
each with a MockUSDT (6 and 18 decimals) and a vault, and uses the kaspad simnet. It runs the 5 signers, the
coordinator and the monitor from `bridge/services` in process, and checks:

1. a deposit on each chain, minted on Kaspa with 3 of 5 signatures;
2. a redemption paid on the chain the burn names (49.5 USDT paid for a 50 kUSDT burn);
3. healthy reserves (INV-1), and the pool and position APIs following a buy and a liquidity add and remove;
4. the monitor agreeing with the coordinator: minted 299, released 50, owed 249 ≤ backing 249 (USDT), no alarms;
5. **the attack**: three stolen signer keys try to mint 1 000 000 kUSDT, which the mint allowance refuses, then
   mint 400 000 kUSDT with no deposit, which the covenant accepts. At once they sell it into the pool: the
   circuit breaker refuses the whole sell, and the most it lets out is under 10 % of the pool's KAS. Within
   seconds the monitor raises `inv1` and pauses both vaults, the minter and the pool; the coordinator follows the
   forged mint and the pauses; a paused vault refuses a new deposit.

It prints `local end to end: OK` on success. It passed on 3 November 2026. See [The monitor](/security/monitor/#proof-the-attack-in-the-local-end-to-end-run).

The run starts and stops its own nodes and services on ports of its own, so it can run while `local:stack` is up.
In the local runs the coordinator checks a `blocked` record every 3 seconds (`blockedRecheckMs`).
Its configs and state go to `bridge/devnet/.local-e2e/`, rebuilt on every run.

## The load run

`npm run local:load` (passed on 4 November 2026):

1. 10 deposits at once become 4 mints (of 3, 3, 1 and 3 recipients); kaspad accepts the 3-recipient mints;
2. a 0.30 kUSDT burn, below the release fee, is marked `unpayable` and blocks nothing;
3. 2 redemptions, each with a burn on each chain, become 4 releases back to back;
4. a deposit made while the guardian has paused the minter is skipped by 4 signers and refunded: 14.5 USDT,
   exactly what it minted on paper. All five signers refused at first, until their own nodes saw the skip. The
   token blacklists the depositor first, so the refund is held as `blocked` and paid only once it is unblocked;
5. a burn to an address the token blacklists is held as `blocked` (the signers refuse it) while its neighbour is
   paid, and released once the address is unblocked. `GET /recipients` reports the address as not `payable` on
   chain 1, and as payable on chain 2, whose deployment keeps no blocklist;
6. the token blacklists the vault itself: the monitor raises `vault-blocked` and pauses both vaults and the minter;
7. supply, reserves and the monitor agree along the way.

## A stack that keeps running

`npm run local:stack` launches kUSDT and a seeded pool on the simnet and keeps the whole stack running on the
default ports, for the wallet extension and the web app. Ctrl+C stops it.

| Service | Address |
|---|---|
| EVM chains (Hardhat, chain IDs 31337 and 31338) | `http://127.0.0.1:8545`, `http://127.0.0.1:8546` |
| Coordinator API | `http://127.0.0.1:9100/api/v1` |
| Signers | ports 9101 to 9105 |
| Monitor | port 9200 |
| Dev faucet | `http://127.0.0.1:9099` |

The faucet answers:

| Call | Does |
|---|---|
| `GET /stack` | The endpoints, the deployment and the public dev accounts (also written to `.local-stack/stack.json`) |
| `POST /faucet` with `{kaspa?, evm?, kas?, usdt?}` | Sends KAS to a Kaspa address, and mock USDT on both chains plus gas to an EVM address |
| `POST /mine` with `{blocks}` | Mines simnet blocks |
| `POST /blacklist` with `{chain, address, blocked}` | Puts an address on the chain's mock USDT blacklist (`blocked` true, the default) or takes it off. Only chain 1's deployment honours it, as on mainnet; the answer's `honoured` says so |

Every key in the stack is a development key derived from a public name, or one of Hardhat's published accounts.
Never use them with real funds.

## Lessons from the runs

- `submitTransaction` needs `"mass": 0` and `"storageMass": 0` in the transaction JSON.
- A token output needs about 1.5 KAS; below that its storage mass breaks the 100 000 standard limit. A burn is a
  token output too, and its KAS stays locked with it.
- ethers caches identical requests for 250 ms by default, so back-to-back sends from one account can reuse a
  nonce. The devnet and the services set `cacheTimeout: -1` on every provider.
