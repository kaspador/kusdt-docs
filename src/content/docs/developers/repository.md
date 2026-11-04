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
| `bridge/evm` | Hardhat: `KusdtVault`, test tokens, 83 tests, `scripts/deploy.ts`, deployment configs |
| `bridge/packages/kaspa` | TypeScript: Kaspa addresses, keys, version-0 transactions, fees and a wRPC client |
| `bridge/packages/core` | TypeScript wrapper of the WebAssembly builders (`@kusdt/core`), for Node and browsers |
| `bridge/packages/protocol` | TypeScript protocol helpers shared by the services, the web app and the wallet: KCC-20 decoding, owners, EVM messages, pool math, deployment types |
| `bridge/services` | TypeScript: the signer (×5) and the coordinator (EVM watchers, minting, Kaspa scanner, relayer, public API) and the monitor and guardian |
| `bridge/devnet` | TypeScript: a simnet miner, `simnet-e2e.ts` (the Kaspa side against a real node) and `local-e2e.ts` (the whole bridge on one machine); see its README |
| `wallet/extension` | The wallet extension: React, Vite and Tailwind; KAS and kUSDT, redeem, swap, liquidity, EVM deposits, `window.kusdt`; unit, simnet, smoke and live-stack tests |
| `docs/` | This site |
| `tools/rust.sh` | Runs any Rust command in the pinned container |
| `tools/wasm.sh` | Builds the WebAssembly module into `bridge/packages/core` |
| `tools/vendor.sh` | Fetches third-party sources at pinned commits into `vendor/` |
| `vendor/` | The KCC-20 reference, the KCC and KIP texts, SilverScript and Argent (fetched), plus `vendor/third-party/` (checked in) |

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
| `argent-lang/kcc20-reference` | kUSDT imports its `KCC20` and `TokenSeed` actors unchanged |
| `kaspanet/kccs`, `kaspanet/kips` | The specifications (read, not built) |
| `kaspanet/silverscript`, `argent-lang/argent` | Compiler sources (read) |
