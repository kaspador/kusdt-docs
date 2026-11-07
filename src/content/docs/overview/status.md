---
title: Status
description: What exists today, what is tested, and what is not built yet.
---

As of 7 November 2026. The specification is **v1, for testnet**. kUSDT is deployed on testnet (TN10, Sepolia and BSC testnet), and the public testnet is open at [testnet.trestly.io](https://testnet.trestly.io), with test coins only. The latest testnet release is `v0.9.12`, with wallet 0.9.8. The mainnet candidate is `mainnet-v0.9.8-rc.8`, a pre-release and not audited. The public testnet's services run commit `503a292`, with the third and fourth reviews' fixes. Its vaults predate the [payout wait](/protocol/redemptions-and-releases/#the-wait), which needs a new testnet deployment, so payouts there don't wait yet. Nothing is on mainnet. To try it, see [Test on the public testnet](/getting-started/public-testnet/).

:::danger[Not audited]
No external audit has taken place. Mainnet requires audits and the other steps in the
[mainnet checklist](/security/mainnet-checklist/).
:::

## Components

| Component | Runs on | Status | Evidence |
|---|---|---|---|
| Protocol specification | (document) | v1 | `SPEC.md`, the source of truth for these docs |
| BridgeMint covenant | Kaspa L1 | Written | 22 script-engine tests, attacks included; simnet run |
| kUSDT token family (KCC20, TokenSeed, BridgeMint) | Kaspa L1 | Written | KCC20 template matches the standard byte for byte (test) |
| KasPool covenants (Pool, Position) | Kaspa L1 | Written, with the circuit breaker and the pause | 23 script-engine tests; simnet run; the forged-kUSDT dump capped in `local:e2e` |
| KusdtVault | Ethereum, BNB Chain | Written | 102 Hardhat tests; reviewed line by line against the specification |
| Transaction builders | Rust CLI (`kusdt-tx`) and WebAssembly | Written | The simnet run uses them |
| Signer and coordinator services | Off-chain | Written | The local end-to-end run (below) |
| Monitor and guardian service | Off-chain | Written | Caught and paused a forged mint in the local end-to-end run (below) |
| Web app | Browser | Built (`bridge/web`) | 133 unit tests, 160 end-to-end tests on the live stack, 25 driving the real wallet extension |
| Wallet extension | Browser | Built (`wallet/extension`), tested against the local stack; a testnet build is downloadable, not released to any store | 123 unit tests, simnet and smoke suites, 7 against the live stack. Its page interface is specified ([Wallet provider](/protocol/wallet-provider/)) |
| Refunds | Services and vault | Working | `local:load`: a deposit skipped and refunded 14.5 USDT |
| Mainnet fork rehearsal | Forks of Ethereum and BNB Chain | Passed | The vault against the real USDT and BSC-USD |
| Internal security review | Money paths | Done, fixes applied | See [Audit status](/security/audit-status/) |
| Deployment tooling | Docker image, testnet compose file, runbook, mainnet packages | Written | See [Operations](/developers/operations/) |
| Vault owner: AccessManager under a Safe | Ethereum, BNB Chain | Built and rehearsed, not on any live vault: testnet vaults keep a plain owner | 17 Hardhat tests; `mainnet:rehearse` |
| Mainnet packages: signer, coordinator, monitor, deployer, web app | Off-chain | Built; nothing deployed | `mainnet:rehearse` on forks and simnet, 49 checks; `local:rotate`, 16 checks |
| Signer keys in an HSM or KMS | Off-chain | Built, as an option | See [Operations](/developers/operations/#signer-keys-in-an-hsm-or-kms) |
| Proof of reserves | Browser | Live on the testnet: the web app's Reserves page | Reads the vaults and the minter itself, next to `GET /reserves` and the monitor's check |
| Reproducible covenant bytecode | CI | Built | `tools/check-artifacts.mjs` and a CI job recompile and compare, byte for byte |
| Outside reviews | Code and services | Four so far, each finding answered. Not an audit | See [Audit status](/security/audit-status/) |
| Testnet deployment | TN10, Sepolia, BSC testnet | Deployed 4 November 2026 | `testnet:e2e` passed: deposits on both chains minted on TN10, 20 kUSDT redeemed to BSC testnet (19.5 USDT paid), the pool opened and a swap, and a burn to a blacklisted address refused, held, then paid once unblocked. Public from 4 November 2026, on one test host in isolated containers (see [Operations](/developers/operations/#the-testnet-deployment)) |
| Mainnet deployment | Kaspa, Ethereum, BNB Chain | Not yet | Gated on the [mainnet checklist](/security/mainnet-checklist/) |
| Signer operators | Mainnet | Five lined up; nothing runs on mainnet yet | The [mainnet checklist](/security/mainnet-checklist/), item 1 |

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

| Item | Testnet | Mainnet |
|---|---|---|
| kUSDT covenant ID | `6711958e2bc51c590426037020d9683ebd5daf42593de1797b65d25b92566314` | to be published |
| KasPool covenant ID | `102a59644f81734faa6e7870a694ee8da047b02b8bc21945576f535f94f5efb4`, since 5 November 2026 (it replaced `0b2028d0d96d0858051fa633ae0b80ad459a9b33415065a9174a8a0b07b492c9`, whose breaker counted gross sells, which had replaced `f762a53e3bdfc680bb8bd55d4e64094021ea2d1c1ccc807c1772485dfe477a8b`, with no circuit breaker) | to be published |
| KusdtVault on Ethereum (Sepolia on testnet) | `0x7a9CA592adc5fC024660AF66e44051145a1f7C57` | to be published |
| KusdtVault on BNB Chain (BSC testnet on testnet) | `0x7a9CA592adc5fC024660AF66e44051145a1f7C57` | to be published |
| MockUSDT (testnet only) | `0x5bF185d9ce3A194b7090f069398580A66fb1F8a1` on both | not used |
| Coordinator API | `https://testnet.trestly.io/api/v1` | to be published |
| Web app URL | `https://testnet.trestly.io` | to be published |
| Monitor status (read-only) | `https://testnet.trestly.io/monitor/health`, `https://testnet.trestly.io/monitor/api/v1/monitor`, `https://testnet.trestly.io/monitor/api/v1/signal` | to be published |
| Wallet download (testnet build) | `https://testnet.trestly.io/downloads/kusdt-wallet-testnet.zip` | to be published |

The testnet values come from `deployments/testnet.json`.

The USDT contracts that the mainnet vaults will hold are fixed by the specification:

| Chain | Token | Address | Decimals |
|---|---|---|---|
| Ethereum | USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 |
| BNB Smart Chain | BSC-USD | `0x55d398326f99059fF775485246999027B3197955` | 18 |
