---
title: Roadmap
description: What is done, what comes next, and what has to happen before mainnet.
---

As of 3 November 2026. Order follows the project's working plan; there are no dates.

## Done

- Protocol specification v1.
- `BridgeMint` and the kUSDT token family on Kaspa L1, with 21 VM tests; the `KCC20` template matches the standard.
- KasPool on Kaspa L1, with 12 VM tests.
- `KusdtVault` for Ethereum and BNB Chain, with 83 Hardhat tests, reviewed line by line against the specification.
- Transaction builders for every kUSDT and KasPool transaction, as a CLI and as WebAssembly.
- The full Kaspa-side flow, bridge and pool, accepted by a kaspad v2.1.0 simnet node.
- The signer and coordinator services, and a local end-to-end run of the whole bridge: two Hardhat chains, the
  simnet, 5 signers and the coordinator (deposit, mint, burn, release, healthy reserves, pool API).
- The monitor and guardian: in the local run it caught a forged 400 000 kUSDT mint and paused both vaults and the
  minter within seconds.
- `npm run local:stack`, the whole stack kept running for the wallet and the web app.
- The wallet extension, tested live against the local stack (not yet released).
- The web app, tested on the live stack and with the real wallet extension.
- Refunds, a load run, a rehearsal of the vault on mainnet forks, and an internal security review with its fixes.
- Deployment tooling: a services image, a testnet compose file and a runbook.
- This documentation site.

## Next

| # | Work |
|---|---|
| 1 | Testnets, once funded: vaults on Sepolia and BSC testnet, genesis and pool on testnet-10, the services |
| 2 | The mainnet package: deploy scripts dry-run, the checklists, and an operations runbook (keys, Safe and timelock, guardian, monitor alerts) |

## Before mainnet

Every item of the [mainnet checklist](/security/mainnet-checklist/): five independent signer operators, external
audits, the timelocked Safe as vault owner, legal review, live proof of reserves, and a genesis review by
kascov.io. Mainnet deployments also need the project owner's explicit approval.

## Later

**Zero-knowledge light-client verification** is the planned upgrade to the federated bridge: minting against a
proof checked on-chain, rather than signer signatures. It is not part of v1. See
[Known limits](/security/known-limits/).
