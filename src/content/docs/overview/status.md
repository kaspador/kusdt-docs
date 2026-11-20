---
title: Status
description: What exists today, what is tested, and what is not built yet.
---

As of 18 November 2026. kUSDT **launched on mainnet on 15 November 2026** (Kaspa, Ethereum and BNB Chain), from
the release `mainnet-v0.9.8-rc.25`. The contracts are deployed and their addresses are [below](#addresses). The
bridge is open: the web app (Bridge, Swap, Pool, Reserves) runs at [trestly.io](https://trestly.io). The public testnet runs at [testnet.trestly.io](https://testnet.trestly.io), from the
same release, for developers and integrators to test against. It ran from 4 November 2026, paused on 14 November
and came back that evening ([Test on the public testnet](/getting-started/public-testnet/)).

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
| Web app | Browser | Built (`bridge/web`); on the public testnet at [testnet.trestly.io](https://testnet.trestly.io) since 4 November 2026; on mainnet at [trestly.io](https://trestly.io) when the bridge opens | 249 unit tests, end-to-end tests on the live stack, and a suite driving the real wallet extension |
| Wallet extension | Browser | Built (`wallet/extension`), tested against the local stack and on the public testnet. Its mainnet version, 1.0.2, is out ([Install](/getting-started/wallet/#install)) | 227 unit tests, simnet and smoke suites, and tests against the live stack. Its page interface is specified ([Wallet provider](/protocol/wallet-provider/)) |
| Refunds | Services and vault | Working | `local:load`: a deposit skipped and refunded 14.5 USDT |
| Mainnet fork rehearsal | Forks of Ethereum and BNB Chain | Passed | The vault against the real USDT and BSC-USD |
| Internal security review | Money paths | Done, fixes applied | See [Audit status](/security/audit-status/) |
| Deployment tooling | Docker image, testnet compose file, runbook, mainnet packages | Written | See [Operations](/developers/operations/) |
| Vault owner: AccessManager under a Safe | Ethereum, BNB Chain | Built and rehearsed; each mainnet vault is owned this way (a 2-of-3 Safe, 48-hour delays, a 6-hour emergency delay, two cancellers). The testnet vaults kept a plain owner | 17 Hardhat tests; `mainnet:rehearse` |
| Mainnet packages: signer, coordinator, monitor, deployer, web app | Off-chain | Built; on mainnet since 15 November 2026, from `mainnet-v0.9.8-rc.25` | `mainnet:rehearse` on forks and simnet, 49 checks; `local:rotate`, 16 checks |
| Signer keys in an HSM or KMS | Off-chain | Built, as an option | See [Operations](/developers/operations/#signer-keys-in-an-hsm-or-kms) |
| Proof of reserves | Browser | The web app's Reserves page: on the public testnet since 4 November 2026; on mainnet when the bridge opens | Reads the vaults and the minter itself, next to `GET /reserves` and the monitor's check |
| Reproducible covenant bytecode | CI | Built | `tools/check-artifacts.mjs` and a CI job recompile and compare, byte for byte |
| Outside reviews | Code and services | Four so far, each finding answered. Not an audit | See [Audit status](/security/audit-status/) |
| Public testnet | TN10, Sepolia, BSC testnet | Running at [testnet.trestly.io](https://testnet.trestly.io) since 4 November 2026 (paused on 14 November, back that evening), for testing integrations ([Test on the public testnet](/getting-started/public-testnet/)) | `testnet:e2e` passed: deposits on both chains minted on TN10, 20 kUSDT redeemed to BSC testnet (19.5 USDT paid), the pool opened and a swap, and a burn to a blacklisted address refused, held, then paid once unblocked. It ran on one test host in isolated containers (see [Operations](/developers/operations/#the-testnet-deployment)) |
| Mainnet deployment | Kaspa, Ethereum, BNB Chain | Deployed on 15 November 2026 from `mainnet-v0.9.8-rc.25`; the bridge is open | Addresses [below](#addresses), with the contracts' source verified on Etherscan and BscScan. See the [mainnet checklist](/security/mainnet-checklist/) |
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

kUSDT's mainnet, launched on 15 November 2026 from the release `mainnet-v0.9.8-rc.25`. Trust no address, covenant ID
or API that claims to be kUSDT's and is not listed here.


### Kaspa

| What | ID | Created by |
|---|---|---|
| kUSDT covenant ID | `50b3477e7368d0c5bfbd64483b4607350ec411377972f33e40b2d4b6d1513fd3` | Genesis [`afce547d…`](https://explorer.kaspa.org/txs/afce547ddefcca0c1fc4877726095dd50e32f10f80028d9adc3244975934fe7d) |
| KasPool covenant ID | `28e7758e6fc0e2054cceb7f87f9da44a53accfa0a1795c8075c80fb99c83aaad` | Genesis [`c4d7a9d7…`](https://explorer.kaspa.org/txs/c4d7a9d79a3041f0745b06657db098c4329730420b8f7f65b58d91d49cf6f5eb) |
| Token metadata (KCC-23 preparation) | | [`14a39943…`](https://explorer.kaspa.org/txs/14a39943bccc21a013f43b03d593f6ff5b6e931af36585e2677cd8e9662d79b0) |

The pool opens with its first deposit, which only its admin can make ([KasPool](/contracts/kaspool/)).

### Ethereum and BNB Chain

The same addresses on both chains. Each contract's source is verified on the block explorer.

| What | Ethereum | BNB Chain |
|---|---|---|
| Vault (`KusdtVault`) | [`0xfa9869982542FB20baD929789B252b7b06EeE10e`](https://etherscan.io/address/0xfa9869982542FB20baD929789B252b7b06EeE10e#code) | [`0xfa9869982542FB20baD929789B252b7b06EeE10e`](https://bscscan.com/address/0xfa9869982542FB20baD929789B252b7b06EeE10e#code) |
| Its owner (`KusdtAccessManager`) | [`0xDD55cfaf862AD64259b41a96b47927A3c2f8E2DB`](https://etherscan.io/address/0xDD55cfaf862AD64259b41a96b47927A3c2f8E2DB#code) | [`0xDD55cfaf862AD64259b41a96b47927A3c2f8E2DB`](https://bscscan.com/address/0xDD55cfaf862AD64259b41a96b47927A3c2f8E2DB#code) |
| The manager's admin (a 2-of-3 Safe) | `0x69AD98869983757828841c89fd25dCEF440749b1` | `0x69AD98869983757828841c89fd25dCEF440749b1` |
| Guardian (the monitors' pause) | `0x5F3dAF6Da89cd5B5F52C3f4218CCE796E2865d6A` | `0x5F3dAF6Da89cd5B5F52C3f4218CCE796E2865d6A` |

### The API and the launch record

- The coordinator API: `https://api.trestly.io/api/v1`.
- The launch record, `deployment.json`, SHA-256 `a76316edd3aa23badfafcd60b88275d29230c2a23290e8f8acc547a9dc456443`, from the plan the operators reviewed (SHA-256
  `123d97ef3de6e21149a9642988e861f094e6b9c9612fffca31204b2634ce48fd`). Both are in the open code, under `deployments/`
  ([github.com/kaspador/kusdt-open](https://github.com/kaspador/kusdt-open/tree/main/deployments)). Each operator
  checks the deployment against them with `mainnet:verify`, on their own node and RPCs, before starting their signer.

The two mainnet monitors run on closed machines and publish only their read-only status, through Cloudflare tunnels:
`https://monitor.trestly.io/api/v1/monitor` and `https://monitor.kaspa.news/api/v1/monitor`. The pause they set on any alarm also shows on
chain ([Is the bridge paused?](/integrate/developer-guide/#is-the-bridge-paused)).

The public testnet has its own addresses, for test coins only: see
[Test on the public testnet](/getting-started/public-testnet/#networks-and-addresses). They are not mainnet's.

The USDT contracts that the mainnet vaults hold are fixed by the specification:

| Chain | Token | Address | Decimals |
|---|---|---|---|
| Ethereum | USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 |
| BNB Smart Chain | BSC-USD | `0x55d398326f99059fF775485246999027B3197955` | 18 |
