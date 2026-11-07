---
title: Build and test
description: How to build the contracts and run every test suite.
---

## Requirements

| Tool | For |
|---|---|
| Docker | All Rust work runs in the pinned `rust:1.94.1` container through `tools/rust.sh` |
| Node.js and npm | The EVM tests, the TypeScript packages and the simnet run |
| Bash | The scripts in `tools/` (Git Bash works on Windows) |

`tools/rust.sh` mounts only the repository, so code pulled from crates.io and git never sees the rest of the
machine. Cargo caches and build output live in named Docker volumes.

## Commands

Run from the repository root unless noted.

```sh
bash tools/vendor.sh                                                  # optional: the specifications and compiler sources, to read
bash tools/rust.sh bridge/kaspa cargo test                            # contracts and builders (Docker)
bash tools/rust.sh bridge/kaspa cargo run --example build_artifacts   # after editing a .ag file
node tools/check-artifacts.mjs --write                                # then record what built them
bash tools/rust.sh bridge/kaspa cargo build --release --bin kusdt-tx  # the CLI
docker build -t kusdt-rust-wasm:1 -f tools/docker/rust-wasm.Dockerfile tools/docker   # once: the WebAssembly toolchain
bash tools/wasm.sh                                                    # the WebAssembly core
npm install --legacy-peer-deps                                        # repository root
cd bridge/evm && npm ci && npx hardhat test                           # the vault
cd bridge/devnet && npm run simnet:e2e                                # the Kaspa side on a simnet node
cd bridge/devnet && npm run local:e2e                                 # the whole bridge on one machine, with the attack
cd bridge/devnet && npm run local:stack                               # the stack kept running (wallet, web app)
cd bridge/devnet && npm run local:load                                # concurrent deposits, unpayable burn, refund, blocked addresses
cd bridge/devnet && npm run local:rotate                              # a signer rotation, end to end
cd bridge/devnet && npm run mainnet:rehearse -- <scratch dir>         # the mainnet deploy on forks (with local:stack up)
cd bridge/web && npm ci && npm test                                   # the web app's units
cd wallet/extension && npm install --legacy-peer-deps && npm test     # the wallet's units
cd bridge/devnet && npm run fork:rehearsal                            # the vault on mainnet forks, real tokens
```

`fork:rehearsal` forks Ethereum and BNB Chain locally (`ETHEREUM_RPC_URL` and `BSC_RPC_URL`, public nodes by
default) and runs the vault against the real USDT and BSC-USD. It also checks their blocklists: a release to an
address Tether blacklists is paid and frozen there, a blacklisted vault pays nothing, and BSC-USD keeps no
blacklist. Nothing touches a real chain.

The end-to-end runs and the stack need the kaspad simnet container; see [Run the simnet flow](/developers/simnet/).

## What each suite covers

| Suite | Count | Where |
|---|---|---|
| BridgeMint VM tests | 22 | `bridge/kaspa/tests/bridge_mint.rs` |
| KasPool VM tests | 23 | `bridge/kaspa/tests/pool.rs` |
| KCC20 template | 1 | `bridge/kaspa/tests/template.rs` |
| Checked-in artifacts (kUSDT and KasPool) | 2 | `bridge/kaspa/tests/artifacts.rs` |
| Relay standardness of the real builders at their largest shapes | 4 | `bridge/kaspa/tests/standard.rs` |
| Followers ignore decoy outputs | 3 | `bridge/kaspa/tests/decoy_outputs.rs` (and `bridge/packages/protocol/src/decoys.test.ts`) |
| Web app | 133 unit, 160 + 25 end to end | `bridge/web` (`npm test`, `npm run e2e`, `npm run e2e:wallet`) |
| Wallet extension | 123 unit, plus 6 simnet, 7 stack and the smoke suite | `wallet/extension` |
| Protocol and request-parsing unit tests | 6 | `bridge/kaspa/src/protocol.rs`, `src/model.rs` |
| Vault (Hardhat) | 102 | `bridge/evm/test/` |
| Services | 119 | `bridge/services/src/**/*.test.ts` |
| Kaspa client, protocol, core | 59, 28, 4 | `bridge/packages/*` |
| Mainnet deployer | 16 | `bridge/devnet/src/mainnet-deploy.test.ts` |
| Mainnet rehearsal | 49 checks | `npm run mainnet:rehearse` |
| Signer rotation | 16 checks | `npm run local:rotate` |

The VM tests execute every transaction with Kaspa's covenant-enabled script engine, input by input, and check
each one for relay standardness. They try the attacks as well as the good paths.

`tests/standard.rs` calls the same builders the wallet and the services use, with the deployment's values (1.5 KAS
per token state, 2 KAS per Position), and checks that a 3-recipient mint (87 993 storage mass) and a 3-in/3-out transfer or a 2-burn redemption with 1.5 KAS outputs (79 957) stay within 100 000 compute mass, the builders' limit of 300 000 storage and fee mass, and the 15 signature-operation limit. A real 0.3 KAS burn costs more storage mass: about 293 000 with two burns in one transaction. Pool transactions carry more transient mass (a sell about 108 000, an add about 114 000); the test allows up
to 250 000, a quarter of the block limit (see [Storage mass](/kaspa/storage-mass/#after-toccata)).
Print the masses with `bash tools/rust.sh bridge/kaspa cargo test --test standard -- --nocapture`.


## Checking the covenant bytecode

The bytecode in `bridge/kaspa/artifacts/` is what controls minting, and anyone can check that it is what the sources compile to. The sources are all in the repository, the KCC-20 reference included (`vendor/kcc20-reference/`), and the compiler is one commit, named in `bridge/kaspa/Cargo.toml`.

```sh
node tools/check-artifacts.mjs             # one compiler commit; sources, artifacts and bytecode as recorded
node tools/check-artifacts.mjs --upstream  # also the reference against its pinned commit (needs the network)
bash tools/rust.sh bridge/kaspa cargo test --locked --test artifacts --test template   # recompiles and compares
bash tools/wasm.sh && git diff --stat -- bridge/packages/core                          # the WebAssembly core too
```

The compiler and its dependencies still come from the network the first time; only the `.ag` sources needed no fetching. `bridge/kaspa/artifacts/PROVENANCE.json` records the compiler, the toolchain, and the hash of each source, artifact, WebAssembly core and contract's bytecode. The artifacts name the reference by its path in the container (`/kusdt/vendor/kcc20-reference/...`), so rebuild with `tools/rust.sh`. The `covenant bytecode` CI job runs these on every change to them.
## After editing a contract

The builders embed the compiled artifacts. After you change a `.ag` file:

1. run `bash tools/rust.sh bridge/kaspa cargo run --example build_artifacts` to refresh `bridge/kaspa/artifacts/`, then `bash tools/wasm.sh`, since the WebAssembly core embeds them;
2. run `node tools/check-artifacts.mjs --write` to record what built them;
3. run the tests: `tests/artifacts.rs` fails while the checked-in artifact is stale, and `tests/template.rs` fails
   if the `KCC20` template no longer matches the standard.

## Vault options

| Variable | Effect |
|---|---|
| `REPORT_GAS=1` | Gas report (PowerShell: `$env:REPORT_GAS=1`) |
| `INVARIANT_SEED`, `INVARIANT_STEPS` | Seed and length of the randomized test (defaults 20261103 and 250) |
| `DEPLOY_CONFIG` | Deployment parameters for `scripts/deploy.ts` |

A dry run deploys a `MockUSDT` and a vault in-process:

```sh
cd bridge/evm
DEPLOY_CONFIG=config/dryrun.json npx hardhat run scripts/deploy.ts
```
