---
title: Status
description: What exists today, what is tested, and what is not built yet.
---

As of 14 November 2026. kUSDT **launches on mainnet today** (Kaspa, Ethereum and BNB Chain), from the release
`mainnet-v0.9.8-rc.25`. Until the launch is verified, [trestly.io](https://trestly.io) shows a "Launching today"
page; the web app (Bridge, Swap, Pool, Reserves) opens there once the launch is verified. The mainnet addresses are
published [below](#addresses) at the same time. The public testnet ran from 4 to 14 November 2026 and has ended
([The public testnet](/getting-started/public-testnet/)).

:::danger[Not audited]
No independent audit has been done, and the legal review is still open. Internal attack rounds and outside
reviews have taken place ([Audit status](/security/audit-status/)), but none of them is an audit. The open items
are on the [mainnet checklist](/security/mainnet-checklist/). Bridge only what you can afford to lose.
:::

## Components

| Component | Runs on | Status | Evidence |
|---|---|---|---|
| Protocol specification | (document) | v1 | `SPEC.md`, the source of truth for these docs |
| BridgeMint covenant | Kaspa L1 | Written | Script-engine tests, attacks included (175 Rust tests in all, with the pool's); simnet run |
| kUSDT token family (KCC20, TokenSeed, BridgeMint) | Kaspa L1 | Written | KCC20 template matches the standard byte for byte (test) |
| KasPool covenants (Pool, Position) | Kaspa L1 | Written, with the circuit breaker and the pause | Script-engine tests; simnet run; the forged-kUSDT dump capped in `local:e2e` |
| KusdtVault | Ethereum, BNB Chain | Written | 209 Hardhat tests; reviewed line by line against the specification |
| Transaction builders | Rust CLI (`kusdt-tx`) and WebAssembly | Written | The simnet run uses them |
| Signer and coordinator services | Off-chain | Written | The local end-to-end run (below) |
| Monitor and guardian service | Off-chain | Written | Caught and paused a forged mint in the local end-to-end run (below) |
| Web app | Browser | Built (`bridge/web`); ran on the public testnet, 4 to 14 November 2026; on mainnet at [trestly.io](https://trestly.io) once the launch is verified | 249 unit tests, end-to-end tests on the live stack, and a suite driving the real wallet extension |
| Wallet extension | Browser | Built (`wallet/extension`), tested against the local stack and on the public testnet. Its mainnet version is published right after the launch | 227 unit tests, simnet and smoke suites, and tests against the live stack. Its page interface is specified ([Wallet provider](/protocol/wallet-provider/)) |
| Refunds | Services and vault | Working | `local:load`: a deposit skipped and refunded 14.5 USDT |
| Mainnet fork rehearsal | Forks of Ethereum and BNB Chain | Passed | The vault against the real USDT and BSC-USD |
| Internal security review | Money paths | Done, fixes applied | See [Audit status](/security/audit-status/) |
| Deployment tooling | Docker image, testnet compose file, runbook, mainnet packages | Written | See [Operations](/developers/operations/) |
| Vault owner: AccessManager under a Safe | Ethereum, BNB Chain | Built and rehearsed; each mainnet vault is owned this way (a 2-of-3 Safe, 48-hour delays, a 6-hour emergency delay, two cancellers). The testnet vaults kept a plain owner | 17 Hardhat tests; `mainnet:rehearse` |
| Mainnet packages: signer, coordinator, monitor, deployer, web app | Off-chain | Built; launching today from `mainnet-v0.9.8-rc.25` | `mainnet:rehearse` on forks and simnet, 49 checks; `local:rotate`, 16 checks |
| Signer keys in an HSM or KMS | Off-chain | Built, as an option | See [Operations](/developers/operations/#signer-keys-in-an-hsm-or-kms) |
| Proof of reserves | Browser | The web app's Reserves page: ran on the public testnet, 4 to 14 November 2026; on mainnet once the launch is verified | Reads the vaults and the minter itself, next to `GET /reserves` and the monitor's check |
| Reproducible covenant bytecode | CI | Built | `tools/check-artifacts.mjs` and a CI job recompile and compare, byte for byte |
| Outside reviews | Code and services | Four so far, each finding answered. Not an audit | See [Audit status](/security/audit-status/) |
| Public testnet | TN10, Sepolia, BSC testnet | Ran on the public testnet, 4 to 14 November 2026; ended | `testnet:e2e` passed: deposits on both chains minted on TN10, 20 kUSDT redeemed to BSC testnet (19.5 USDT paid), the pool opened and a swap, and a burn to a blacklisted address refused, held, then paid once unblocked. It ran on one test host in isolated containers (see [Operations](/developers/operations/#the-testnet-deployment)) |
| Mainnet deployment | Kaspa, Ethereum, BNB Chain | Launching today, 14 November 2026, from `mainnet-v0.9.8-rc.25` | Addresses published [here](#addresses) once the launch is verified. See the [mainnet checklist](/security/mainnet-checklist/) |
| Signer operators | Mainnet | Five independent operators; any 3 approve a mint or a payout, 4 for Kaspa governance | The [mainnet checklist](/security/mainnet-checklist/), item 1 |

## What the simnet run shows

A local Kaspa node (kaspad v2.1.0, simnet) accepted every step of the Kaspa-side flow, bridge and pool:

1. a KCC-23 preparation transaction carrying the token metadata;
2. the genesis transaction that creates BridgeMint and a TokenSeed;
3. a mint of two Ethereum deposits (nonces 0 and 1), signed by signers 0, 2 and 4;
4. a KCC-20 transfer between two users;
5. a redemption burn to a burn owner naming an Ethereum address, with the redemption payload;
6. a mint of two BNB Chain deposits (nonces 0 and 1), signed by signers 1, 3 and 4;
7. the pool's genesis, then its first deposit (200 KAS and 20 kUSDT);
8. a buy, a sell, a liquidity deposit, a liquidity withdrawal, and the admin collecting the protocol fees.

## The whole bridge on one machine

The local end-to-end run first passed on 3 November 2026. It has passed with the pool attack below since 4 November 2026, most recently on 7 November 2026. It runs two Hardhat chains (chain IDs 31337 and 31338,
standing in for Ethereum and BNB Chain, with MockUSDT at 6 and 18 decimals and a vault each), the kaspad simnet,
the 5 signers, the coordinator and the monitor, all on one machine. It showed:

1. a deposit on each chain, minted on Kaspa with 3 of 5 signatures;
2. a burn naming chain 2, released by its vault: 49.5 USDT paid for 50 kUSDT burned;
3. healthy reserves (INV-1) afterwards;
4. the coordinator's pool and position APIs following a buy and a liquidity add and remove;
5. the monitor agreeing with the coordinator before the attack: minted 299, released 50, owed 249 ≤ backing 249
   (USDT), no alarms.

Then the attack. Three stolen signer keys try to mint 1 000 000 kUSDT; the mint allowance refuses it. They mint
400 000 kUSDT with no deposit; the covenant accepts it, because the signatures are valid and it is within the
allowance. Selling all of it into the pool at once is refused by the pool's circuit breaker, which lets out under
10 % of the pool's KAS. Within seconds the monitor raises `inv1` and pauses both vaults, the minter and the pool. The coordinator follows
the forged mint and the pause, and a paused vault refuses a new deposit. This is the strongest evidence so far
that the defences work together. See [The monitor](/security/monitor/#proof-the-attack-in-the-local-end-to-end-run).

The wallet extension was also tested live against the same stack (`npm run local:stack`): deposits on both
chains, a send, a redemption through to its release, swaps, and adding and removing liquidity.

## Addresses

No mainnet address is published yet. The kUSDT covenant ID, the KasPool covenant ID, the two vault addresses, the
coordinator API and the monitor's status URLs will be listed here once the launch is verified. Until then, trust
no address, covenant ID or API that claims to be kUSDT's.

The public testnet's addresses no longer work: it ended on 14 November 2026.

The USDT contracts that the mainnet vaults hold are fixed by the specification:

| Chain | Token | Address | Decimals |
|---|---|---|---|
| Ethereum | USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 |
| BNB Smart Chain | BSC-USD | `0x55d398326f99059fF775485246999027B3197955` | 18 |
