---
title: Build and test
description: How to build the contracts and run every test suite.
---

## Requirements

| Tool | For |
|---|---|
| Docker | All Rust work runs in the pinned `rust:1.94.1` container through `tools/rust.sh` (the image named by its digest) |
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
bash tools/wasm.sh                                                    # the WebAssembly core (it builds its image first)
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
| All Rust tests (the rows below, the pool's attack and slot tests, and the rest) | 175 | `bridge/kaspa` |
| BridgeMint VM tests | | `bridge/kaspa/tests/bridge_mint.rs` |
| KasPool VM tests | | `bridge/kaspa/tests/pool.rs` |
| Covenant attacks | | `bridge/kaspa/tests/adversarial.rs` |
| KCC20 template | | `bridge/kaspa/tests/template.rs` |
| Checked-in artifacts (kUSDT and KasPool) | | `bridge/kaspa/tests/artifacts.rs` |
| Relay standardness of the real builders at their largest shapes | | `bridge/kaspa/tests/standard.rs` |
| Followers ignore decoy outputs | | `bridge/kaspa/tests/decoy_outputs.rs` (and `bridge/packages/protocol/src/decoys.test.ts`) |
| Protocol and request-parsing unit tests | | `bridge/kaspa/src/protocol.rs`, `src/model.rs` |
| Web app | 249 unit, plus the end-to-end suites | `bridge/web` (`npm test`, `npm run e2e`, `npm run e2e:wallet`) |
| Wallet extension | 227 unit, plus the simnet, stack and smoke suites | `wallet/extension` |
| Vault (Hardhat) | 209 | `bridge/evm/test/` |
| Services | 672, one of them an expected failure | `bridge/services/src/**/*.test.ts` |
| Kaspa client, protocol | 60, 57 | `bridge/packages/*` |
| Deployer and test tools | 118 | `bridge/devnet/src/*.test.ts` |
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

The builders are pinned (since run 21, Daybreak [6]). `tools/rust.sh` runs `docker.io/library/rust:1.94.1` by its
digest, and `tools/docker/rust-wasm.Dockerfile` starts from the same image and installs each package at an exact
version: a tag, and whatever apt serves that day, would let a registry or a package mirror change what compiles the
covenants and the core. The name is in full because podman takes a short one (`rust:1.94.1`) only through an alias.
The digest is the tag's multi-platform index, not one platform's image: it names the linux/amd64 and the linux/arm64
builds among others, so an arm64 machine runs its own build of the same pin, and Debian serves each pinned package at
the same version for both. The committed WebAssembly core was rebuilt and compared on linux/amd64 only: an arm64
builder's output has not been compared with it. `tools/wasm.sh` builds that image itself and runs it by the ID the
build gives, never by a tag. `node tools/check-artifacts.mjs` fails a builder named by a tag or by a short name, or a
package with no version. The price of exact versions: the day Debian replaces one of them (a stable update of
`llvm-toolchain-19`, say), apt no longer finds it, the image stops building and the CI job fails, until the successor
is pinned on purpose and the core rebuilt and compared. Debian's snapshot archive keeps the old packages (the pinned
`clang-19`, `1:19.1.7-3+b1`, since 15 June 2025): to rebuild an older release with its own pins, point the image's apt
sources at `snapshot.debian.org` for a date when Debian served them. The CI job builds in a copy of the tree
(`git archive`) and compares the copy's artifacts and WebAssembly core with the checkout (`diff -r`), which no
builder mounts: before, it compared the very tree the builder had written. To move to another toolchain or package
version, pin the new index's digest or version in both files, rebuild, and compare. After
`docker pull docker.io/library/rust:<tag>`, this shows the digest:
`docker image inspect docker.io/library/rust:<tag> --format '{{index .RepoDigests 0}}'`.

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
