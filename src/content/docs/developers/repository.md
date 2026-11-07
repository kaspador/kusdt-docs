---
title: Repository layout
description: Where everything lives in the kUSDT repository.
---

The repository has two top-level product folders, `bridge/` and `wallet/`, plus the specification, tools, vendored
sources and these docs.

| Path | What |
|---|---|
| `SPEC.md` | The protocol specification. Every part follows it |
| `PROGRESS.md` | The working log: status, next steps, and the reasons behind decisions |
| `bridge/kaspa` | Rust: the Argent contracts (`contracts/`), the checked-in artifacts (`artifacts/`), the VM tests (`tests/`), the transaction builders and the `kusdt-tx` CLI |
| `bridge/kaspa/wasm` | The WebAssembly build of the same builders |
| `bridge/evm` | Hardhat: `KusdtVault`, test tokens, 102 tests, `scripts/deploy.ts`, the AccessManager setup (`scripts/access-manager.ts`), deployment configs |
| `bridge/packages/kaspa` | TypeScript: Kaspa addresses, keys, version-0 transactions, fees and a wRPC client |
| `bridge/packages/core` | TypeScript wrapper of the WebAssembly builders (`@kusdt/core`), for Node and browsers |
| `bridge/packages/protocol` | TypeScript protocol helpers shared by the services, the web app and the wallet: KCC-20 decoding, owners, EVM messages, pool math, deployment types |
| `bridge/services` | TypeScript: the signer (×5), the coordinator (EVM watchers, minting, Kaspa scanner, relayer, public API), the monitor and guardian, and the testnet faucet |
| `bridge/devnet` | TypeScript: a simnet miner, the end-to-end runs (`simnet-e2e.ts`, `local-e2e.ts`, `local-load.ts`), the rehearsals (`fork-rehearsal.ts`, `rehearse-mainnet.ts`, `local-rotate.ts`), the testnet tools and the mainnet deployer (`mainnet-deploy.ts`); see its README |
| `wallet/extension` | The wallet extension: React, Vite and Tailwind; KAS and kUSDT, redeem, swap, liquidity, EVM deposits, `window.kusdt`; unit, simnet, smoke and live-stack tests |
| `bridge/web` | The web app (Trestly): React and Vite; unit and end-to-end tests |
| `docs/` | This site |
| `deploy/` | The services image, the testnet compose and Caddy files, the runbook, and the `mainnet-*` packages |
| `deployments/` | The deployed addresses (`testnet.json`) |
| `tools/check-artifacts.mjs` | Checks the covenant bytecode's sources and artifacts against `bridge/kaspa/artifacts/PROVENANCE.json` |
| `.github/workflows/artifacts.yml` | The CI job that recompiles the covenants and the WebAssembly core and compares them |
| `tools/rust.sh` | Runs any Rust command in the pinned container |
| `tools/wasm.sh` | Builds the WebAssembly module into `bridge/packages/core` |
| `tools/vendor.sh` | Fetches the specifications and compiler sources into `vendor/`, to read: at pinned commits, except `kaspanet/kips`, which follows master |
| `vendor/` | The KCC-20 reference that kUSDT imports (checked in, unchanged), the KCC and KIP texts, SilverScript and Argent (fetched), plus `vendor/third-party/` (checked in) |

## The contracts

| File | Contents |
|---|---|
| `bridge/kaspa/contracts/kusdt.ag` | The kUSDT app: `KCC20`, `TokenSeed`, `BridgeMint` |
| `bridge/kaspa/contracts/bridge_mint.ag` | `BridgeMint` |
| `bridge/kaspa/contracts/pool.ag` | The KasPool app: `Pool`, `Position` |
| `bridge/evm/contracts/KusdtVault.sol` | The vault |
| `bridge/evm/contracts/test/` | `MockUSDT` (testnet faucet token) and test-only tokens: Tether-style, fee-on-transfer, reentrant |

## Pinned dependencies

The Kaspa crate pins the Argent compiler and runtime and rusty-kaspa at the revisions the KCC-20 reference pins,
so the `KCC20` actor compiles to the bytes wallets recognise. The Rust toolchain is pinned to 1.94.1
(`rust-toolchain.toml`, and the `rust:1.94.1` container).

`tools/vendor.sh` fetches:

| Source | Use |
|---|---|
| `kaspanet/kccs`, `kaspanet/kips` | The specifications (read, not built) |
| `kaspanet/silverscript`, `argent-lang/argent` | Compiler sources (read) |
